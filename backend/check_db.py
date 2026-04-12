import asyncio
import os
import sys

# Add project root to sys.path
sys.path.append(os.path.abspath("."))

from db.mysql import async_session, connect_db
from models.user import User
from models.cloud_account import CloudAccount
from models.anomaly import AnomalyResult
from sqlalchemy import select

async def check():
    await connect_db()
    async with async_session() as s:
        # Check users
        res = await s.execute(select(User))
        users = res.scalars().all()
        print(f"Users found: {len(users)}")
        for u in users:
            print(f"  - {u.email} ({u.full_name})")
        
        # Check Cloud Accounts
        res = await s.execute(select(CloudAccount))
        accounts = res.scalars().all()
        print(f"Cloud Accounts found: {len(accounts)}")
        for acc in accounts:
            print(f"  - {acc.name} ({acc.provider})")

        # Check Anomalies
        res = await s.execute(select(AnomalyResult))
        anomalies = res.scalars().all()
        print(f"Anomalies found: {len(anomalies)}")

if __name__ == "__main__":
    asyncio.run(check())
