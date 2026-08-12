import base64
import hashlib
import hmac
import json
import secrets
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import APIRouter, Depends, HTTPException

from ..config import get_settings
from ..database import get_db
from ..models import AccessStatus, PaymentOrderOut, PaymentVerify
from ..security import get_current_user

router = APIRouter(prefix="/payments", tags=["payments"])


def _normalize_expiry(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        cleaned = value.strip()
        if not cleaned:
            return None
        try:
            dt = datetime.fromisoformat(cleaned.replace("Z", "+00:00"))
        except ValueError:
            return None
        return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)
    return None


def _access_status(user: dict) -> AccessStatus:
    settings = get_settings()
    payment_expiry = _normalize_expiry(user.get("access_expires_at"))
    free_expiry = _normalize_expiry(user.get("free_access_expires_at"))
    expires_at = None
    for expiry in (payment_expiry, free_expiry):
        if expiry is None:
            continue
        expires_at = expiry if expires_at is None or expiry > expires_at else expires_at

    active = user.get("role") == "admin" or (
        expires_at is not None and expires_at > datetime.now(timezone.utc)
    )
    return AccessStatus(
        active=active,
        expires_at=expires_at,
        price_rupees=settings.subscription_price_paise // 100,
        duration_days=settings.subscription_days,
    )


async def require_active_access(user: dict = Depends(get_current_user)) -> dict:
    if not _access_status(user).active:
        raise HTTPException(
            status_code=402,
            detail="Test access is locked. Pay ₹199 to unlock it for 30 days.",
        )
    return user


@router.get("/status", response_model=AccessStatus)
async def payment_status(user: dict = Depends(get_current_user)):
    return _access_status(user)


@router.post("/order", response_model=PaymentOrderOut)
async def create_order(user: dict = Depends(get_current_user)):
    settings = get_settings()
    if user.get("role") == "admin":
        raise HTTPException(status_code=400, detail="Admin accounts already have test access")
    if _access_status(user).active:
        raise HTTPException(status_code=400, detail="Your test access is already active")
    if not settings.razorpay_key_id or not settings.razorpay_key_secret:
        raise HTTPException(status_code=503, detail="Payments are not configured yet")

    receipt = f"test_{str(user['_id'])[-8:]}_{secrets.token_hex(5)}"
    request_body = json.dumps({
        "amount": settings.subscription_price_paise,
        "currency": "INR",
        "receipt": receipt,
        "notes": {"user_id": str(user["_id"]), "plan": "30-day-test-access"},
    }).encode()
    credentials = base64.b64encode(
        f"{settings.razorpay_key_id}:{settings.razorpay_key_secret}".encode()
    ).decode()
    request = Request(
        "https://api.razorpay.com/v1/orders",
        data=request_body,
        headers={"Authorization": f"Basic {credentials}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=15) as response:
            order = json.loads(response.read().decode())
    except (HTTPError, URLError, TimeoutError) as exc:
        raise HTTPException(status_code=502, detail="Could not create payment order") from exc

    await get_db().payments.insert_one({
        "user_id": user["_id"], "order_id": order["id"], "receipt": receipt,
        "amount": settings.subscription_price_paise, "currency": "INR",
        "status": "created", "created_at": datetime.now(timezone.utc),
    })
    return PaymentOrderOut(key_id=settings.razorpay_key_id, order_id=order["id"], amount=order["amount"])


@router.post("/verify", response_model=AccessStatus)
async def verify_payment(payload: PaymentVerify, user: dict = Depends(get_current_user)):
    settings = get_settings()
    expected = hmac.new(
        settings.razorpay_key_secret.encode(),
        f"{payload.razorpay_order_id}|{payload.razorpay_payment_id}".encode(),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, payload.razorpay_signature):
        raise HTTPException(status_code=400, detail="Payment verification failed")

    db = get_db()
    payment = await db.payments.find_one({
        "order_id": payload.razorpay_order_id, "user_id": user["_id"]
    })
    if not payment:
        raise HTTPException(status_code=404, detail="Payment order not found")
    if payment.get("status") != "paid":
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(days=settings.subscription_days)
        await db.payments.update_one({"_id": payment["_id"]}, {"$set": {
            "status": "paid", "payment_id": payload.razorpay_payment_id,
            "paid_at": now, "access_expires_at": expires_at,
        }})
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"access_expires_at": expires_at}})
        user["access_expires_at"] = expires_at
    else:
        user = await db.users.find_one({"_id": user["_id"]})
    return _access_status(user)
