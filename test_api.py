import asyncio
import httpx
import json

BASE = "http://127.0.0.1:8000"

async def call(c, method, path, **kwargs):
    try:
        r = await getattr(c, method)(f"{BASE}{path}", **kwargs)
        return r.status_code, r.text[:200]
    except Exception as e:
        return 0, f"ERROR: {e}"

async def test():
    results = []
    
    transport = httpx.AsyncHTTPTransport(retries=3)
    async with httpx.AsyncClient(timeout=30, transport=transport) as c:
        # Step 1: Health
        code, body = await call(c, "get", "/api/health")
        results.append(("health", code, body))
        
        # Step 2: Register
        code, body = await call(c, "post", "/api/auth/register",
            json={"email": "apitest2@example.com", "password": "Test1234!", "full_name": "API Test"})
        results.append(("register", code, body))
        
        # Step 3: Login (should work even if register returned 400 - user already exists)
        code, body = await call(c, "post", "/api/auth/login",
            json={"email": "apitest2@example.com", "password": "Test1234!"})
        results.append(("login", code, body))
        
        token = ""
        if code == 200:
            data = json.loads(body[:200] if len(body) <= 200 else body)
        
        # Full login to get token
        r = await c.post(f"{BASE}/api/auth/login",
            json={"email": "apitest2@example.com", "password": "Test1234!"})
        
        if r.status_code == 200:
            resp_json = r.json()
            token = resp_json.get("data", {}).get("token", "")
        
        if not token:
            results.append(("TOKEN", 0, "FAILED: No token from login"))
        else:
            results.append(("TOKEN", 200, f"Got token: {token[:30]}..."))
        
        h = {"Authorization": f"Bearer {token}"}
        
        # Step 4: Get me
        code, body = await call(c, "get", "/api/auth/me", headers=h)
        results.append(("get_me", code, body))
        
        # Step 5: Get accounts
        code, body = await call(c, "get", "/api/cloud-accounts", headers=h)
        results.append(("get_accounts", code, body))
        
        # Step 6: Create account
        acc_id = None
        r2 = await c.post(f"{BASE}/api/cloud-accounts",
            json={"provider": "aws", "account_name": "Test AWS Account", "region": "us-east-1", "monthly_budget": 5000.0},
            headers=h)
        results.append(("create_account", r2.status_code, r2.text[:200]))
        if r2.status_code == 200:
            try:
                acc_id = r2.json().get("data", {}).get("id")
            except:
                pass
        
        # Step 7: Get costs
        code, body = await call(c, "get", "/api/costs", headers=h)
        results.append(("get_costs", code, body))
        
        # Step 8: Summary
        code, body = await call(c, "get", "/api/costs/summary", headers=h)
        results.append(("costs_summary", code, body))
        
        # Step 9: Services
        code, body = await call(c, "get", "/api/costs/services", headers=h)
        results.append(("costs_services", code, body))
        
        # Step 10: Anomalies stats
        code, body = await call(c, "get", "/api/anomalies/stats", headers=h)
        results.append(("anomaly_stats", code, body))
        
        # Step 11: Anomalies
        code, body = await call(c, "get", "/api/anomalies", headers=h)
        results.append(("anomalies", code, body))
        
        # Step 12: Alerts
        code, body = await call(c, "get", "/api/alerts", headers=h)
        results.append(("alerts", code, body))
        
        # Step 13: Unread
        code, body = await call(c, "get", "/api/alerts/unread-count", headers=h)
        results.append(("alerts_unread", code, body))
        
        # Step 14: Insights
        code, body = await call(c, "get", "/api/insights", headers=h)
        results.append(("insights", code, body[:150]))
        
        # Step 15: Simulation status
        code, body = await call(c, "get", "/api/simulation/status", headers=h)
        results.append(("sim_status", code, body))
        
        # Step 16: Start sim
        code, body = await call(c, "post", "/api/simulation/start", headers=h)
        results.append(("sim_start", code, body))
        
        # Step 17: Stop sim
        code, body = await call(c, "post", "/api/simulation/stop", headers=h)
        results.append(("sim_stop", code, body))
        
        # Step 18: Get settings
        code, body = await call(c, "get", "/api/settings", headers=h)
        results.append(("settings_get", code, body))
        
        # Step 19: Update settings
        code, body = await call(c, "put", "/api/settings",
            json={"notif_email": True, "notif_in_app": True, "alert_threshold_percent": 20},
            headers=h)
        results.append(("settings_put", code, body))
        
        # Step 20: Activity
        code, body = await call(c, "get", "/api/activity", headers=h)
        results.append(("activity", code, body))
        
        # Step 21: Sync account
        if acc_id:
            code, body = await call(c, "post", f"/api/cloud-accounts/{acc_id}/sync", headers=h)
            results.append(("account_sync", code, body[:100]))
        
        # Step 22: Manual tick
        code, body = await call(c, "post", "/api/simulation/tick", headers=h)
        results.append(("sim_tick", code, body))
        
        # Step 23: Delete account (cleanup)
        if acc_id:
            code, body = await call(c, "delete", f"/api/cloud-accounts/{acc_id}", headers=h)
            results.append(("delete_account", code, body))

    print("\n=== FULL API TEST RESULTS ===")
    ok_count = 0
    fail_count = 0
    for name, code, body in results:
        ok = code in (200, 204)
        status = "✅ OK" if ok else "❌ FAIL"
        if ok: ok_count += 1
        else: fail_count += 1
        print(f"[{status}] {name}: HTTP {code}")
        if not ok:
            print(f"         Body: {body[:120]}")
    
    print(f"\n✅ {ok_count} OK | ❌ {fail_count} FAIL")

asyncio.run(test())
