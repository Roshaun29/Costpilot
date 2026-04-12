import asyncio
import httpx

BASE = "http://127.0.0.1:8000"

async def test():
    async with httpx.AsyncClient(timeout=30) as c:
        # Register first
        r = await c.post(f"{BASE}/api/auth/register", 
            json={"email": "testuser@example.com", "password": "Test1234!", "full_name": "Test User"})
        print("register:", r.status_code, r.text[:300])
        
        # Login
        r = await c.post(f"{BASE}/api/auth/login",
            json={"email": "testuser@example.com", "password": "Test1234!"})
        print("login status:", r.status_code)
        print("login body:", r.text[:500])
        
        if r.status_code == 200:
            data = r.json()
            print("keys:", list(data.keys()))

asyncio.run(test())
