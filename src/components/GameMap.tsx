import { Room, type RoomData } from './Room';
import { Avatar, type UserState } from './Avatar';

interface ConnectionDef {
    from: string;
    to: string;
}

interface GameMapProps {
    users: UserState[];
    rooms: RoomData[];
    connections: ConnectionDef[];
    onAvatarClick?: (userId: string) => void;
    selectedUserId?: string | null;
}

export const GameMap: React.FC<GameMapProps> = ({ users, rooms, connections, onAvatarClick, selectedUserId }) => {
    const gridSize = 40;

    // Build label-to-id map dynamically
    const labelToId: Record<string, string> = {};
    rooms.forEach(r => {
        labelToId[r.name] = r.id;
        r.subRooms?.forEach(sub => {
            labelToId[sub.name] = sub.id;
        });
    });

    // Count occupancy per room (including sub-rooms)
    const occupancy: Record<string, number> = {};
    users.forEach(u => {
        if (u.activeRoom) {
            const roomId = labelToId[u.activeRoom] || u.activeRoom;
            occupancy[roomId] = (occupancy[roomId] || 0) + 1;
        }
    });

    // Separate sub-room occupancy for each parent
    const getSubRoomOccupancy = (room: RoomData): Record<string, number> => {
        const subOcc: Record<string, number> = {};
        room.subRooms?.forEach(sub => {
            subOcc[sub.id] = occupancy[sub.id] || 0;
        });
        return subOcc;
    };

    // Compute connection line endpoints from room data
    const roomById: Record<string, RoomData> = {};
    rooms.forEach(r => { roomById[r.id] = r; });

    const getConnectionLine = (conn: ConnectionDef) => {
        const fromRoom = roomById[conn.from];
        const toRoom = roomById[conn.to];
        if (!fromRoom || !toRoom) return null;

        const fromCx = (fromRoom.x + fromRoom.width / 2) * gridSize;
        const fromCy = (fromRoom.y + fromRoom.height / 2) * gridSize;
        const toCx = (toRoom.x + toRoom.width / 2) * gridSize;
        const toCy = (toRoom.y + toRoom.height / 2) * gridSize;

        // Connect from nearest edges
        const dx = toCx - fromCx;
        const dy = toCy - fromCy;

        let x1, y1, x2, y2;
        if (Math.abs(dx) > Math.abs(dy)) {
            // Horizontal connection
            if (dx > 0) {
                x1 = (fromRoom.x + fromRoom.width) * gridSize;
                x2 = toRoom.x * gridSize;
            } else {
                x1 = fromRoom.x * gridSize;
                x2 = (toRoom.x + toRoom.width) * gridSize;
            }
            y1 = fromCy;
            y2 = toCy;
        } else {
            // Vertical connection
            x1 = fromCx;
            x2 = toCx;
            if (dy > 0) {
                y1 = (fromRoom.y + fromRoom.height) * gridSize;
                y2 = toRoom.y * gridSize;
            } else {
                y1 = fromRoom.y * gridSize;
                y2 = (toRoom.y + toRoom.height) * gridSize;
            }
        }

        return { x1, y1, x2, y2 };
    };

    return (
        <div className="map-container">
            {/* Connection paths between rooms — dynamically generated */}
            <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 5, pointerEvents: 'none' }}>
                {connections.map((conn, i) => {
                    const line = getConnectionLine(conn);
                    if (!line) return null;
                    return (
                        <line
                            key={`${conn.from}-${conn.to}-${i}`}
                            x1={line.x1} y1={line.y1}
                            x2={line.x2} y2={line.y2}
                            stroke="rgba(255,255,255,0.06)"
                            strokeWidth="2"
                            strokeDasharray="6 4"
                        />
                    );
                })}
            </svg>

            {rooms.map(room => (
                <Room
                    key={room.id}
                    room={room}
                    occupancy={occupancy[room.id] || 0}
                    subRoomOccupancy={getSubRoomOccupancy(room)}
                />
            ))}
            {users.map(u => (
                <Avatar
                    key={u.id}
                    user={u}
                    isSelected={u.id === selectedUserId}
                    onClick={onAvatarClick}
                    rooms={rooms}
                    connections={connections}
                />
            ))}
        </div>
    );
};
