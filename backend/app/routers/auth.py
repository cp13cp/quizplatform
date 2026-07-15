import random
import smtplib
from email.message import EmailMessage
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from ..config import get_settings
from ..database import get_db
from ..models import OTPRequest, ResetPassword, TokenOut, UserLogin, UserOut, UserRegister
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


def _generate_otp() -> str:
    return f"{random.randint(100000, 999999)}"


def _send_email(recipient: str, subject: str, body: str) -> None:
    settings = get_settings()
    if not (
        settings.email_host
        and settings.email_port
        and settings.email_user
        and settings.email_password
        and settings.email_from
    ):
        raise RuntimeError("Email service is not configured")

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.email_from
    message["To"] = recipient
    message.set_content(body)

    with smtplib.SMTP(settings.email_host, settings.email_port) as smtp:
        if settings.email_use_tls:
            smtp.starttls()
        smtp.login(settings.email_user, settings.email_password)
        smtp.send_message(message)


@router.post("/send-otp")
async def send_otp(payload: OTPRequest):
    settings = get_settings()
    if not (
        settings.email_host
        and settings.email_port
        and settings.email_user
        and settings.email_password
        and settings.email_from
    ):
        raise HTTPException(
            status_code=500,
            detail="Email OTP service is not configured. Set email settings in backend .env",
        )
    email = payload.email.lower()
    code = _generate_otp()
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=settings.sms_otp_expire_minutes)
    db = get_db()
    await db.otps.insert_one(
        {
            "email": email,
            "code": code,
            "created_at": now,
            "expires_at": expires_at,
            "used": False,
        }
    )
    try:
        _send_email(
            email,
            "Quiz Platform OTP Verification",
            f"Hello,\n\nUse this OTP to complete your Quiz Platform request.\n\nOTP: {code}\n\nThis code expires in {settings.sms_otp_expire_minutes} minutes.\n\nIf you did not request this, please ignore this email.\n",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to send OTP: {exc}")
    return {"detail": "OTP sent"}


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
async def register(payload: UserRegister):
    db = get_db()
    email = payload.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    now = datetime.now(timezone.utc)
    otp_doc = await db.otps.find_one(
        {
            "email": email,
            "code": payload.otp,
            "used": False,
            "expires_at": {"$gte": now},
        }
    )
    if not otp_doc:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    await db.otps.update_one({"_id": otp_doc["_id"]}, {"$set": {"used": True}})
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


@router.post("/reset-password")
async def reset_password(payload: ResetPassword):
    db = get_db()
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=400, detail="Invalid email or OTP")
    now = datetime.now(timezone.utc)
    otp_doc = await db.otps.find_one(
        {
            "email": email,
            "code": payload.otp,
            "used": False,
            "expires_at": {"$gte": now},
        }
    )
    if not otp_doc:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"password": hash_password(payload.password)}},
    )
    await db.otps.update_one({"_id": otp_doc["_id"]}, {"$set": {"used": True}})
    return {"detail": "Password has been reset"}


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
