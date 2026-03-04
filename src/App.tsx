import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './index.css';
import { GameMap } from './components/GameMap';
import type { UserState } from './components/Avatar';
import type { RoomData } from './components/Room';
import { TransactionPanel, type Transaction } from './components/TransactionPanel';
import { SessionTimeline, type HistoryEntry } from './components/SessionTimeline';
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
  isPurchase?: boolean;
  amount?: number;
}

interface ConnectionDef {
  from: string;
  to: string;
}

const App: React.FC = () => {
  const [users, setUsers] = useState<UserState[]>([]);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userHistories, setUserHistories] = useState<Record<string, HistoryEntry[]>>({});
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [connections, setConnections] = useState<ConnectionDef[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);

  // Fetch room config on mount
  useEffect(() => {
    fetch('http://localhost:3001/api/rooms')
      .then(res => res.json())
      .then(config => {
        setRooms(config.rooms);
        setConnections(config.connections);
      })
      .catch(err => console.error('Failed to load room config:', err));
  }, []);

  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('gameState', (serverUsers: UserState[]) => {
      setUsers(serverUsers);
    });

    socket.on('allHistory', (allHistory: Record<string, HistoryEntry[]>) => {
      setUserHistories(allHistory);
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
      const isPurchase = updatedUser.action === 'Purchase';
      setFeed(prev => [{
        id: `${updatedUser.id}_${Date.now()}`,
        userName: updatedUser.name,
        room: updatedUser.activeRoom || 'Unknown',
        action: isPurchase ? `Purchase $${updatedUser.purchaseAmount?.toFixed(2)}` : updatedUser.action || 'Active',
        time: new Date().toLocaleTimeString(),
        color: updatedUser.color,
        isPurchase,
        amount: updatedUser.purchaseAmount,
      }, ...prev].slice(0, 30));
    });

    socket.on('userHistory', ({ userId, history }: { userId: string, history: HistoryEntry[] }) => {
      setUserHistories(prev => ({ ...prev, [userId]: history }));
    });

    socket.on('transaction', (txn: Transaction) => {
      setTransactions(prev => [txn, ...prev].slice(0, 50));
      setTotalRevenue(prev => prev + txn.amount);
    });

    socket.on('userLeft', (userId: string) => {
      setUsers(prev => prev.filter(u => u.id !== userId));
      setUserHistories(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      setSelectedUserId(prev => prev === userId ? null : prev);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('gameState');
      socket.off('allHistory');
      socket.off('userUpdate');
      socket.off('userHistory');
      socket.off('transaction');
      socket.off('userLeft');
    };
  }, []);

  const selectedUser = selectedUserId ? users.find(u => u.id === selectedUserId) : null;

  const handleAvatarClick = (userId: string) => {
    setSelectedUserId(prev => prev === userId ? null : userId);
  };

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

      {/* Transaction Panel - Bottom Left */}
      <TransactionPanel
        transactions={transactions}
        totalRevenue={totalRevenue}
        totalUsers={users.length}
      />

      {/* Session Timeline Panel */}
      {selectedUser && (
        <SessionTimeline
          userName={selectedUser.name}
          userColor={selectedUser.color}
          browser={selectedUser.browser}
          os={selectedUser.os}
          history={userHistories[selectedUserId!] || []}
          onClose={() => setSelectedUserId(null)}
        />
      )}

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
              backgroundColor: item.isPurchase ? 'rgba(245, 158, 11, 0.08)' : 'rgba(255,255,255,0.03)',
              border: item.isPurchase ? '1px solid rgba(245, 158, 11, 0.15)' : '1px solid rgba(255,255,255,0.05)',
              animation: 'slideIn 0.3s ease-out',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.isPurchase ? 'var(--accent-gold)' : item.color, flexShrink: 0 }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.userName}</span>
                <ArrowRight size={10} color="var(--text-secondary)" />
                <span style={{ fontSize: '0.75rem', color: item.isPurchase ? 'var(--accent-gold)' : 'var(--accent-blue)' }}>{item.room}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.65rem', color: item.isPurchase ? 'var(--accent-gold)' : 'var(--accent-green)' }}>
                  {item.isPurchase ? '💲 ' : ''}{item.action}
                </span>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', opacity: 0.6 }}>{item.time}</span>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Game Map */}
      <GameMap
        users={users}
        rooms={rooms}
        connections={connections}
        onAvatarClick={handleAvatarClick}
        selectedUserId={selectedUserId}
      />
    </div>
  );
};

export default App;
