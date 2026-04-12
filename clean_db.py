
import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

async def clean_and_update():
    print(f"Connecting to {DATABASE_URL}...")
    engine = create_async_engine(DATABASE_URL)
    
    async with engine.connect() as conn:
        print("\n--- Cleaning Cloud Accounts ---")
        # Keep one of each duplicate group
        await conn.execute(text("""
            DELETE t1 FROM cloud_accounts t1
            INNER JOIN cloud_accounts t2 
            WHERE t1.id > t2.id 
            AND t1.user_id = t2.user_id 
            AND t1.provider = t2.provider 
            AND t1.account_id_simulated = t2.account_id_simulated;
        """))
        await conn.commit()
        print("SUCCESS: Cleaned duplicate cloud_accounts.")

        print("\n--- Applying Schema Updates ---")
        try:
            await conn.execute(text("ALTER TABLE cloud_accounts ADD UNIQUE KEY uq_user_provider_account (user_id, provider, account_id_simulated);"))
            await conn.commit()
            print("SUCCESS: Added unique constraint to cloud_accounts.")
        except Exception as e:
            print(f"INFO: {e}")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(clean_and_update())
