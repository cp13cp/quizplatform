import asyncio
from datetime import datetime, timedelta, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import get_settings

async def fix_subscription():
    settings = get_settings()
    client = AsyncIOMotorClient(settings.mongo_uri)
    db = client[settings.db_name]
    
    # Find all payments
    payments = await db.payments.find({"status": "paid"}).to_list(None)
    
    if not payments:
        print("No paid payments found")
        return
    
    for payment in payments:
        paid_at = payment.get("paid_at")
        if not paid_at:
            print(f"Payment {payment['_id']} has no paid_at date, skipping")
            continue
        
        # Calculate correct expiry: paid_at + 30 days
        new_expiry = paid_at + timedelta(days=30)
        
        print(f"Fixing payment {payment['_id']}")
        print(f"  Old expiry: {payment.get('access_expires_at')}")
        print(f"  New expiry: {new_expiry}")
        
        # Update payment
        await db.payments.update_one(
            {"_id": payment["_id"]},
            {"$set": {"access_expires_at": new_expiry}}
        )
        
        # Update user
        user_id = payment.get("user_id")
        if user_id:
            await db.users.update_one(
                {"_id": user_id},
                {"$set": {"access_expires_at": new_expiry}}
            )
            print(f"  Updated user {user_id}")
    
    client.close()
    print("Done!")

if __name__ == "__main__":
    asyncio.run(fix_subscription())
