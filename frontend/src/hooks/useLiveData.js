import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useSimulationStore } from '../store/simulationStore';

export function useLiveData() {
  const [newAnomaly, setNewAnomaly] = useState(null);
  const { user, isAuthenticated } = useAuthStore();
  const { handleWsEvent } = useSimulationStore();
  const [liveMetrics, setLiveMetrics] = useState(null);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    
    // Connect to websocket, using the current host but ws protocol
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Use localhost:8000 in dev, or relative url if deployed behind proxy
    const host = process.env.NODE_ENV === 'development' ? 'localhost:8000' : window.location.host;
    const ws = new WebSocket(`${protocol}//${host}/api/ws/${user.id}`);
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'new_anomaly') {
            setNewAnomaly(data);
        } else if (data.type === 'simulation_paused' || data.type === 'live_metrics') {
            handleWsEvent(data);
            if (data.type === 'live_metrics') {
                setLiveMetrics(data);
            }
        }
      } catch (err) {
        console.error('WebSocket Error parsing message:', err);
      }
    };

    return () => {
      ws.close();
    };
  }, [user, isAuthenticated, handleWsEvent]);

  return { newAnomaly, liveMetrics };
}
