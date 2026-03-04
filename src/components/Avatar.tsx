import React, { useState } from 'react';
import { User, MousePointerClick, Globe, Monitor } from 'lucide-react';

export interface UserState {
    id: string;
    name: string;
    x: number;
    y: number;
    color: string;
    status: 'idle' | 'moving' | 'active';
    activeRoom?: string;
    action?: string;
    browser?: string;
    os?: string;
    currentUrl?: string;
}

interface AvatarProps {
    user: UserState;
    gridSize?: number;
}

export const Avatar: React.FC<AvatarProps> = ({ user, gridSize = 40 }) => {
    const [isHovered, setIsHovered] = useState(false);

    // Center the avatar in the grid cell
    const pixelX = user.x * gridSize + (gridSize / 2);
    const pixelY = user.y * gridSize + (gridSize / 2);

    return (
        <div
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                transform: `translate(${pixelX}px, ${pixelY}px) translate(-50%, -50%)`,
                transition: 'transform 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                zIndex: 50,
                cursor: 'pointer',
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div
                style={{
                    width: '32px',
                    height: '32px',
                    backgroundColor: user.color,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 0 16px ${user.color}80, inset 0 0 8px rgba(255,255,255,0.3)`,
                    border: '2px solid rgba(255,255,255,0.8)',
                    position: 'relative',
                    animation: user.status === 'moving' ? 'float 0.5s ease-in-out infinite alternate' : 'none',
                    transition: 'box-shadow 0.3s ease',
                }}
            >
                <User size={18} color="#fff" />

                {/* Action Indicator */}
                {user.action && user.action !== 'Page View' && (
                    <div style={{ position: 'absolute', top: -14, right: -14, animation: 'pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' }}>
                        <div className="glass-panel" style={{ padding: '4px', borderRadius: '50%', border: '1px solid var(--accent-green)' }}>
                            <MousePointerClick size={12} color="var(--accent-green)" />
                        </div>
                    </div>
                )}
            </div>

            {/* Hover Tooltip Overlay */}
            {isHovered && (
                <div
                    className="glass-panel"
                    style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: '50%',
                        transform: 'translateX(-50%) translateY(-12px)',
                        padding: '14px 16px',
                        whiteSpace: 'nowrap',
                        zIndex: 100,
                        pointerEvents: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        minWidth: '200px',
                        animation: 'pop 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards'
                    }}
                >
                    {/* User name header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: user.color, boxShadow: `0 0 6px ${user.color}` }} />
                        <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{user.name}</strong>
                    </div>
                    <div style={{ width: '100%', height: '1px', background: 'var(--surface-border)' }} />

                    {/* Room */}
                    {user.activeRoom && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>📍 Room:</span> {user.activeRoom}
                        </span>
                    )}

                    {/* Action */}
                    {user.action && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--accent-green)' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>⚡ Action:</span> {user.action}
                        </span>
                    )}

                    {/* Browser + OS row */}
                    {(user.browser || user.os) && (
                        <div style={{ display: 'flex', gap: '12px', fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {user.browser && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    <Globe size={10} /> {user.browser}
                                </span>
                            )}
                            {user.os && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    <Monitor size={10} /> {user.os}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Current URL */}
                    {user.currentUrl && (
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', opacity: 0.7, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '220px' }}>
                            {user.currentUrl}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

