import asyncio
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import get_settings

async def find_2027_subscriptions():
    settings = get_settings()
    client = AsyncIOMotorClient(settings.mongo_uri)
    db = client[settings.db_name]
    
    # Find all users with 2027 subscriptions (between 2027-01-01 and 2027-12-31)
    start_2027 = datetime(2027, 1, 1, tzinfo=timezone.utc)
    end_2027 = datetime(2027, 12, 31, 23, 59, 59, tzinfo=timezone.utc)
    
    users = await db.users.find({
        "access_expires_at": {"$gte": start_2027, "$lte": end_2027}
    }).to_list(None)
    
    print(f"Found {len(users)} users with 2027 subscriptions:")
    for user in users:
        print(f"  User: {user['email']}")
        print(f"    ID: {user['_id']}")
        print(f"    Expires: {user.get('access_expires_at')}")
        print()
    
    # Also check payments with 2027
    payments = await db.payments.find({
        "access_expires_at": {"$gte": start_2027, "$lte": end_2027}
    }).to_list(None)
    
    print(f"Found {len(payments)} payments with 2027 expiry:")
    for payment in payments:
        print(f"  Payment ID: {payment['_id']}")
        print(f"    User ID: {payment.get('user_id')}")
        print(f"    Paid at: {payment.get('paid_at')}")
        print(f"    Expires: {payment.get('access_expires_at')}")
        print()
    
    client.close()

if __name__ == "__main__":
    asyncio.run(find_2027_subscriptions())
