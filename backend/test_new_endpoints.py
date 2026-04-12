import asyncio
import aiohttp

async def test():
    async with aiohttp.ClientSession() as s:
        # Login
        r = await s.post('http://localhost:8000/api/auth/login', json={'email':'test@costpilot.dev','password':'Test@1234'})
        data = await r.json()
        token = data.get('access_token','')
        print('TOKEN:', token[:40] + '...' if token else 'NO TOKEN')
        
        if not token:
            print('LOGIN FAILED:', data)
            return
            
        headers = {'Authorization': f'Bearer {token}'}
        
        # Test forecast
        r2 = await s.get('http://localhost:8000/api/costs/forecast?days=7&window=60', headers=headers)
        d2 = await r2.json()
        print('FORECAST STATUS:', r2.status)
        if r2.status == 200:
            hist = d2['data']['history']
            fore = d2['data']['forecast']
            print(f'  History points: {len(hist)}, Forecast points: {len(fore)}')
            if hist: print(f'  First history: {hist[0]}')
            if fore: print(f'  First forecast: {fore[0]}')
        else:
            print('  ERROR:', str(d2)[:300])
            
        # Test export dataset
        r3 = await s.get('http://localhost:8000/api/export/dataset?format=json&days=30', headers=headers)
        d3 = await r3.json()
        print('EXPORT STATUS:', r3.status, 'count:', d3.get('count', '?'))
        
        # Test evaluate
        r4 = await s.get('http://localhost:8000/api/export/evaluate?days=30', headers=headers)
        d4 = await r4.json()
        print('EVALUATE STATUS:', r4.status)
        if r4.status == 200:
            m = d4['data']['metrics']
            print(f'  Precision={m["precision"]} Recall={m["recall"]} F1={m["f1_score"]}')
        else:
            print('  ERROR:', str(d4)[:300])
        
        # Test insights
        r5 = await s.get('http://localhost:8000/api/insights', headers=headers)
        d5 = await r5.json()
        print('INSIGHTS STATUS:', r5.status, 'count:', len(d5.get('data',[])))
        if d5.get('data'):
            i = d5['data'][0]
            print('  First insight keys:', list(i.keys()))
            print('  insight_type:', i.get('insight_type'))
            print('  headline:', i.get('headline','')[:80])

asyncio.run(test())
