import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';

export function useLiveData() {
  const { user, isAuthenticated, token } = useAuthStore();
  const [liveMetrics, setLiveMetrics] = useState({});
  const [chartHistory, setChartHistory] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isRunning, setIsRunning] = useState(true);
  const [events, setEvents] = useState([]);
  const [newAnomaly, setNewAnomaly] = useState(null);
  const wsRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated || !token || !user) return;
    
    // Construct WebSocket URL using the environment variable or fallback
    let wsBaseUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
    
    // Ensure the URL is correctly formatted for the /ws/live/{token} endpoint
    const url = `${wsBaseUrl}/api/ws/live/${token}`;
    
    const connect = () => {
      console.log(`[WS] Connecting to live metrics stream...`);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Connected successfully');
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'live_metrics') {
            // Update individual account metrics
            setLiveMetrics(prev => ({
              ...prev,
              [data.account_id]: data
            }));

            // High-frequency chart history (maintain last 60 points for 1 minute view)
            setChartHistory(prev => {
              const newPoint = {
                time: new Date().toLocaleTimeString('en-IN', { hour12: false }),
                rate: data.total_cost_rate_per_hour,
                cpu: data.cpu_pct,
                id: data.account_id
              };
              const updated = [...prev, newPoint];
              return updated.slice(-60);
            });

            // Handle live operational events
            if (data.events && data.events.length > 0) {
              setEvents(prev => {
                const newEvents = data.events.map(e => ({
                  ...e,
                  timestamp: data.timestamp,
                  account_id: data.account_id
                }));
                return [...newEvents, ...prev].slice(0, 20);
              });
            }
          } 
          else if (data.type === 'new_alert' || data.type === 'new_anomaly') {
            const alertData = data.alert || data;
            setNewAnomaly(alertData);
            setEvents(prev => [{
              type: 'anomaly',
              service: alertData.service || 'Cloud Resource',
              timestamp: new Date().toISOString()
            }, ...prev].slice(0, 20));
          }
          else if (data.type === 'simulation_paused') {
            setIsRunning(false);
          }
        } catch (err) {
          console.error('[WS] Parse error:', err);
        }
      };

      ws.onclose = (event) => {
        console.log(`[WS] Disconnected (code: ${event.code})`);
        setIsConnected(false);
        // Automatic reconnection after 3 seconds unless it's an auth failure
        if (event.code !== 4001) {
          setTimeout(connect, 3000);
        }
      };

      ws.onerror = (err) => {
        console.error('[WS] Connection error');
      };
    };

    connect();

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [user?.id, isAuthenticated, token]);

  return { liveMetrics, chartHistory, isConnected, isRunning, events, newAnomaly, setNewAnomaly };
}
