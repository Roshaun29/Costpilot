import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const eventTypeConfig = {
  "cron_job":      { icon: "⚙", color: "#4AFFD4", label: "Cron job executed on {service}" },
  "cold_start":    { icon: "❄", color: "#4A9FFF", label: "Lambda cold start ({duration}ms)" },
  "network_burst": { icon: "⬆", color: "#FFB84A", label: "Network burst: {rate} Mbps on {service}" },
  "gc_event":      { icon: "🔄", color: "#8A8A9A", label: "GC event — memory released on {service}" },
  "anomaly":       { icon: "🚨", color: "#FF4A6A", label: "ANOMALY: {service} cost spike detected" },
  "sync":          { icon: "🔁", color: "#B6FF4A", label: "Data sync completed — {account}" },
  "scale_out":     { icon: "📈", color: "#FFB84A", label: "Auto-scaling triggered for {service}" },
  "budget_warn":   { icon: "⚠", color: "#FF8A4A", label: "Budget 80% reached on {account}" }
};

const EventFeed = ({ events = [] }) => {
  return (
    <div className="event-feed-container" style={{
      maxHeight: '400px',
      overflowY: 'hidden',
      borderRadius: '12px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-subtle)',
      padding: '16px'
    }}>
      <h3 style={{ 
        fontSize: '11px', 
        textTransform: 'uppercase', 
        letterSpacing: '1.5px', 
        color: 'var(--text-secondary)',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        Real-Time Operations Feed
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#B6FF4A', boxShadow: '0 0 8px #B6FF4A' }}></span>
      </h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <AnimatePresence initial={false}>
          {events.map((event, i) => {
            const config = eventTypeConfig[event.type] || { icon: "ℹ", color: "#8A8A9A", label: event.label };
            const timestamp = event.timestamp ? new Date(event.timestamp).toLocaleTimeString('en-IN', { hour12: false }) : new Date().toLocaleTimeString('en-IN', { hour12: false });
            
            return (
              <motion.div
                key={event.id || event.timestamp + i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  background: 'var(--bg-raised)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '13px'
                }}
              >
                <span style={{ 
                  fontFamily: 'JetBrains Mono, monospace', 
                  fontSize: '10px', 
                  color: 'var(--text-muted)',
                  width: '55px'
                }}>
                  {timestamp}
                </span>
                <span style={{ fontSize: '16px' }}>{config.icon}</span>
                <span style={{ color: 'var(--text-primary)', flex: 1 }}>
                  {config.label
                    .replace('{service}', event.service || '')
                    .replace('{duration}', event.duration || '')
                    .replace('{rate}', event.rate || '')
                    .replace('{account}', event.account || '')}
                </span>
                {event.service && (
                  <span style={{ 
                    fontSize: '10px', 
                    padding: '2px 6px', 
                    borderRadius: '4px', 
                    background: 'var(--bg-overlay)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    {event.service}
                  </span>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
        
        {events.length === 0 && (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px 0', 
            color: 'var(--text-muted)', 
            fontSize: '14px',
            fontStyle: 'italic'
          }}>
            Awaiting live events...
          </div>
        )}
      </div>
    </div>
  );
};

export default EventFeed;
