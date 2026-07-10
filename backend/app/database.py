import certifi
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from .config import get_settings


class _DB:
    client: AsyncIOMotorClient | None = None
    db: AsyncIOMotorDatabase | None = None


_state = _DB()


async def connect_to_mongo() -> None:
    settings = get_settings()
    kwargs: dict = {"serverSelectionTimeoutMS": 20000}
    # For Atlas / any TLS mongodb+srv URI, pin a valid CA bundle. This avoids the
    # common Windows "SSL: TLSV1_ALERT_INTERNAL_ERROR" caused by a stale CA store.
    if settings.mongo_uri.startswith("mongodb+srv") or "mongodb.net" in settings.mongo_uri:
        kwargs["tlsCAFile"] = certifi.where()
    _state.client = AsyncIOMotorClient(settings.mongo_uri, **kwargs)
    _state.db = _state.client[settings.db_name]
    # Helpful indexes
    await _state.db.users.create_index("email", unique=True)
    await _state.db.attempts.create_index([("quiz_id", 1), ("user_id", 1)])


async def close_mongo_connection() -> None:
    if _state.client is not None:
        _state.client.close()


def get_db() -> AsyncIOMotorDatabase:
    if _state.db is None:
        raise RuntimeError("Database not initialized. Did startup run?")
    return _state.db
