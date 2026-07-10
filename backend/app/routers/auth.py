from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from ..database import get_db
from ..models import TokenOut, UserLogin, UserOut, UserRegister
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
        role=user["role"],
    )


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
async def register(payload: UserRegister):
    db = get_db()
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {
        "name": payload.name,
        "email": payload.email.lower(),
        "password": hash_password(payload.password),
        "role": "user",
    }
    result = await db.users.insert_one(doc)
    doc["_id"] = result.inserted_id
    token = create_access_token(str(result.inserted_id), "user")
    return TokenOut(access_token=token, user=_user_out(doc))


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
