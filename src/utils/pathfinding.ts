import type { RoomData } from '../components/Room';

interface ConnectionDef {
    from: string;
    to: string;
}

type Graph = Record<string, string[]>;

/**
 * Build a bidirectional adjacency list from connections.
 * Sub-rooms are connected to their parent room automatically.
 */
export function buildGraph(connections: ConnectionDef[], rooms: RoomData[]): Graph {
    const graph: Graph = {};

    // Initialize all room nodes
    for (const room of rooms) {
        graph[room.id] = [];
        // Connect sub-rooms to parent bidirectionally
        if (room.subRooms) {
            for (const sub of room.subRooms) {
                graph[sub.id] = [room.id];
                graph[room.id].push(sub.id);
            }
        }
    }

    // Add main connections (bidirectional)
    for (const conn of connections) {
        if (graph[conn.from] && !graph[conn.from].includes(conn.to)) {
            graph[conn.from].push(conn.to);
        }
        if (graph[conn.to] && !graph[conn.to].includes(conn.from)) {
            graph[conn.to].push(conn.from);
        }
    }

    return graph;
}

/**
 * BFS shortest path from `fromId` to `toId`.
 * Returns array of room IDs including start and end, or empty if no path.
 */
export function findPath(graph: Graph, fromId: string, toId: string): string[] {
    if (fromId === toId) return [fromId];
    if (!graph[fromId] || !graph[toId]) return [];

    const visited = new Set<string>([fromId]);
    const queue: string[][] = [[fromId]];

    while (queue.length > 0) {
        const path = queue.shift()!;
        const current = path[path.length - 1];

        for (const neighbor of graph[current] || []) {
            if (neighbor === toId) {
                return [...path, neighbor];
            }
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push([...path, neighbor]);
            }
        }
    }

    return []; // no path found
}

/**
 * Get the pixel center of a room.
 */
export function getRoomCenter(room: { x: number; y: number; width: number; height: number }, gridSize: number): { x: number; y: number } {
    return {
        x: (room.x + room.width / 2) * gridSize + gridSize / 2,
        y: (room.y + room.height / 2) * gridSize + gridSize / 2,
    };
}
