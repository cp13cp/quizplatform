import asyncio
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import get_settings

async def check_all_users_access():
    settings = get_settings()
    client = AsyncIOMotorClient(settings.mongo_uri)
    db = client[settings.db_name]
    
    # Get all users
    users = await db.users.find({}).to_list(None)
    
    now = datetime.now(timezone.utc)
    
    print(f"Total users: {len(users)}\n")
    print("Users with active access:")
    print("-" * 70)
    
    active_count = 0
    for user in users:
        access_expires = user.get('access_expires_at')
        if access_expires and access_expires > now:
            active_count += 1
            remaining = (access_expires - now).days
            print(f"  {user['email']}: Active until {access_expires} ({remaining} days left)")
    
    print(f"\nTotal with active access: {active_count}")
    
    print("\n\nUsers with EXPIRED or NO access:")
    print("-" * 70)
    
    for user in users:
        access_expires = user.get('access_expires_at')
        if not access_expires or access_expires <= now:
            status = "No access" if not access_expires else f"Expired: {access_expires}"
            print(f"  {user['email']}: {status}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_all_users_access())
