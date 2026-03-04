import React from 'react';
import { Users } from 'lucide-react';

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
}

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

export const Room: React.FC<RoomProps> = ({ room, gridSize = 40, occupancy = 0, subRoomOccupancy = {} }) => {
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
                    border: '2px solid rgba(255, 255, 255, 0.1)',
                    backgroundColor: room.color || 'rgba(30, 41, 59, 0.65)',
                    borderRadius: '16px',
                    zIndex: 10,
                    boxShadow: occupancy > 0
                        ? '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 0 30px rgba(255, 255, 255, 0.03)'
                        : '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 0 20px rgba(0, 0, 0, 0.2)',
                    backdropFilter: 'blur(8px)',
                    transition: 'box-shadow 0.5s ease, border-color 0.5s ease',
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

                {/* Occupancy Badge */}
                {occupancy > 0 && (
                    <div style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        backgroundColor: 'rgba(16, 185, 129, 0.2)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        fontSize: '0.7rem',
                        color: 'var(--accent-green)',
                        fontWeight: 600,
                    }}>
                        <Users size={10} />
                        {occupancy}
                    </div>
                )}
            </div>

            {/* Sub-Rooms */}
            {room.subRooms?.map(sub => {
                const pos = getSubRoomPosition(room, sub, gridSize);
                const connector = getConnectorLine(room, sub, gridSize);
                const subOcc = subRoomOccupancy[sub.id] || 0;

                return (
                    <React.Fragment key={sub.id}>
                        {/* Connector line */}
                        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 8, pointerEvents: 'none' }}>
                            <line
                                x1={connector.x1} y1={connector.y1}
                                x2={connector.x2} y2={connector.y2}
                                stroke="rgba(139, 92, 246, 0.2)"
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
                                backdropFilter: 'blur(6px)',
                                transition: 'box-shadow 0.5s ease, border-color 0.5s ease',
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

                            {/* Sub-room occupancy badge */}
                            {subOcc > 0 && (
                                <div style={{
                                    position: 'absolute',
                                    top: 4,
                                    right: 4,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    padding: '2px 6px',
                                    borderRadius: '8px',
                                    backgroundColor: 'rgba(139, 92, 246, 0.2)',
                                    border: '1px solid rgba(139, 92, 246, 0.3)',
                                    fontSize: '0.6rem',
                                    color: 'var(--accent-purple)',
                                    fontWeight: 600,
                                }}>
                                    <Users size={8} />
                                    {subOcc}
                                </div>
                            )}
                        </div>
                    </React.Fragment>
                );
            })}
        </>
    );
};
