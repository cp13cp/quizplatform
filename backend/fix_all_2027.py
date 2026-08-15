import asyncio
from datetime import datetime, timedelta, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import get_settings

async def fix_2027_subscriptions():
    settings = get_settings()
    client = AsyncIOMotorClient(settings.mongo_uri)
    db = client[settings.db_name]
    
    # Find all users with 2027 subscriptions
    start_2027 = datetime(2027, 1, 1, tzinfo=timezone.utc)
    end_2027 = datetime(2027, 12, 31, 23, 59, 59, tzinfo=timezone.utc)
    
    users = await db.users.find({
        "access_expires_at": {"$gte": start_2027, "$lte": end_2027}
    }).to_list(None)
    
    print(f"Fixing {len(users)} users with 2027 subscriptions...")
    
    # Set all to correct date: today + 30 days (Sept 14, 2026)
    correct_expiry = datetime.now(timezone.utc) + timedelta(days=30)
    
    for user in users:
        print(f"  {user['email']}: 2027-08-13 → {correct_expiry}")
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"access_expires_at": correct_expiry}}
        )
    
    print("Done! All subscriptions fixed to 30 days from today.")
    client.close()

if __name__ == "__main__":
    asyncio.run(fix_2027_subscriptions())
