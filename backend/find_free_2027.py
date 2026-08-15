import asyncio
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import get_settings

async def find_free_access_2027():
    settings = get_settings()
    client = AsyncIOMotorClient(settings.mongo_uri)
    db = client[settings.db_name]
    
    # Find all users with 2027 free_access_expires_at
    start_2027 = datetime(2027, 1, 1, tzinfo=timezone.utc)
    end_2027 = datetime(2027, 12, 31, 23, 59, 59, tzinfo=timezone.utc)
    
    users = await db.users.find({
        "free_access_expires_at": {"$gte": start_2027, "$lte": end_2027}
    }).to_list(None)
    
    print(f"Found {len(users)} users with 2027 free_access_expires_at:")
    for user in users:
        print(f"  {user['email']}: {user.get('free_access_expires_at')}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(find_free_access_2027())
