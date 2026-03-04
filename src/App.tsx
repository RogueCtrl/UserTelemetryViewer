import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './index.css';
import { GameMap } from './components/GameMap';
import type { UserState } from './components/Avatar';
import { Activity, ArrowRight } from 'lucide-react';

// Connect to the local backend server
const socket = io('http://localhost:3001');

interface FeedItem {
  id: string;
  userName: string;
  room: string;
  action: string;
  time: string;
  color: string;
}

const App: React.FC = () => {
  const [users, setUsers] = useState<UserState[]>([]);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('gameState', (serverUsers: UserState[]) => {
      setUsers(serverUsers);
    });

    socket.on('userUpdate', (updatedUser: UserState) => {
      setUsers(prev => {
        const exists = prev.find(u => u.id === updatedUser.id);
        if (exists) {
          return prev.map(u => u.id === updatedUser.id ? updatedUser : u);
        }
        return [...prev, updatedUser];
      });

      // Add to activity feed
      setFeed(prev => [{
        id: `${updatedUser.id}_${Date.now()}`,
        userName: updatedUser.name,
        room: updatedUser.activeRoom || 'Unknown',
        action: updatedUser.action || 'Active',
        time: new Date().toLocaleTimeString(),
        color: updatedUser.color
      }, ...prev].slice(0, 30)); // Keep last 30 events
    });

    socket.on('userLeft', (userId: string) => {
      setUsers(prev => prev.filter(u => u.id !== userId));
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('gameState');
      socket.off('userUpdate');
      socket.off('userLeft');
    };
  }, []);

  return (
    <div className="app-container">
      {/* UI Overlay - Header */}
      <header
        className="glass-panel"
        style={{
          position: 'absolute',
          top: 24,
          left: 24,
          padding: '16px 24px',
          zIndex: 100,
          minWidth: '260px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h1 style={{
            fontSize: '1.4rem',
            margin: 0,
            background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Live Actions
          </h1>
          <div style={{
            padding: '4px 8px',
            borderRadius: '12px',
            backgroundColor: isConnected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            color: isConnected ? 'var(--accent-green)' : '#ef4444',
            fontSize: '0.7rem',
            fontWeight: 600,
            animation: isConnected ? 'pulse 2s infinite' : 'none'
          }}>
            {isConnected ? '● LIVE' : '○ OFFLINE'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{users.length}</span> users active
          </p>
        </div>
      </header>

      {/* Activity Feed Sidebar */}
      <aside
        className="glass-panel"
        style={{
          position: 'absolute',
          top: 24,
          right: 24,
          bottom: 24,
          width: '280px',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={16} color="var(--accent-purple)" />
          <h2 style={{ fontSize: '0.9rem', margin: 0, color: 'var(--text-primary)' }}>Activity Feed</h2>
        </div>
        <div ref={feedRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
          {feed.length === 0 && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontStyle: 'italic', textAlign: 'center', marginTop: '24px' }}>
              Waiting for events...
            </p>
          )}
          {feed.map(item => (
            <div key={item.id} style={{
              padding: '8px 10px',
              marginBottom: '6px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.05)',
              animation: 'slideIn 0.3s ease-out',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color, flexShrink: 0 }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.userName}</span>
                <ArrowRight size={10} color="var(--text-secondary)" />
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-blue)' }}>{item.room}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--accent-green)' }}>{item.action}</span>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', opacity: 0.6 }}>{item.time}</span>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Game Map */}
      <GameMap users={users} />
    </div>
  );
};

export default App;
