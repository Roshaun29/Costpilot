# CostPilot — Cloud Cost Anomaly Detection Platform

## Overview
CostPilot is a production-grade SaaS platform that monitors cloud costs across AWS, Azure, and GCP using simulated billing data and ML-powered anomaly detection.

## Features
- Real-time cost simulation engine (AWS, Azure, GCP)
- ML anomaly detection (Isolation Forest + Z-Score)
- Multi-channel alerts (SMS via Twilio, Email simulation, In-App)
- AI-generated cost insights
- Interactive dashboards with Recharts
- JWT authentication
- Activity audit logs

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- MongoDB (local or Atlas)

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env — set MONGODB_URL and optionally TWILIO credentials
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

### First Use
1. Open http://localhost:5173
2. Register an account
3. Add a cloud account (AWS/Azure/GCP)
4. Simulation starts automatically — historical data generated instantly
5. Wait 30 seconds for first anomaly detection tick
6. Set your phone number in Settings for SMS alerts

## SMS Alerts (Optional)
Add Twilio credentials to `backend/.env`:
```env
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_FROM_NUMBER=+1xxxxxxxxxx
```
If not configured, alerts are directly rendered in-app only natively.

## Architecture
```text
User → React Frontend → FastAPI Backend → MongoDB
                              ↓
                    Simulation Engine → APScheduler
                              ↓
                    Anomaly Detector (ML) → Alert Service → Twilio/In-App
```
