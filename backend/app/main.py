from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import close_mongo_connection, connect_to_mongo, get_db
from .routers import admin, auth, notes, quizzes
from .security import hash_password


async def _bootstrap_admin() -> None:
    settings = get_settings()
    db = get_db()
    existing = await db.users.find_one({"email": settings.admin_email.lower()})
    if existing:
        return
    await db.users.insert_one(
        {
            "name": "Administrator",
            "email": settings.admin_email.lower(),
            "password": hash_password(settings.admin_password),
            "role": "admin",
        }
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    await _bootstrap_admin()
    yield
    await close_mongo_connection()


app = FastAPI(title="Quiz Platform API", version="1.0.0", lifespan=lifespan)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(quizzes.router)
app.include_router(admin.router)
app.include_router(notes.router)


@app.get("/", tags=["health"])
async def health():
    return {"status": "ok", "service": "quiz-platform"}
