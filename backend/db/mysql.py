from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text
from contextlib import asynccontextmanager
from config import settings
import logging
import asyncio

logger = logging.getLogger(__name__)

class Base(DeclarativeBase):
    pass

engine = None
async_session = None
AsyncSessionLocal = None

async def connect_db():
    global engine, AsyncSessionLocal, async_session

    # Retry loop — wait for MySQL to be truly ready (not just accepting connections)
    max_retries = 15
    for attempt in range(max_retries):
        try:
            engine = create_async_engine(
                settings.DATABASE_URL,
                echo=False,
                pool_pre_ping=True,
                pool_recycle=3600,
                pool_size=10,
                max_overflow=20,
            )
            # Test the connection
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            
            async_session = async_sessionmaker(
                engine,
                class_=AsyncSession,
                expire_on_commit=False,
            )
            
            AsyncSessionLocal = async_session # keeping for compatibility
            
            # Create all tables
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            
            logger.info(f"[DB] MySQL connected successfully on attempt {attempt + 1}")
            return engine
            
        except Exception as e:
            wait = 3 * (attempt + 1)
            logger.warning(f"[DB] MySQL connection attempt {attempt + 1}/{max_retries} failed: {e}. Retrying in {wait}s...")
            await asyncio.sleep(wait)
    
    raise RuntimeError("Could not connect to MySQL after multiple retries")

async def close_db():
    global engine
    if engine:
        await engine.dispose()
        logger.info("[DB] MySQL connection closed")

async def get_db():
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

def get_database():
    return async_session
