import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

/**
 * AnomalyToast — renders a rich custom toast when a new anomaly arrives via WebSocket.
 * Usage: <AnomalyToast newAnomaly={newAnomaly} />
 * Pass `newAnomaly` from your live data hook. The component fires a custom toast whenever
 * the value changes (and is non-null).
 */
export default function AnomalyToast({ newAnomaly }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!newAnomaly) return;

    toast.custom(
      (t) => (
        <AnimatePresence>
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100 }}
            transition={{ type: 'spring', bounce: 0.25, duration: 0.4 }}
            style={{
              background: '#1E1E25',
              border: '1px solid #FF4A6A',
              borderRadius: 12,
              padding: '16px 20px',
              maxWidth: 360,
              cursor: 'pointer',
              boxShadow: '0 0 24px rgba(255,74,106,0.15)'
            }}
            onClick={() => {
              navigate('/anomalies', { state: { selectedAnomalyId: newAnomaly.id || newAnomaly._id } });
              toast.dismiss(t.id);
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <AlertTriangle color="#FF4A6A" size={18} />
              <span style={{ color: '#FF4A6A', fontWeight: 700, fontFamily: 'Syne, sans-serif', fontSize: 14 }}>
                Anomaly Detected
              </span>
              <span style={{ marginLeft: 'auto', color: '#4A4A5A', fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase' }}>
                {newAnomaly.severity}
              </span>
            </div>
            <div style={{ color: '#F5F5F7', fontSize: 14, marginBottom: 4, fontWeight: 500 }}>
              {newAnomaly.service} &middot; {newAnomaly.account_name || 'Cloud Account'}
            </div>
            <div style={{ color: '#8A8A9A', fontSize: 13 }}>
              +{typeof newAnomaly.deviation_percent === 'number' ? newAnomaly.deviation_percent.toFixed(0) : '?'}% above baseline
              {newAnomaly.actual_cost != null && ` · $${Number(newAnomaly.actual_cost).toFixed(2)} actual`}
            </div>
            <div style={{ color: '#B6FF4A', fontSize: 12, marginTop: 8, fontWeight: 600 }}>
              Click to review →
            </div>
          </motion.div>
        </AnimatePresence>
      ),
      { duration: 8000 }
    );
  }, [newAnomaly]);

  return null; // No DOM output — side-effect only
}
