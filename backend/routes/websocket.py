from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from services.ws_manager import manager
from utils.jwt_utils import verify_token
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Websocket"])

@router.websocket("/ws/live/{token}")
async def websocket_live(websocket: WebSocket, token: str):
    """Authenticated live metrics WebSocket endpoint."""
    try:
        # Authenticate the WebSocket connection
        payload = verify_token(token)
        user_id = payload.get("sub")
        if not user_id:
            logger.warning("[WS] Unauthorized: Missing sub in token")
            await websocket.close(code=4001)
            return
            
        await manager.connect(websocket, user_id)
        logger.info(f"[WS] Authenticated connection: {user_id}")
        
        try:
            while True:
                # Keep connection alive; wait for client messages if any
                data = await websocket.receive_text()
                # Optional: Handle incoming messages
        except WebSocketDisconnect:
            manager.disconnect(websocket, user_id)
            logger.info(f"[WS] Disconnected: {user_id}")
            
    except Exception as e:
        logger.error(f"[WS] Auth/Connection error: {e}")
        await websocket.close(code=4001)
