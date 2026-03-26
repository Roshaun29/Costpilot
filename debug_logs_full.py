import asyncio
import os
import sys
from bson import ObjectId
from pprint import pprint

# Need to append Cwd to path
sys.path.append(os.getcwd())

from backend.db.mongodb import connect_to_mongo, get_db

async def run():
    print("Connecting to Mongo...")
    await connect_to_mongo()
    db = get_db()
    
    users = await db.users.find({}).to_list(None)
    umap = {str(u["_id"]): u["email"] for u in users}
    
    logs = await db.activity_logs.find({}).sort('timestamp', -1).limit(10).to_list(None)
    for l in logs:
        uid = str(l["user_id"])
        pprint({
            "ts": l["timestamp"],
            "u": umap.get(uid, uid),
            "a": l["action"],
            "e": l["entity_type"]
        })
        
    db.client.close()

if __name__ == "__main__":
    asyncio.run(run())
