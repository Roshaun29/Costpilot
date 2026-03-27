import json
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        if client_id not in self.active_connections:
            self.active_connections[client_id] = []
        self.active_connections[client_id].append(websocket)

    def disconnect(self, websocket: WebSocket, client_id: str):
        if client_id in self.active_connections:
            if websocket in self.active_connections[client_id]:
                self.active_connections[client_id].remove(websocket)
            if not self.active_connections[client_id]:
                del self.active_connections[client_id]

    async def broadcast(self, client_id: str, message_data: dict):
        if client_id in self.active_connections:
            for connection in self.active_connections[client_id]:
                try:
                    await connection.send_text(json.dumps(message_data))
                except Exception:
                    pass

manager = ConnectionManager()

async def broadcast_anomaly(client_id: str, anomaly_data: dict):
    await manager.broadcast(client_id, anomaly_data)

async def broadcast_live_metrics(client_id: str, message_data: dict):
    await manager.broadcast(client_id, {"type": "live_metrics", **message_data})

async def broadcast_paused(client_id: str):
    await manager.broadcast(client_id, {"type": "simulation_paused"})
