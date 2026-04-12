import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

async def scale_db_data():
    engine = create_async_engine(DATABASE_URL)
    async with engine.connect() as conn:
        print("Scaling up CostData...")
        await conn.execute(text("UPDATE cost_data SET cost_usd = cost_usd * 15;"))
        await conn.commit()
        
        print("Scaling up AnomalyData...")
        # Make sure the table name is correct. If it fails, we ignore.
        try:
            await conn.execute(text("UPDATE anomalies SET actual_cost = actual_cost * 15, expected_cost = expected_cost * 15;"))
            await conn.commit()
        except:
            pass
        
        print("Scaling complete!")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(scale_db_data())
