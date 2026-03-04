import { Room, type RoomData } from './Room';
import { Avatar, type UserState } from './Avatar';

const ROOMS: RoomData[] = [
    { id: 'login', name: 'Login Portal', x: 2, y: 2, width: 6, height: 4, color: 'rgba(59, 130, 246, 0.15)' },
    { id: 'home', name: 'Landing Page', x: 10, y: 2, width: 8, height: 6 },
    {
        id: 'products', name: 'Product Catalog', x: 10, y: 10, width: 8, height: 6,
        color: 'rgba(139, 92, 246, 0.15)',
        subRooms: [
            { id: 'products_filters', name: 'Filter Panel', width: 4, height: 3, anchor: 'right' },
            { id: 'products_quickview', name: 'Quick View', width: 5, height: 3, anchor: 'bottom' },
        ]
    },
    {
        id: 'checkout', name: 'Checkout Arena', x: 24, y: 10, width: 6, height: 6,
        color: 'rgba(16, 185, 129, 0.15)',
        subRooms: [
            { id: 'checkout_payment', name: 'Payment Form', width: 4, height: 3, anchor: 'bottom' },
        ]
    },
    { id: 'about', name: 'About Us', x: 2, y: 10, width: 6, height: 4 }
];

// Map room labels back to IDs for occupancy counting
const ROOM_LABEL_TO_ID: Record<string, string> = {
    'Login Portal': 'login',
    'Landing Page': 'home',
    'Product Catalog': 'products',
    'Checkout Arena': 'checkout',
    'About Us': 'about',
    'Filter Panel': 'products_filters',
    'Quick View': 'products_quickview',
    'Payment Form': 'checkout_payment',
};

interface GameMapProps {
    users: UserState[];
    onAvatarClick?: (userId: string) => void;
    selectedUserId?: string | null;
}

export const GameMap: React.FC<GameMapProps> = ({ users, onAvatarClick, selectedUserId }) => {
    // Count occupancy per room (including sub-rooms)
    const occupancy: Record<string, number> = {};
    users.forEach(u => {
        if (u.activeRoom) {
            const roomId = ROOM_LABEL_TO_ID[u.activeRoom] || u.activeRoom;
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

    return (
        <div className="map-container">
            {/* Connection paths between rooms */}
            <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 5, pointerEvents: 'none' }}>
                {/* Login -> Landing */}
                <line x1={8 * 40} y1={4 * 40} x2={10 * 40} y2={4 * 40} stroke="rgba(255,255,255,0.06)" strokeWidth="2" strokeDasharray="6 4" />
                {/* Landing -> Products */}
                <line x1={14 * 40} y1={8 * 40} x2={14 * 40} y2={10 * 40} stroke="rgba(255,255,255,0.06)" strokeWidth="2" strokeDasharray="6 4" />
                {/* Products -> Checkout */}
                <line x1={18 * 40} y1={13 * 40} x2={24 * 40} y2={13 * 40} stroke="rgba(255,255,255,0.06)" strokeWidth="2" strokeDasharray="6 4" />
                {/* Login -> About */}
                <line x1={5 * 40} y1={6 * 40} x2={5 * 40} y2={10 * 40} stroke="rgba(255,255,255,0.06)" strokeWidth="2" strokeDasharray="6 4" />
                {/* About -> Products */}
                <line x1={8 * 40} y1={12 * 40} x2={10 * 40} y2={12 * 40} stroke="rgba(255,255,255,0.06)" strokeWidth="2" strokeDasharray="6 4" />
            </svg>

            {ROOMS.map(room => (
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
                />
            ))}
        </div>
    );
};
