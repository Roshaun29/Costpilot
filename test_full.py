import asyncio
import httpx

import uuid

BASE = "http://127.0.0.1:8000"
TEST_EMAIL = f"fulltest_{uuid.uuid4().hex[:8]}@example.com"
TEST_PASSWORD = "Test1234!"

async def req(c, method, path, h=None, json=None):
    try:
        kwargs = {}
        if h:
            kwargs["headers"] = h
        if json is not None:
            kwargs["json"] = json
        r = await getattr(c, method)(f"{BASE}{path}", **kwargs)
        return r.status_code, r.text
    except Exception as e:
        return 0, str(e)

async def test():
    results = []
    
    async with httpx.AsyncClient(timeout=60) as c:
        # 1. Health
        code, body = await req(c, "get", "/api/health")
        results.append(("health", code, body))
        
        # 2. Register new user
        code, body = await req(c, "post", "/api/auth/register",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD, "full_name": "Full Test User"})
        results.append(("register", code, body[:100]))
        
        # 3 Login
        code, body = await req(c, "post", "/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
        results.append(("login", code, body[:100]))
        token = ""
        if code == 200:
            import json as json_lib
            d = json_lib.loads(body)
            token = d.get("data", {}).get("token", "")
        
        if not token:
            print("FATAL: No token. Aborting.")
            return
        h = {"Authorization": f"Bearer {token}"}
        
        # 4. Get me
        code, body = await req(c, "get", "/api/auth/me", h=h)
        results.append(("me", code, body[:100]))
        
        # 5. Create cloud account (triggers 90 days historical data gen)
        print("Creating cloud account (this may take ~30s for data generation)...")
        code, body = await req(c, "post", "/api/cloud-accounts", h=h,
            json={"provider": "aws", "account_name": "Test AWS Prod", "region": "us-east-1", "monthly_budget": 5000.0})
        results.append(("create_account", code, body[:150]))
        
        acc_id = None
        if code == 200:
            import json as json_lib
            d = json_lib.loads(body)
            acc_id = d.get("data", {}).get("id")
            print(f"Account created: {acc_id}")
        
        # 6. Get accounts list
        code, body = await req(c, "get", "/api/cloud-accounts", h=h)
        results.append(("list_accounts", code, body[:100]))
        
        # 7. Costs
        code, body = await req(c, "get", "/api/costs", h=h)
        results.append(("costs", code, body[:100]))
        
        # 8. Costs summary
        code, body = await req(c, "get", "/api/costs/summary", h=h)
        results.append(("costs_summary", code, body[:200]))
        
        # 9. Costs services
        code, body = await req(c, "get", "/api/costs/services", h=h)
        results.append(("costs_services", code, body[:100]))
        
        # 10. Simulation status
        code, body = await req(c, "get", "/api/simulation/status", h=h)
        results.append(("sim_status", code, body[:100]))
        
        # 11. Start simulation
        code, body = await req(c, "post", "/api/simulation/start", h=h)
        results.append(("sim_start", code, body[:100]))
        
        # 12. Manual tick (runs anomaly detection)
        print("Running simulation tick...")
        code, body = await req(c, "post", "/api/simulation/tick", h=h)
        results.append(("sim_tick", code, body[:150]))
        
        # 13. Anomaly stats
        code, body = await req(c, "get", "/api/anomalies/stats", h=h)
        results.append(("anomaly_stats", code, body[:100]))
        
        # 14. Anomalies list
        code, body = await req(c, "get", "/api/anomalies", h=h)
        results.append(("anomalies_list", code, body[:100]))
        
        # 15. Alerts
        code, body = await req(c, "get", "/api/alerts", h=h)
        results.append(("alerts", code, body[:100]))
        
        # 16. Unread count
        code, body = await req(c, "get", "/api/alerts/unread-count", h=h)
        results.append(("alerts_unread", code, body[:100]))
        
        # 17. Insights
        print("Generating insights...")
        code, body = await req(c, "get", "/api/insights", h=h)
        results.append(("insights", code, body[:200]))
        
        # 18. Stop simulation
        code, body = await req(c, "post", "/api/simulation/stop", h=h)
        results.append(("sim_stop", code, body[:100]))
        
        # 19. Get settings
        code, body = await req(c, "get", "/api/settings", h=h)
        results.append(("settings_get", code, body[:150]))
        
        # 20. Update settings
        code, body = await req(c, "put", "/api/settings", h=h,
            json={"notif_email": True, "notif_in_app": True, "notif_sms": False, "alert_threshold_percent": 20})
        results.append(("settings_put", code, body[:100]))
        
        # 21. Activity log
        code, body = await req(c, "get", "/api/activity", h=h)
        results.append(("activity", code, body[:100]))
        
        # 22. Sync account
        if acc_id:
            print(f"Syncing account {acc_id}...")
            code, body = await req(c, "post", f"/api/cloud-accounts/{acc_id}/sync", h=h)
            results.append(("account_sync", code, body[:100]))
        
        # 23. Mark all alerts read
        code, body = await req(c, "patch", "/api/alerts/read-all", h=h)
        results.append(("alerts_read_all", code, body[:100]))
        
        # 24. Update me
        code, body = await req(c, "put", "/api/auth/me", h=h,
            json={"full_name": "Full Test User Updated"})
        results.append(("update_me", code, body[:100]))
        
        # 25. Delete cloud account (cleanup)
        if acc_id:
            code, body = await req(c, "delete", f"/api/cloud-accounts/{acc_id}", h=h)
            results.append(("delete_account", code, body[:100]))

    print()
    print("=" * 60)
    print("FULL END-TO-END API TEST RESULTS")
    print("=" * 60)
    ok_count = 0
    fail_count = 0
    for name, code, body in results:
        is_ok = code in (200, 201, 204)
        status = "OK  " if is_ok else "FAIL"
        if is_ok:
            ok_count += 1
        else:
            fail_count += 1
            print(f"[{status}] {name}: HTTP {code} => {body[:80]}")
        if is_ok and name in ("costs_summary", "anomaly_stats", "settings_get"):
            print(f"[{status}] {name}: HTTP {code} => {body[:80]}")
        elif is_ok and name not in ("costs", "insights", "anomalies_list"):
            print(f"[{status}] {name}: HTTP {code}")
        elif is_ok:
            print(f"[{status}] {name}: HTTP {code}")
    print()
    print(f"RESULT: {ok_count} OK / {fail_count} FAIL out of {ok_count + fail_count} tests")
    if fail_count == 0:
        print("ALL TESTS PASSED!")
    else:
        print("SOME TESTS FAILED - review above")

asyncio.run(test())
