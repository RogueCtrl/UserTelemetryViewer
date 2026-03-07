import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './index.css';
import { GameMap } from './components/GameMap';
import type { UserState } from './components/Avatar';
import type { RoomData } from './components/Room';
import { TransactionPanel, type Transaction } from './components/TransactionPanel';
import { SessionTimeline, type HistoryEntry } from './components/SessionTimeline';
import { Activity, ArrowRight, Clock, Eye, Flame, Search, Filter, X, Globe, Monitor, Home } from 'lucide-react';
import { ReplayControls } from './components/ReplayControls';

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
  const [replayUsers, setReplayUsers] = useState<UserState[]>([]);
  const [replayMode, setReplayMode] = useState(false);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userHistories, setUserHistories] = useState<Record<string, HistoryEntry[]>>({});
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [connections, setConnections] = useState<ConnectionDef[]>([]);
  const [enableTransactions, setEnableTransactions] = useState(true);
  const [viewMode, setViewMode] = useState<'live' | 'heatmap'>('live');
  const [trafficStats, setTrafficStats] = useState<Record<string, number>>({});
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [roomFilter, setRoomFilter] = useState<string>('all');
  const [browserFilter, setBrowserFilter] = useState<string>('all');
  const [osFilter, setOsFilter] = useState<string>('all');
  
  const feedRef = useRef<HTMLDivElement>(null);

  // Helper to map room name to ID
  const getRoomId = (roomName: string, roomsList: RoomData[]) => {
    for (const r of roomsList) {
      if (r.name === roomName) return r.id;
      if (r.subRooms) {
        const sub = r.subRooms.find(s => s.name === roomName);
        if (sub) return sub.id;
      }
    }
    return roomName;
  };

  // Fetch room config on mount
  useEffect(() => {
    fetch('http://localhost:3001/api/rooms')
      .then(res => res.json())
      .then(config => {
        setRooms(config.rooms);
        setConnections(config.connections);
        setEnableTransactions(config.enableTransactions !== false);
      })
      .catch(err => console.error('Failed to load room config:', err));
  }, []);

  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('gameState', (serverUsers: UserState[]) => {
      setUsers(serverUsers);
      // Initialize traffic with current occupancy
      setTrafficStats(prev => {
        const next = { ...prev };
        serverUsers.forEach(u => {
          if (u.activeRoom) {
            const roomId = getRoomId(u.activeRoom, rooms);
            next[roomId] = (next[roomId] || 0) + 1;
          }
        });
        return next;
      });
    });

    socket.on('allHistory', (allHistory: Record<string, HistoryEntry[]>) => {
      setUserHistories(allHistory);
    });

    socket.on('userUpdate', (updatedUser: UserState) => {
      setUsers(prev => {
        const exists = prev.find(u => u.id === updatedUser.id);
        if (exists) {
          // If room changed, increment traffic
          if (updatedUser.activeRoom && exists.activeRoom !== updatedUser.activeRoom) {
            const roomId = getRoomId(updatedUser.activeRoom, rooms);
            setTrafficStats(prevStats => ({
              ...prevStats,
              [roomId]: (prevStats[roomId] || 0) + 1
            }));
          }
          return prev.map(u => u.id === updatedUser.id ? updatedUser : u);
        }
        // New user
        if (updatedUser.activeRoom) {
          const roomId = getRoomId(updatedUser.activeRoom, rooms);
          setTrafficStats(prevStats => ({
            ...prevStats,
            [roomId]: (prevStats[roomId] || 0) + 1
          }));
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

  const selectedUser = selectedUserId ? (replayMode ? replayUsers : users).find(u => u.id === selectedUserId) : null;

  const handleAvatarClick = (userId: string) => {
    setSelectedUserId(prev => prev === userId ? null : userId);
  };

  const displayUsers = replayMode ? replayUsers : users;

  // Filter & Highlight logic
  const uniqueBrowsers = Array.from(new Set(displayUsers.map(u => u.browser).filter(Boolean))) as string[];
  const uniqueOSs = Array.from(new Set(displayUsers.map(u => u.os).filter(Boolean))) as string[];
  const roomNames = Array.from(new Set(rooms.map(r => r.name)));

  const isFiltering = searchQuery !== '' || roomFilter !== 'all' || browserFilter !== 'all' || osFilter !== 'all';

  const highlightedUserIds = new Set<string>();
  const dimmedUserIds = new Set<string>();

  if (isFiltering) {
    displayUsers.forEach(u => {
      const matchesSearch = searchQuery === '' || 
        u.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
        u.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesRoom = roomFilter === 'all' || u.activeRoom === roomFilter;
      const matchesBrowser = browserFilter === 'all' || u.browser === browserFilter;
      const matchesOS = osFilter === 'all' || u.os === osFilter;

      if (matchesSearch && matchesRoom && matchesBrowser && matchesOS) {
        highlightedUserIds.add(u.id);
      } else {
        dimmedUserIds.add(u.id);
      }
    });
  }

  const resetFilters = () => {
    setSearchQuery('');
    setRoomFilter('all');
    setBrowserFilter('all');
    setOsFilter('all');
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{
              fontSize: '1.4rem',
              margin: 0,
              background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Live Actions
            </h1>
            {!replayMode && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => setReplayMode(true)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                >
                  <Clock size={12} />
                  Replay
                </button>

                <button 
                  onClick={() => setViewMode(prev => prev === 'live' ? 'heatmap' : 'live')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    backgroundColor: viewMode === 'heatmap' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.05)',
                    color: viewMode === 'heatmap' ? 'var(--accent-gold)' : 'var(--text-secondary)',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = viewMode === 'heatmap' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(255,255,255,0.1)'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = viewMode === 'heatmap' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.05)'}
                >
                  {viewMode === 'live' ? <Flame size={12} /> : <Eye size={12} />}
                  {viewMode === 'live' ? 'Heatmap' : 'Live View'}
                </button>
              </div>
            )}
          </div>
          {replayMode ? (
            <div style={{
              padding: '4px 8px',
              borderRadius: '12px',
              backgroundColor: 'rgba(245, 158, 11, 0.2)',
              color: 'var(--accent-gold)',
              fontSize: '0.7rem',
              fontWeight: 600,
              animation: 'pulse 2s infinite'
            }}>
              ● REPLAY
            </div>
          ) : (
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
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{displayUsers.length}</span> users {replayMode ? 'visible' : 'active'}
          </p>
        </div>

        {/* Search & Filters */}
        <div style={{ 
          marginTop: '16px', 
          paddingTop: '16px', 
          borderTop: '1px solid var(--surface-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {/* Search Bar */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-secondary)' }} />
            <input 
              type="text" 
              placeholder="Search by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px 8px 32px',
                borderRadius: '8px',
                border: '1px solid var(--surface-border)',
                backgroundColor: 'rgba(0,0,0,0.2)',
                color: 'var(--text-primary)',
                fontSize: '0.75rem',
                outline: 'none',
              }}
            />
            {searchQuery && (
              <X 
                size={14} 
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '10px', color: 'var(--text-secondary)', cursor: 'pointer' }} 
              />
            )}
          </div>

          {/* Filter Controls */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {/* Room Filter */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1, minWidth: '110px' }}>
              <Home size={12} style={{ position: 'absolute', left: '8px', color: roomFilter !== 'all' ? 'var(--accent-blue)' : 'var(--text-secondary)' }} />
              <select 
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px 6px 26px',
                  borderRadius: '6px',
                  border: '1px solid var(--surface-border)',
                  backgroundColor: 'rgba(0,0,0,0.2)',
                  color: roomFilter !== 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: '0.7rem',
                  outline: 'none',
                  appearance: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="all">All Rooms</option>
                {roomNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            {/* Browser Filter */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1, minWidth: '110px' }}>
              <Globe size={12} style={{ position: 'absolute', left: '8px', color: browserFilter !== 'all' ? 'var(--accent-blue)' : 'var(--text-secondary)' }} />
              <select 
                value={browserFilter}
                onChange={(e) => setBrowserFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px 6px 26px',
                  borderRadius: '6px',
                  border: '1px solid var(--surface-border)',
                  backgroundColor: 'rgba(0,0,0,0.2)',
                  color: browserFilter !== 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: '0.7rem',
                  outline: 'none',
                  appearance: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="all">All Browsers</option>
                {uniqueBrowsers.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* OS Filter */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1, minWidth: '110px' }}>
              <Monitor size={12} style={{ position: 'absolute', left: '8px', color: osFilter !== 'all' ? 'var(--accent-blue)' : 'var(--text-secondary)' }} />
              <select 
                value={osFilter}
                onChange={(e) => setOsFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px 6px 26px',
                  borderRadius: '6px',
                  border: '1px solid var(--surface-border)',
                  backgroundColor: 'rgba(0,0,0,0.2)',
                  color: osFilter !== 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: '0.7rem',
                  outline: 'none',
                  appearance: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="all">All OSs</option>
                {uniqueOSs.map(os => (
                  <option key={os} value={os}>{os}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Filter Indicators & Reset */}
          {isFiltering && (
            <button 
              onClick={resetFilters}
              style={{
                width: '100%',
                padding: '6px',
                borderRadius: '6px',
                border: '1px dashed var(--accent-blue)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                color: 'var(--accent-blue)',
                fontSize: '0.7rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)'}
            >
              <X size={12} />
              Clear Filters
            </button>
          )}
        </div>
      </header>

      {/* Replay Controls */}
      {replayMode && (
        <ReplayControls 
          onStateUpdate={setReplayUsers} 
          onClose={() => {
            setReplayMode(false);
            setReplayUsers([]);
          }} 
        />
      )}

      {/* Transaction Panel - Bottom Left (only if enabled) */}
      {enableTransactions && (
        <TransactionPanel
          transactions={transactions}
          totalRevenue={totalRevenue}
          totalUsers={displayUsers.length}
        />
      )}

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
        users={displayUsers}
        rooms={rooms}
        connections={connections}
        onAvatarClick={handleAvatarClick}
        selectedUserId={selectedUserId}
        highlightedUserIds={highlightedUserIds}
        dimmedUserIds={dimmedUserIds}
        viewMode={viewMode}
        trafficStats={trafficStats}
      />
    </div>
  );
};

export default App;
