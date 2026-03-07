import React from 'react';
import { Users, Flame } from 'lucide-react';

export interface SubRoomData {
    id: string;
    name: string;
    width: number;
    height: number;
    anchor: 'top' | 'right' | 'bottom' | 'left';
    color?: string;
}

export interface RoomData {
    id: string;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color?: string;
    subRooms?: SubRoomData[];
}

interface RoomProps {
    room: RoomData;
    gridSize?: number;
    occupancy?: number;
    subRoomOccupancy?: Record<string, number>;
    viewMode?: 'live' | 'heatmap';
    trafficStats?: Record<string, number>;
    maxTraffic?: number;
}

const getHeatColor = (density: number, maxDensity: number) => {
    if (density === 0) return 'rgba(30, 41, 59, 0.45)';
    const ratio = Math.min(density / maxDensity, 1);
    
    // Scale: Blue (220) -> Cyan -> Green -> Yellow -> Orange -> Red (0)
    // A linear interpolation from Blue (220) to Red (0) in HSL
    const hue = Math.max(0, 220 - (ratio * 220));
    return `hsla(${hue}, 85%, 55%, 0.7)`;
};

function getSubRoomPosition(parent: RoomData, sub: SubRoomData, gridSize: number) {
    const gap = 0.5 * gridSize; // gap between parent and sub-room
    switch (sub.anchor) {
        case 'right':
            return {
                x: (parent.x + parent.width) * gridSize + gap,
                y: parent.y * gridSize,
            };
        case 'bottom':
            return {
                x: parent.x * gridSize,
                y: (parent.y + parent.height) * gridSize + gap,
            };
        case 'left':
            return {
                x: parent.x * gridSize - sub.width * gridSize - gap,
                y: parent.y * gridSize,
            };
        case 'top':
            return {
                x: parent.x * gridSize,
                y: parent.y * gridSize - sub.height * gridSize - gap,
            };
    }
}

function getConnectorLine(parent: RoomData, sub: SubRoomData, gridSize: number) {
    const subPos = getSubRoomPosition(parent, sub, gridSize);
    switch (sub.anchor) {
        case 'right':
            return {
                x1: (parent.x + parent.width) * gridSize,
                y1: (parent.y + 1) * gridSize,
                x2: subPos.x,
                y2: subPos.y + 1 * gridSize,
            };
        case 'bottom':
            return {
                x1: (parent.x + 1) * gridSize,
                y1: (parent.y + parent.height) * gridSize,
                x2: subPos.x + 1 * gridSize,
                y2: subPos.y,
            };
        case 'left':
            return {
                x1: parent.x * gridSize,
                y1: (parent.y + 1) * gridSize,
                x2: subPos.x + sub.width * gridSize,
                y2: subPos.y + 1 * gridSize,
            };
        case 'top':
            return {
                x1: (parent.x + 1) * gridSize,
                y1: parent.y * gridSize,
                x2: subPos.x + 1 * gridSize,
                y2: subPos.y + sub.height * gridSize,
            };
    }
}

export const Room: React.FC<RoomProps> = ({ 
    room, 
    gridSize = 40, 
    occupancy = 0, 
    subRoomOccupancy = {},
    viewMode = 'live',
    trafficStats = {},
    maxTraffic = 1
}) => {
    const isHeatmap = viewMode === 'heatmap';
    const roomTraffic = trafficStats[room.id] || 0;
    const heatmapColor = isHeatmap ? getHeatColor(roomTraffic, maxTraffic) : null;

    return (
        <>
            {/* Main Room */}
            <div
                className="room-box"
                style={{
                    position: 'absolute',
                    top: room.y * gridSize,
                    left: room.x * gridSize,
                    width: room.width * gridSize,
                    height: room.height * gridSize,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: isHeatmap 
                        ? `2px solid ${heatmapColor}`
                        : '2px solid rgba(255, 255, 255, 0.1)',
                    backgroundColor: isHeatmap 
                        ? heatmapColor! 
                        : (room.color || 'rgba(30, 41, 59, 0.65)'),
                    borderRadius: '16px',
                    zIndex: 10,
                    boxShadow: (occupancy > 0 || isHeatmap)
                        ? `0 8px 32px rgba(0, 0, 0, 0.4), inset 0 0 30px ${isHeatmap ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.03)'}`
                        : '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 0 20px rgba(0, 0, 0, 0.2)',
                    backdropFilter: 'blur(8px)',
                    transition: 'all 0.5s ease',
                }}
            >
                <h3 style={{
                    color: 'var(--text-primary)',
                    fontSize: '1rem',
                    fontWeight: 600,
                    textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase'
                }}>
                    {room.name}
                </h3>

                {/* Occupancy / Traffic Badge */}
                {(occupancy > 0 || (isHeatmap && roomTraffic > 0)) && (
                    <div style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        backgroundColor: isHeatmap ? 'rgba(255, 255, 255, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                        border: isHeatmap ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                        fontSize: '0.7rem',
                        color: isHeatmap ? '#fff' : 'var(--accent-green)',
                        fontWeight: 600,
                    }}>
                        {isHeatmap ? <Flame size={10} /> : <Users size={10} />}
                        {isHeatmap ? roomTraffic : occupancy}
                    </div>
                )}
            </div>

            {/* Sub-Rooms */}
            {room.subRooms?.map(sub => {
                const pos = getSubRoomPosition(room, sub, gridSize);
                const connector = getConnectorLine(room, sub, gridSize);
                const subOcc = subRoomOccupancy[sub.id] || 0;
                const subTraffic = trafficStats[sub.id] || 0;
                const subHeatmapColor = isHeatmap ? getHeatColor(subTraffic, maxTraffic) : null;

                return (
                    <React.Fragment key={sub.id}>
                        {/* Connector line */}
                        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 8, pointerEvents: 'none' }}>
                            <line
                                x1={connector.x1} y1={connector.y1}
                                x2={connector.x2} y2={connector.y2}
                                stroke={isHeatmap ? subHeatmapColor! : "rgba(139, 92, 246, 0.2)"}
                                strokeWidth="1.5"
                                strokeDasharray="4 3"
                            />
                        </svg>

                        {/* Sub-room panel */}
                        <div
                            className={`sub-room ${subOcc > 0 ? 'occupied' : ''}`}
                            style={{
                                position: 'absolute',
                                top: pos.y,
                                left: pos.x,
                                width: sub.width * gridSize,
                                height: sub.height * gridSize,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 9,
                                border: isHeatmap 
                                    ? `1px solid ${subHeatmapColor}`
                                    : 'none',
                                backgroundColor: isHeatmap 
                                    ? subHeatmapColor!
                                    : undefined,
                                borderRadius: isHeatmap ? '12px' : '0',
                                backdropFilter: 'blur(6px)',
                                transition: 'all 0.5s ease',
                            }}
                        >
                            <h3 style={{
                                color: 'var(--text-primary)',
                                fontSize: '0.65rem',
                                fontWeight: 500,
                                textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                                opacity: 0.7,
                            }}>
                                {sub.name}
                            </h3>

                            {/* Sub-room occupancy / traffic badge */}
                            {(subOcc > 0 || (isHeatmap && subTraffic > 0)) && (
                                <div style={{
                                    position: 'absolute',
                                    top: 4,
                                    right: 4,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    padding: '2px 6px',
                                    borderRadius: '8px',
                                    backgroundColor: isHeatmap ? 'rgba(255, 255, 255, 0.2)' : 'rgba(139, 92, 246, 0.2)',
                                    border: isHeatmap ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(139, 92, 246, 0.3)',
                                    fontSize: '0.6rem',
                                    color: isHeatmap ? '#fff' : 'var(--accent-purple)',
                                    fontWeight: 600,
                                }}>
                                    {isHeatmap ? <Flame size={8} /> : <Users size={8} />}
                                    {isHeatmap ? subTraffic : subOcc}
                                </div>
                            )}
                        </div>
                    </React.Fragment>
                );
            })}
        </>
    );
};
