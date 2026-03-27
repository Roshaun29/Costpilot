import json
from fastapi import WebSocket

active_connections = {}

async def connect(websocket: WebSocket, client_id: str):
    await websocket.accept()
    if client_id not in active_connections:
        active_connections[client_id] = []
    active_connections[client_id].append(websocket)

def disconnect(websocket: WebSocket, client_id: str):
    if client_id in active_connections:
        active_connections[client_id].remove(websocket)
        if not active_connections[client_id]:
            del active_connections[client_id]

async def broadcast_alert(client_id: str, message_data: dict):
    if client_id in active_connections:
        for connection in active_connections[client_id]:
            try:
                await connection.send_text(json.dumps(message_data))
            except Exception:
                pass
