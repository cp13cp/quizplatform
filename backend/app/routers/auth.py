import hashlib
import json
import logging
import secrets
import smtplib
import ssl
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from ..config import get_settings
from ..database import get_db
from ..models import (
    PasswordResetConfirm,
    PasswordResetRequest,
    TokenOut,
    UserLogin,
    UserOut,
    UserRegister,
)
from ..security import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_out(user: dict) -> UserOut:
    return UserOut(
        id=str(user["_id"]),
        name=user["name"],
        email=user["email"],
        phone=user.get("phone", ""),
        role=user["role"],
    )


def _send_reset_email(recipient: str, reset_url: str) -> None:
    settings = get_settings()
    if not settings.email_from:
        raise RuntimeError("EMAIL_FROM is not configured")

    subject = "Reset your Quiz Platform password"
    body = (
        "A password reset was requested for your account.\n\n"
        f"Reset your password: {reset_url}\n\n"
        f"This link expires in {settings.password_reset_expire_minutes} minutes. "
        "If you did not request this, you can ignore this email."
    )

    # Render cannot reach Gmail's SMTP port, so prefer SendGrid's HTTPS API.
    if settings.sendgrid_api_key:
        payload = json.dumps(
            {
                "personalizations": [{"to": [{"email": recipient}]}],
                "from": {"email": settings.email_from},
                "subject": subject,
                "content": [{"type": "text/plain", "value": body}],
            }
        ).encode()
        request = Request(
            "https://api.sendgrid.com/v3/mail/send",
            data=payload,
            headers={
                "Authorization": f"Bearer {settings.sendgrid_api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        with urlopen(request, timeout=settings.email_timeout) as response:
            if response.status not in (200, 202):
                raise RuntimeError(f"SendGrid returned status {response.status}")
        return

    if not all(
        [
            settings.email_host,
            settings.email_user,
            settings.email_password,
        ]
    ):
        raise RuntimeError("Email service is not configured")

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.email_from
    message["To"] = recipient
    message.set_content(body)

    if settings.email_use_tls and settings.email_port == 465:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(
            settings.email_host,
            settings.email_port,
            timeout=settings.email_timeout,
            context=context,
        ) as smtp:
            smtp.login(settings.email_user, settings.email_password)
            smtp.send_message(message)
        return

    with smtplib.SMTP(
        settings.email_host,
        settings.email_port,
        timeout=settings.email_timeout,
    ) as smtp:
        smtp.ehlo()
        if settings.email_use_tls:
            smtp.starttls(context=ssl.create_default_context())
            smtp.ehlo()
        smtp.login(settings.email_user, settings.email_password)
        smtp.send_message(message)


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
async def register(payload: UserRegister):
    db = get_db()
    email = payload.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    doc = {
        "name": payload.name,
        "email": email,
        "password": hash_password(payload.password),
        "role": "user",
    }
    result = await db.users.insert_one(doc)
    doc["_id"] = result.inserted_id
    token = create_access_token(str(result.inserted_id), "user")
    return TokenOut(access_token=token, user=_user_out(doc))


@router.post("/forgot-password")
async def forgot_password(payload: PasswordResetRequest):
    """Send a one-time password-reset link without revealing whether the email exists."""
    db = get_db()
    user = await db.users.find_one({"email": payload.email.lower()})
    response = {"detail": "If that email is registered, a reset link has been sent."}
    if not user:
        return response

    settings = get_settings()
    if not all(
        [
            settings.email_host,
            settings.email_user,
            settings.email_password,
            settings.email_from,
        ]
    ):
        raise HTTPException(status_code=500, detail="Email service is not configured")

    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=settings.password_reset_expire_minutes)
    await db.password_reset_tokens.delete_many({"user_id": user["_id"]})
    await db.password_reset_tokens.insert_one(
        {
            "user_id": user["_id"],
            "token_hash": token_hash,
            "expires_at": expires_at,
            "used": False,
            "created_at": now,
        }
    )
    reset_url = f"{settings.frontend_url.rstrip('/')}/reset-password?{urlencode({'token': token})}"
    try:
        _send_reset_email(user["email"], reset_url)
    except Exception as exc:
        await db.password_reset_tokens.delete_one({"token_hash": token_hash})
        logging.exception("Failed to send password reset email")
        raise HTTPException(status_code=500, detail="Failed to send reset email") from exc
    return response


@router.post("/reset-password")
async def reset_password(payload: PasswordResetConfirm):
    db = get_db()
    token_hash = hashlib.sha256(payload.token.encode()).hexdigest()
    token_doc = await db.password_reset_tokens.find_one_and_update(
        {
            "token_hash": token_hash,
            "used": False,
            "expires_at": {"$gte": datetime.now(timezone.utc)},
        },
        {"$set": {"used": True}},
    )
    if not token_doc:
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired")

    await db.users.update_one(
        {"_id": token_doc["user_id"]},
        {"$set": {"password": hash_password(payload.password)}},
    )
    return {"detail": "Password has been reset. Please log in."}


@router.post("/login", response_model=TokenOut)
async def login(payload: UserLogin):
    db = get_db()
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not verify_password(payload.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(str(user["_id"]), user["role"])
    return TokenOut(access_token=token, user=_user_out(user))


@router.post("/login-oauth", response_model=TokenOut, include_in_schema=False)
async def login_oauth(form: OAuth2PasswordRequestForm = Depends()):
    """OAuth2 password-flow endpoint so Swagger 'Authorize' works."""
    return await login(UserLogin(email=form.username, password=form.password))


@router.get("/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return _user_out(user)
