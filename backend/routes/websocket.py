from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.services.ws_manager import manager

router = APIRouter(tags=["Websocket"])

@router.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    try:
        while True:
            # Keep the connection open
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, client_id)
