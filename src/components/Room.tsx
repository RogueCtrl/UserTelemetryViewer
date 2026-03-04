import React from 'react';
import { Users } from 'lucide-react';

export interface RoomData {
    id: string;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color?: string;
}

interface RoomProps {
    room: RoomData;
    gridSize?: number;
    occupancy?: number;
}

export const Room: React.FC<RoomProps> = ({ room, gridSize = 40, occupancy = 0 }) => {
    return (
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
    );
};
