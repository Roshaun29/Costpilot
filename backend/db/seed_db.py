import asyncio
import os
import sys
from datetime import datetime, timedelta
import bcrypt
from sqlalchemy import select

# Add parent directory to path to allow imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from db.mysql import async_session, engine, Base
from models.sql_models import User, CloudAccount, CostEntry, AnomalyResult, Alert, ActivityLog

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

async def seed_data():
    print("Starting database seeding...")
    
    async with engine.begin() as conn:
        # Recreate tables (Warning: this deletes existing data if using drop_all)
        # await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        # 1. Create Test User
        test_email = "admin@costpilot.com"
        result = await session.execute(select(User).filter_by(email=test_email))
        user = result.scalar_one_or_none()
        
        if not user:
            print(f"Creating user: {test_email}")
            user = User(
                email=test_email,
                full_name="CostPilot Admin",
                hashed_password=hash_password("admin123"),
                phone_number="1234567890",
                notification_prefs={"email": True, "sms": True, "in_app": True},
                alert_threshold_percent=25
            )
            session.add(user)
            await session.flush() # Get user.id
        else:
            print(f"User {test_email} already exists.")

        # 2. Create Cloud Account
        result = await session.execute(select(CloudAccount).filter_by(user_id=user.id, account_id="aws-prod-001"))
        account = result.scalar_one_or_none()
        
        if not account:
            print("Creating AWS Production account...")
            account = CloudAccount(
                user_id=user.id,
                provider="AWS",
                account_id="aws-prod-001",
                account_name="Production Workload",
                is_active=True
            )
            session.add(account)
            await session.flush()
        
        # 3. Create Cost Data (Last 7 days)
        print("Generating 7 days of cost data...")
        for i in range(7):
            date = datetime.utcnow() - timedelta(days=i)
            # Create entries for different services
            services = [
                ("EC2", 450.0 + (i * 20)),
                ("RDS", 120.0),
                ("S3", 85.5),
                ("Lambda", 12.0)
            ]
            for service_name, cost_val in services:
                # Check if exists
                res = await session.execute(select(CostEntry).filter_by(
                    account_id=account.id, 
                    date=date.replace(hour=0, minute=0, second=0, microsecond=0),
                    service=service_name
                ))
                if not res.scalar_one_or_none():
                    entry = CostEntry(
                        user_id=user.id,
                        account_id=account.id,
                        date=date.replace(hour=0, minute=0, second=0, microsecond=0),
                        service=service_name,
                        cost=cost_val,
                        region="us-east-1"
                    )
                    session.add(entry)

        # 4. Create a Sample Anomaly
        print("Creating sample anomaly...")
        anomaly_date = datetime.utcnow() - timedelta(days=1)
        res = await session.execute(select(AnomalyResult).filter_by(account_id=account.id, service="EC2"))
        if not res.scalar_one_or_none():
            anomaly = AnomalyResult(
                user_id=user.id,
                account_id=account.id,
                date=anomaly_date,
                service="EC2",
                actual_cost=850.0,
                expected_cost=465.0,
                is_anomaly=True,
                severity="high",
                status="pending"
            )
            session.add(anomaly)
            
            # 5. Create Alert for the anomaly
            alert = Alert(
                user_id=user.id,
                type="cost_spike",
                title="Critical Cost Spike: EC2",
                message="EC2 costs in Production Workload jumped by 82% over the last 24 hours.",
                severity="high"
            )
            session.add(alert)

        await session.commit()
        print("Seeding complete!")

if __name__ == "__main__":
    asyncio.run(seed_data())
