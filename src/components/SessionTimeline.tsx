import React from 'react';
import { X, Globe, Monitor, Clock } from 'lucide-react';

export interface HistoryEntry {
    room: string;
    action: string;
    time: string;
    url?: string;
    isPurchase?: boolean;
    amount?: number;
}

interface SessionTimelineProps {
    userName: string;
    userColor: string;
    browser?: string;
    os?: string;
    history: HistoryEntry[];
    onClose: () => void;
}

export const SessionTimeline: React.FC<SessionTimelineProps> = ({ userName, userColor, browser, os, history, onClose }) => {
    return (
        <div
            className="glass-panel"
            style={{
                position: 'absolute',
                top: 24,
                left: 320,
                bottom: 24,
                width: '280px',
                zIndex: 110,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                animation: 'slideInLeft 0.3s ease-out',
                border: `1px solid ${userColor}30`,
            }}
        >
            {/* Header */}
            <div style={{
                padding: '14px 16px',
                borderBottom: '1px solid var(--surface-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: userColor,
                        boxShadow: `0 0 8px ${userColor}`,
                    }} />
                    <h2 style={{ fontSize: '0.9rem', margin: 0, color: 'var(--text-primary)' }}>{userName}</h2>
                </div>
                <button
                    onClick={onClose}
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        color: 'var(--text-secondary)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                    <X size={14} />
                </button>
            </div>

            {/* User Metadata */}
            {(browser || os) && (
                <div style={{
                    padding: '8px 16px',
                    borderBottom: '1px solid var(--surface-border)',
                    display: 'flex',
                    gap: '12px',
                    fontSize: '0.7rem',
                    color: 'var(--text-secondary)',
                }}>
                    {browser && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Globe size={10} /> {browser}
                        </span>
                    )}
                    {os && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Monitor size={10} /> {os}
                        </span>
                    )}
                </div>
            )}

            {/* Journey Header */}
            <div style={{ padding: '10px 16px 4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={12} color="var(--accent-blue)" />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Session Journey ({history.length} events)
                </span>
            </div>

            {/* Timeline */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 16px' }}>
                {history.length === 0 && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontStyle: 'italic', textAlign: 'center', marginTop: '24px' }}>
                        No events recorded yet
                    </p>
                )}
                {history.map((entry, i) => {
                    const isLast = i === history.length - 1;
                    const showRoomChange = i === 0 || entry.room !== history[i - 1].room;

                    return (
                        <div key={i} style={{ display: 'flex', gap: '10px', position: 'relative' }}>
                            {/* Timeline connector line */}
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                width: '16px',
                                flexShrink: 0,
                            }}>
                                <div style={{
                                    width: showRoomChange ? '10px' : '6px',
                                    height: showRoomChange ? '10px' : '6px',
                                    borderRadius: '50%',
                                    backgroundColor: entry.isPurchase ? 'var(--accent-gold)'
                                        : showRoomChange ? userColor
                                            : 'var(--text-secondary)',
                                    border: showRoomChange ? `2px solid ${userColor}60` : 'none',
                                    marginTop: showRoomChange ? '2px' : '5px',
                                    flexShrink: 0,
                                    boxShadow: entry.isPurchase ? '0 0 8px rgba(245, 158, 11, 0.4)' : 'none',
                                }} />
                                {!isLast && (
                                    <div style={{
                                        width: '1.5px',
                                        flex: 1,
                                        minHeight: '12px',
                                        background: `linear-gradient(to bottom, ${userColor}40, transparent)`,
                                    }} />
                                )}
                            </div>

                            {/* Content */}
                            <div style={{
                                paddingBottom: isLast ? 0 : '12px',
                                flex: 1,
                            }}>
                                {showRoomChange && (
                                    <div style={{
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        color: entry.isPurchase ? 'var(--accent-gold)' : 'var(--text-primary)',
                                        marginBottom: '2px',
                                    }}>
                                        {entry.room}
                                    </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{
                                        fontSize: '0.65rem',
                                        color: entry.isPurchase ? 'var(--accent-gold)' : 'var(--accent-green)',
                                    }}>
                                        {entry.isPurchase ? `💲 Purchase $${entry.amount?.toFixed(2)}` : entry.action}
                                    </span>
                                    <span style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', opacity: 0.5 }}>
                                        {entry.time}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
