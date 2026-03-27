# CostPilot — Cloud Cost Anomaly Detection Platform

CostPilot is a production-grade SaaS platform that monitors cloud budgets across AWS, Azure, and GCP using simulated billing data, real-time metrics streaming, and ML-powered anomaly detection.

## Multi-Channel Architecture
CostPilot integrates:
- **WebSocket Streaming**: Live dashboards update directly via server push.
- **ML Anomaly Engine**: APScheduler triggers Isolation Forest and Statistical drift analysis automatically.
- **Alert Dispatch**: Live in-app notifications, full email simulations, and native Twilio SMS integration.
- **AI Triage**: Simulated OpenAI responses format cloud anomalies into plain English remediation steps.

## Live Data System
CostPilot uses WebSocket for real-time metric streaming:
- Connects on login: `ws://localhost:8000/ws/live/{jwt_token}`
- Backend pushes metrics every 1 second when simulation is running
- Charts update live with 60-second rolling window
- Storage meters animate smoothly as values change
- Anomaly toast appears within 1 second of detection

## What the live simulation shows
- **CPU usage**: sine wave oscillation with random noise (realistic load pattern)
- **Memory**: 45-second GC cycle with gradual creep and sudden drops
- **Storage**: Slowly growing (0.001 GB/sec) — watch the bars fill over time
- **Network**: Random traffic spikes simulating real request patterns
- **Cost rate**: Real-time $/hr accumulating into daily total
- **Anomalies**: Randomly injected every 7-14 days (simulation time), immediately triggering alerts

## Setup & Execution (End-to-End)

### Prerequisites
- Python 3.11+
- Node.js 18+
- MongoDB (local or Atlas)

### 1. Backend Service
```bash
cd backend
python -m venv venv
# On Windows: venv\Scripts\activate
# On Linux/Mac: source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env

# Edit .env and ensure MONGODB_URL is correct for your system.
uvicorn main:app --reload --port 8000
```

### 2. Frontend Application
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

### 3. Usage Journey
1. Open `http://localhost:5173`
2. Create an account.
3. Add a cloud account via the dashboard CTA (e.g. AWS, us-east-1, $5000 budget). 
4. The backend will automatically generate 90 days of historical data for the model.
5. The `LiveMetricTicker` will mount on the Topbar, plotting real-time data flow.
6. The ML Simulation Engine will tick in the background. Navigate to Notifications to monitor events as they arrive via WebSocket.

## SMS Alert Setup (Twilio)
CostPilot can immediately push critical anomaly detections to your phone.
1. Create a free Twilio account at twilio.com
2. Get your Account SID and Auth Token from the active console
3. Get a Twilio phone number (free trial includes one)
4. Add to `backend/.env`:
```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_FROM_NUMBER=+15005550006
```
5. Set and save your phone number in CostPilot **Settings → Notifications**, using E.164 format (+1...).
6. Click **Send Test Alert** to verify the end-to-end integration immediately.

*Note: Without Twilio, all app features, Live Toasts, and Simulated Emails work natively.*
