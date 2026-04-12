
import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

async def test_db():
    print(f"Connecting to {DATABASE_URL}...")
    engine = create_async_engine(DATABASE_URL)
    
    async with engine.connect() as conn:
        # 1. Check Tables
        print("\n--- Checking Tables ---")
        result = await conn.execute(text("SHOW TABLES;"))
        tables = [row[0] for row in result]
        print(f"Tables: {tables}")
        
        if not tables:
            print("ERROR: No tables found. Database might be empty.")
            return

        # 2. Test Duplicate User
        print("\n--- Testing Duplicate User Registration ---")
        user_email = "test_duplicate@example.com"
        # First, ensure user exists or create them
        await conn.execute(text("INSERT IGNORE INTO users (email, hashed_password, full_name) VALUES (:email, :pwd, :name)"), 
                         {"email": user_email, "pwd": "hashed_password", "name": "Test User"})
        await conn.commit()
        
        try:
            # Try to insert again
            await conn.execute(text("INSERT INTO users (email, hashed_password, full_name) VALUES (:email, :pwd, :name)"), 
                             {"email": user_email, "pwd": "hashed_password", "name": "Test User Duplicate"})
            await conn.commit()
            print("FAILURE: Duplicate user inserted without error!")
        except Exception as e:
            print(f"SUCCESS: Duplicate user rejected as expected: {str(e)[:100]}...")

        # 3. Test Duplicate Cloud Account
        print("\n--- Testing Duplicate Cloud Account ---")
        # Get a user id
        result = await conn.execute(text("SELECT id FROM users LIMIT 1;"))
        user_id = result.scalar()
        
        if user_id:
            provider = "aws"
            account_id_sim = "123456789012"
            # Ensure it exists
            await conn.execute(text("INSERT IGNORE INTO cloud_accounts (user_id, provider, account_id_simulated, account_name) VALUES (:uid, :p, :aid, :name)"),
                             {"uid": user_id, "p": provider, "aid": account_id_sim, "name": "Test AWS Account"})
            await conn.commit()
            
            try:
                await conn.execute(text("INSERT INTO cloud_accounts (user_id, provider, account_id_simulated, account_name) VALUES (:uid, :p, :aid, :name)"),
                                 {"uid": user_id, "p": provider, "aid": account_id_sim, "name": "Duplicate AWS Account"})
                await conn.commit()
                print("FAILURE: Duplicate cloud account inserted without error!")
            except Exception as e:
                print(f"SUCCESS: Duplicate cloud account rejected as expected: {str(e)[:100]}...")
        else:
            print("SKIPPED: No user found to link cloud account.")

        # 4. Test Duplicate Cost Data (Upsert Verification)
        print("\n--- Testing Duplicate Cost Data (Upsert) ---")
        result = await conn.execute(text("SELECT id, user_id FROM cloud_accounts LIMIT 1;"))
        row = result.fetchone()
        
        if row:
            acc_id, user_id_val = row
            service = "EC2"
            cost_date = "2024-01-01"
            # Insert first
            await conn.execute(text("INSERT INTO cost_data (account_id, user_id, service, cost_date, cost_usd) VALUES (:aid, :uid, :s, :d, :c) ON DUPLICATE KEY UPDATE cost_usd = :c"),
                             {"aid": acc_id, "uid": user_id_val, "s": service, "d": cost_date, "c": 100.0})
            await conn.commit()
            
            # Upsert second (different cost)
            await conn.execute(text("INSERT INTO cost_data (account_id, user_id, service, cost_date, cost_usd) VALUES (:aid, :uid, :s, :d, :c) ON DUPLICATE KEY UPDATE cost_usd = :c"),
                             {"aid": acc_id, "uid": user_id_val, "s": service, "d": cost_date, "c": 150.0})
            await conn.commit()
            
            # Verify
            result = await conn.execute(text("SELECT cost_usd FROM cost_data WHERE account_id = :aid AND service = :s AND cost_date = :d"),
                                     {"aid": acc_id, "s": service, "d": cost_date})
            final_cost = result.scalar()
            print(f"Final cost after upsert: {final_cost} (expected 150.0)")
            if final_cost == 150.0:
                print("SUCCESS: Cost data upserted correctly.")
            else:
                print("FAILURE: Cost data not updated correctly.")
        else:
            print("SKIPPED: No cloud account found to link cost data.")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(test_db())
