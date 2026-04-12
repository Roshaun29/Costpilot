
import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

async def apply_updates():
    print(f"Connecting to {DATABASE_URL}...")
    engine = create_async_engine(DATABASE_URL)
    
    async with engine.connect() as conn:
        print("\n--- Applying Schema Updates ---")
        
        # 1. Add unique constraint to cloud_accounts
        try:
            await conn.execute(text("ALTER TABLE cloud_accounts ADD UNIQUE KEY uq_user_provider_account (user_id, provider, account_id_simulated);"))
            await conn.commit()
            print("SUCCESS: Added unique constraint to cloud_accounts.")
        except Exception as e:
            if "Duplicate key name" in str(e):
                print("INFO: Unique constraint on cloud_accounts already exists.")
            elif "Duplicate entry" in str(e):
                print("WARNING: Duplicate data found in cloud_accounts! Please manually clean it before adding the constraint.")
            else:
                print(f"ERROR adding constraint: {e}")

        # 2. Rename metadata to meta_data in activity_logs
        try:
            await conn.execute(text("ALTER TABLE activity_logs CHANGE COLUMN metadata meta_data JSON;"))
            await conn.commit()
            print("SUCCESS: Renamed metadata to meta_data in activity_logs.")
        except Exception as e:
            if "Unknown column 'metadata'" in str(e):
                print("INFO: Column 'metadata' in activity_logs already renamed or not found.")
            else:
                print(f"ERROR renaming metadata in activity_logs: {e}")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(apply_updates())
