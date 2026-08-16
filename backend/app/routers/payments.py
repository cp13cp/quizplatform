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
from ..models import AccessStatus, CourseForCatalog, PaymentOrderOut, PaymentVerify
from ..security import get_current_user

router = APIRouter(prefix="/payments", tags=["payments"])


def _razorpay_error_detail(exc):
    try:
        payload = exc.read().decode()
        data = json.loads(payload)
        error = data.get("error", {})
        description = error.get("description") or error.get("code") or "Could not create payment order"
        if "Authentication failed" in description or "authentication" in description.lower():
            return "Razorpay authentication failed. Update RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env with valid test keys."
        return description
    except Exception:
        return "Could not create payment order"


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


async def _get_pricing_config():
    """Get pricing configuration from database, with fallback to settings."""
    db = get_db()
    config = await db.pricing_config.find_one({})
    if config:
        return {
            "price_rupees": config.get("default_price_rupees", 99),
            "duration_days": 30,  # Default duration is 30 days
            "discount_percentage": config.get("discount_percentage", 0),
            "discount_active": config.get("discount_active", False),
            "tax_percentage": config.get("tax_percentage", 0),
        }
    # Fallback to settings
    settings = get_settings()
    return {
        "price_rupees": settings.subscription_price_paise // 100,
        "duration_days": settings.subscription_days,
        "discount_percentage": 0,
        "discount_active": False,
        "tax_percentage": 0,
    }


def _access_status(user: dict, pricing: dict = None) -> AccessStatus:
    if pricing is None:
        settings = get_settings()
        pricing = {
            "price_rupees": settings.subscription_price_paise // 100,
            "duration_days": settings.subscription_days,
        }
    
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
        price_rupees=pricing["price_rupees"],
        duration_days=pricing["duration_days"],
    )


async def require_active_access(user: dict = Depends(get_current_user)) -> dict:
    pricing = await _get_pricing_config()
    status = _access_status(user, pricing)
    if not status.active:
        raise HTTPException(
            status_code=402,
            detail=f"Test access is locked. Pay ₹{status.price_rupees} to unlock it for {status.duration_days} days.",
        )
    return user


@router.get("/status", response_model=AccessStatus)
async def payment_status(user: dict = Depends(get_current_user)):
    pricing = await _get_pricing_config()
    return _access_status(user, pricing)


@router.post("/order", response_model=PaymentOrderOut)
async def create_order(user: dict = Depends(get_current_user)):
    settings = get_settings()
    pricing = await _get_pricing_config()
    
    if user.get("role") == "admin":
        raise HTTPException(status_code=400, detail="Admin accounts already have test access")
    if _access_status(user, pricing).active:
        raise HTTPException(status_code=400, detail="Your test access is already active")
    if not settings.razorpay_key_id or not settings.razorpay_key_secret:
        raise HTTPException(status_code=503, detail="Payments are not configured yet")

    # Calculate final amount with discount and tax
    base_amount = pricing["price_rupees"]
    discount_pct = pricing["discount_percentage"] if pricing["discount_active"] else 0
    effective_amount = int(base_amount * (1 - discount_pct / 100))
    tax_pct = pricing["tax_percentage"]
    final_amount_paise = int(effective_amount * (1 + tax_pct / 100) * 100)

    receipt = f"test_{str(user['_id'])[-8:]}_{secrets.token_hex(5)}"
    request_body = json.dumps({
        "amount": final_amount_paise,
        "currency": "INR",
        "receipt": receipt,
        "notes": {
            "user_id": str(user["_id"]),
            "plan": "30-day-test-access",
            "base_price": str(base_amount),
            "discount": str(discount_pct),
            "tax": str(tax_pct),
        },
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
    except HTTPError as exc:
        raise HTTPException(status_code=401, detail=_razorpay_error_detail(exc)) from exc
    except (URLError, TimeoutError) as exc:
        raise HTTPException(status_code=502, detail="Razorpay server is unreachable from this machine") from exc

    await get_db().payments.insert_one({
        "user_id": user["_id"], "order_id": order["id"], "receipt": receipt,
        "amount": final_amount_paise, "currency": "INR",
        "status": "created", "created_at": datetime.now(timezone.utc),
    })
    return PaymentOrderOut(key_id=settings.razorpay_key_id, order_id=order["id"], amount=order["amount"])


@router.post("/verify", response_model=AccessStatus)
async def verify_payment(payload: PaymentVerify, user: dict = Depends(get_current_user)):
    settings = get_settings()
    pricing = await _get_pricing_config()
    
    if not settings.razorpay_key_secret:
        raise HTTPException(status_code=503, detail="Payments are not configured yet")
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
        current_expiry = _normalize_expiry(user.get("access_expires_at"))
        start_time = current_expiry if current_expiry and current_expiry > now else now
        expires_at = start_time + timedelta(days=pricing["duration_days"])
        await db.payments.update_one({"_id": payment["_id"]}, {"$set": {
            "status": "paid", "payment_id": payload.razorpay_payment_id,
            "paid_at": now, "access_expires_at": expires_at,
        }})
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"access_expires_at": expires_at}})
        user["access_expires_at"] = expires_at
    else:
        user = await db.users.find_one({"_id": user["_id"]})
    return _access_status(user, pricing)


@router.post("/course-order", response_model=PaymentOrderOut)
async def create_course_order(
    payload: dict,
    user: dict = Depends(get_current_user)
):
    """Create a Razorpay order for course purchase"""
    settings = get_settings()
    if not settings.razorpay_key_id or not settings.razorpay_key_secret:
        raise HTTPException(status_code=503, detail="Payments are not configured yet")

    course_id = payload.get("course_id")
    course_title = payload.get("course_title")
    amount = payload.get("amount")  # in paise

    if not course_id or not amount:
        raise HTTPException(status_code=400, detail="Missing course_id or amount")

    receipt = f"course_{course_id}_{str(user['_id'])[-8:]}_{secrets.token_hex(5)}"
    request_body = json.dumps({
        "amount": amount,
        "currency": "INR",
        "receipt": receipt,
        "notes": {"user_id": str(user["_id"]), "course_id": course_id, "course_title": course_title},
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
    except HTTPError as exc:
        raise HTTPException(status_code=401, detail=_razorpay_error_detail(exc)) from exc
    except (URLError, TimeoutError) as exc:
        raise HTTPException(status_code=502, detail="Razorpay server is unreachable from this machine") from exc

    await get_db().payments.insert_one({
        "user_id": user["_id"], "order_id": order["id"], "receipt": receipt,
        "amount": amount, "currency": "INR", "course_id": course_id, "course_title": course_title,
        "status": "created", "created_at": datetime.now(timezone.utc),
    })
    return PaymentOrderOut(key_id=settings.razorpay_key_id, order_id=order["id"], amount=order["amount"])


@router.post("/verify-course")
async def verify_course_payment(payload: dict, user: dict = Depends(get_current_user)):
    """Verify course payment and enroll user"""
    settings = get_settings()
    if not settings.razorpay_key_secret:
        raise HTTPException(status_code=503, detail="Payments are not configured yet")

    order_id = payload.get("razorpay_order_id")
    payment_id = payload.get("razorpay_payment_id")
    signature = payload.get("razorpay_signature", "")

    if not order_id or not payment_id or not signature:
        raise HTTPException(status_code=400, detail="Missing payment details")

    expected = hmac.new(
        settings.razorpay_key_secret.encode(),
        f"{order_id}|{payment_id}".encode(),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=400, detail="Payment verification failed")

    db = get_db()
    payment = await db.payments.find_one({
        "order_id": order_id, "user_id": user["_id"]
    })
    if not payment:
        raise HTTPException(status_code=404, detail="Payment order not found")

    if payment.get("status") != "paid":
        now = datetime.now(timezone.utc)
        course_id = payment.get("course_id")

        # Update payment status
        await db.payments.update_one({"_id": payment["_id"]}, {"$set": {
            "status": "paid", "payment_id": payment_id,
            "paid_at": now,
        }})

        # Add course to user's enrolled_courses
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$addToSet": {"enrolled_courses": course_id}}
        )

    return {"message": f"Successfully enrolled in course {payment.get('course_title')}", "status": "success"}


@router.get("/courses", response_model=list[CourseForCatalog])
async def list_active_courses():
    """Get all active courses for public catalog (no authentication required)."""
    db = get_db()
    cursor = db.courses.find({"is_active": True}).sort("created_at", -1)
    courses = [
        CourseForCatalog(
            id=str(course["_id"]),
            title=course["title"],
            overview=course["overview"],
            duration=course.get("duration", ""),
            schedule=course.get("schedule", ""),
            price_rupees=course.get("price_rupees", 0),
            features=course.get("features", []),
            color=course.get("color", "#e8f5e9"),
        )
        async for course in cursor
    ]
    return courses
