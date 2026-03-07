import React, { useState, useRef, useEffect, useMemo } from 'react';
import { User, MousePointerClick, Globe, Monitor } from 'lucide-react';
import type { RoomData } from './Room';
import { buildGraph, findPath, getRoomCenter } from '../utils/pathfinding';

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
    purchaseAmount?: number;
}

interface ConnectionDef {
    from: string;
    to: string;
}

interface AvatarProps {
    user: UserState;
    gridSize?: number;
    isSelected?: boolean;
    isDimmed?: boolean;
    isHighlighted?: boolean;
    onClick?: (userId: string) => void;
    rooms?: RoomData[];
    connections?: ConnectionDef[];
}

export const Avatar: React.FC<AvatarProps> = ({ 
    user, 
    gridSize = 40, 
    isSelected, 
    isDimmed,
    isHighlighted,
    onClick, 
    rooms, 
    connections 
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const [displayPos, setDisplayPos] = useState({ x: user.x, y: user.y });
    const [isWalking, setIsWalking] = useState(false);
    const prevRoomRef = useRef<string | undefined>(user.activeRoom);
    const walkTimeoutRef = useRef<number[]>([]);
    const isPurchase = user.action === 'Purchase';

    // Build graph once from rooms + connections
    const graph = useMemo(() => {
        if (!rooms || !connections) return {};
        return buildGraph(connections, rooms);
    }, [rooms, connections]);

    // Build room lookup by name → RoomData
    const roomByName = useMemo(() => {
        const map: Record<string, RoomData & { _isSubRoom?: boolean; _parentId?: string }> = {};
        if (!rooms) return map;
        for (const room of rooms) {
            map[room.name] = room;
            if (room.subRooms) {
                for (const sub of room.subRooms) {
                    // Create a pseudo-RoomData for sub-rooms for center calculation
                    const gap = 0.5;
                    let sx = room.x, sy = room.y;
                    if (sub.anchor === 'right') { sx = room.x + room.width + gap; }
                    else if (sub.anchor === 'bottom') { sy = room.y + room.height + gap; }
                    else if (sub.anchor === 'left') { sx = room.x - sub.width - gap; }
                    else if (sub.anchor === 'top') { sy = room.y - sub.height - gap; }
                    map[sub.name] = { id: sub.id, name: sub.name, x: sx, y: sy, width: sub.width, height: sub.height, _isSubRoom: true, _parentId: room.id } as any;
                }
            }
        }
        return map;
    }, [rooms]);

    // Build room lookup by id → name (for graph lookups)
    const roomNameById = useMemo(() => {
        const map: Record<string, string> = {};
        for (const [name, room] of Object.entries(roomByName)) {
            map[room.id] = name;
        }
        return map;
    }, [roomByName]);

    // Pathfinding + waypoint animation on room change
    useEffect(() => {
        const prevRoom = prevRoomRef.current;
        const newRoom = user.activeRoom;
        prevRoomRef.current = newRoom;

        // Clear any pending walk timeouts
        walkTimeoutRef.current.forEach(t => clearTimeout(t));
        walkTimeoutRef.current = [];

        if (!prevRoom || !newRoom || prevRoom === newRoom || !rooms || !connections) {
            // Same room or no data — jump directly
            setDisplayPos({ x: user.x, y: user.y });
            setIsWalking(false);
            return;
        }

        const prevRoomData = roomByName[prevRoom];
        const newRoomData = roomByName[newRoom];

        if (!prevRoomData || !newRoomData) {
            setDisplayPos({ x: user.x, y: user.y });
            setIsWalking(false);
            return;
        }

        // Find path using room IDs
        const path = findPath(graph, prevRoomData.id, newRoomData.id);

        if (path.length <= 2) {
            // Direct connection or adjacent — just animate directly
            setDisplayPos({ x: user.x, y: user.y });
            setIsWalking(false);
            return;
        }

        // Multi-hop path — animate through intermediate waypoints
        setIsWalking(true);
        const intermediates = path.slice(1, -1); // skip start and end

        intermediates.forEach((roomId, i) => {
            const roomName = roomNameById[roomId];
            const room = roomName ? roomByName[roomName] : null;
            if (!room) return;

            const center = getRoomCenter(room, gridSize);
            // Convert back from pixel to grid coords for display
            const gridX = center.x / gridSize - 0.5;
            const gridY = center.y / gridSize - 0.5;

            const timeoutId = window.setTimeout(() => {
                setDisplayPos({ x: gridX, y: gridY });
            }, (i + 1) * 400);

            walkTimeoutRef.current.push(timeoutId);
        });

        // Final position — server-assigned coordinates
        const finalTimeout = window.setTimeout(() => {
            setDisplayPos({ x: user.x, y: user.y });
            setIsWalking(false);
        }, (intermediates.length + 1) * 400);

        walkTimeoutRef.current.push(finalTimeout);

        return () => {
            walkTimeoutRef.current.forEach(t => clearTimeout(t));
        };
    }, [user.activeRoom, user.x, user.y]);

    // Center the avatar in the grid cell
    const pixelX = displayPos.x * gridSize + (gridSize / 2);
    const pixelY = displayPos.y * gridSize + (gridSize / 2);

    return (
        <div
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                transform: `translate(${pixelX}px, ${pixelY}px) translate(-50%, -50%) ${isHighlighted ? 'scale(1.3)' : 'scale(1)'}`,
                transition: isWalking
                    ? 'transform 0.4s linear'
                    : 'transform 1.2s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.5s ease',
                zIndex: isHighlighted ? 60 : (isSelected ? 55 : 50),
                cursor: 'pointer',
                opacity: isDimmed ? 0.3 : 1,
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={() => onClick?.(user.id)}
        >
            <div
                className={`${isSelected ? 'selected-ring' : ''} ${isHighlighted ? 'highlight-ring' : ''}`}
                style={{
                    width: '32px',
                    height: '32px',
                    backgroundColor: isPurchase ? 'var(--accent-gold)' : user.color,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: isPurchase
                        ? undefined
                        : (isHighlighted 
                            ? `0 0 24px ${user.color}, inset 0 0 8px rgba(255,255,255,0.3)`
                            : `0 0 16px ${user.color}80, inset 0 0 8px rgba(255,255,255,0.3)`),
                    border: isPurchase ? '2px solid rgba(245, 158, 11, 0.8)' : '2px solid rgba(255,255,255,0.8)',
                    position: 'relative',
                    animation: isHighlighted
                        ? 'highlightPulse 1s ease-in-out infinite'
                        : (isPurchase
                            ? 'goldPulse 1.5s ease-in-out infinite'
                            : (isWalking || user.status === 'moving') ? 'float 0.5s ease-in-out infinite alternate' : 'none'),
                    transition: 'background-color 0.3s ease, border-color 0.3s ease, transform 0.3s ease',
                }}
            >
                <User size={18} color="#fff" />

                {/* Floating $ sign for purchase events */}
                {isPurchase && (
                    <div style={{
                        position: 'absolute',
                        top: -8,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        animation: 'dollarRise 1.5s ease-out forwards',
                        pointerEvents: 'none',
                        fontSize: '1.1rem',
                        fontWeight: 800,
                        color: 'var(--accent-gold)',
                        textShadow: '0 0 8px rgba(245, 158, 11, 0.6)',
                    }}>
                        $
                    </div>
                )}

                {/* Action Indicator (non-purchase) */}
                {user.action && user.action !== 'Page View' && !isPurchase && (
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
