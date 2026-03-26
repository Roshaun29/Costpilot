import asyncio
import os
import sys
from bson import ObjectId

# Need to append Cwd to path
sys.path.append(os.getcwd())

from backend.db.mongodb import connect_to_mongo, get_db

async def run():
    print("Connecting to Mongo...")
    await connect_to_mongo()
    db = get_db()
    if db is None:
        print("Database connection failed")
        return
        
    # Update current user
    user = await db.users.find_one({"email": "final@example.com"})
    if user:
        res = await db.users.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "phone_number": "+919385478140",
                    "notification_prefs.sms": True,
                    "notification_prefs.email": True,
                    "notification_prefs.in_app": True
                }
            }
        )
        print(f"User Final updated: {res.modified_count}")
    else:
        print("User final@example.com not found")
        
    # Close client
    await db.client.close()

if __name__ == "__main__":
    asyncio.run(run())
