import React from 'react';
import { Bell, X, Shield, ShieldOff, Clock, AlertTriangle, Zap } from 'lucide-react';

export interface AlertCondition {
  type: 'room_occupancy' | 'conversion_rate' | 'total_users';
  room?: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte';
  value: number;
}

export interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  condition: AlertCondition;
  cooldownMs: number;
  actions: ('browser' | 'webhook')[];
  webhookUrl?: string;
  lastFiredAt?: number;
}

export interface AlertTriggered {
  id: string;
  name: string;
  message: string;
  timestamp: number;
}

interface AlertPanelProps {
  rules: AlertRule[];
  history: AlertTriggered[];
  onToggle: (id: string, enabled: boolean) => void;
  onClose: () => void;
}

export const AlertPanel: React.FC<AlertPanelProps> = ({ rules, history, onToggle, onClose }) => {
  const formatCondition = (condition: AlertCondition) => {
    const opMap = { gt: '>', gte: '>=', lt: '<', lte: '<=' };
    const typeMap = {
      room_occupancy: `Users in ${condition.room}`,
      conversion_rate: 'Conversion rate',
      total_users: 'Total active users'
    };
    return `${typeMap[condition.type]} ${opMap[condition.operator]} ${condition.value}${condition.type === 'conversion_rate' ? '%' : ''}`;
  };

  const formatTime = (ms: number) => {
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <aside
      className="glass-panel"
      style={{
        position: 'absolute',
        top: 24,
        right: 320, // To the left of Activity Feed
        width: '320px',
        maxHeight: 'calc(100vh - 48px)',
        zIndex: 150,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'slideIn 0.3s ease-out',
      }}
    >
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bell size={18} color="var(--accent-gold)" />
          <h2 style={{ fontSize: '1rem', margin: 0, color: 'var(--text-primary)' }}>Threshold Alerts</h2>
        </div>
        <button 
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
        >
          <X size={18} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {/* Rules Section */}
        <section style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Shield size={12} /> Active Rules
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {rules.map(rule => (
              <div key={rule.id} style={{
                padding: '12px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${rule.enabled ? 'rgba(245, 158, 11, 0.2)' : 'var(--surface-border)'}`,
                transition: 'all 0.2s',
                opacity: rule.enabled ? 1 : 0.6
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{rule.name}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{formatCondition(rule.condition)}</div>
                  </div>
                  <button
                    onClick={() => onToggle(rule.id, !rule.enabled)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: rule.enabled ? 'var(--accent-gold)' : 'var(--text-secondary)',
                      transition: 'all 0.2s'
                    }}
                  >
                    {rule.enabled ? <Shield size={18} /> : <ShieldOff size={18} />}
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                    <Clock size={10} /> {rule.cooldownMs / 60000}m
                  </div>
                  {rule.lastFiredAt && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', color: 'var(--accent-gold)' }}>
                      <Zap size={10} /> Last: {formatTime(rule.lastFiredAt)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* History Section */}
        <section>
          <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={12} /> Alert History
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {history.length === 0 && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center', padding: '12px' }}>
                No recent alerts triggered.
              </p>
            )}
            {history.map((alert, index) => (
              <div key={`${alert.id}-${index}`} style={{
                padding: '10px 12px',
                borderRadius: '10px',
                backgroundColor: 'rgba(245, 158, 11, 0.05)',
                borderLeft: '3px solid var(--accent-gold)',
                fontSize: '0.75rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{alert.name}</span>
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>{formatTime(alert.timestamp)}</span>
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>{alert.message}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--surface-border)', fontSize: '0.65rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
        Rule definitions are managed in <code style={{ color: 'var(--accent-blue)' }}>alerts.json</code>
      </div>
    </aside>
  );
};
