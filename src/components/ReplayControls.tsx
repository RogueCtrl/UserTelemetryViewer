import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, ChevronRight, Calendar } from 'lucide-react';

interface ReplayEvent {
  timestamp: number;
  id: string;
  name: string;
  x: number;
  y: number;
  activeRoom: string;
  action: string;
  color: string;
  browser: string;
  os: string;
  currentUrl: string;
  purchaseAmount?: number;
}

interface ReplayControlsProps {
  onStateUpdate: (users: any[]) => void;
  onClose: () => void;
}

export const ReplayControls: React.FC<ReplayControlsProps> = ({ onStateUpdate, onClose }) => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [events, setEvents] = useState<ReplayEvent[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize time range
  useEffect(() => {
    fetch('http://localhost:3001/api/replay/range')
      .then(res => res.json())
      .then(data => {
        if (data.earliest && data.latest) {
          // Format for datetime-local: YYYY-MM-DDTHH:mm
          const format = (ms: number) => {
            const d = new Date(ms);
            return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
          };
          setFrom(format(data.earliest));
          setTo(format(data.latest));
        }
      });
  }, []);

  const loadEvents = async () => {
    setIsLoading(true);
    const fromTs = new Date(from).getTime();
    const toTs = new Date(to).getTime();
    
    try {
      const res = await fetch(`http://localhost:3001/api/replay/events?from=${fromTs}&to=${toTs}`);
      const data = await res.json();
      setEvents(data);
      setCurrentIndex(-1);
      setIsPlaying(false);
    } catch (err) {
      console.error('Failed to load replay events:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const updateState = (index: number) => {
    if (index < 0) {
      onStateUpdate([]);
      return;
    }

    const currentTimestamp = events[index].timestamp;
    const userMap: Record<string, any> = {};
    
    // Build state up to current index
    for (let i = 0; i <= index; i++) {
      const event = events[i];
      // Only keep user if their last event was within 2 minutes of current replay time
      if (currentTimestamp - event.timestamp < 120000) {
        userMap[event.id] = event;
      } else {
        delete userMap[event.id];
      }
    }
    
    onStateUpdate(Object.values(userMap));
  };

  useEffect(() => {
    if (isPlaying && currentIndex < events.length - 1) {
      const nextIndex = currentIndex + 1;
      const currentTs = currentIndex === -1 ? events[0].timestamp : events[currentIndex].timestamp;
      const nextTs = events[nextIndex].timestamp;
      
      const delay = Math.max(0, (nextTs - currentTs) / playbackSpeed);
      
      timerRef.current = setTimeout(() => {
        setCurrentIndex(nextIndex);
        updateState(nextIndex);
      }, delay);
    } else if (currentIndex >= events.length - 1) {
      setIsPlaying(false);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, currentIndex, events, playbackSpeed]);

  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setCurrentIndex(val);
    updateState(val);
  };

  const togglePlay = () => {
    if (currentIndex >= events.length - 1) {
      setCurrentIndex(-1);
    }
    setIsPlaying(!isPlaying);
  };

  const stopReplay = () => {
    setIsPlaying(false);
    setCurrentIndex(-1);
    updateState(-1);
    onClose();
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString() + ' ' + new Date(ts).toLocaleDateString();
  };

  return (
    <div className="glass-panel" style={{
      position: 'absolute',
      bottom: 24,
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '20px 32px',
      zIndex: 1000,
      width: '800px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            padding: '4px 10px',
            borderRadius: '12px',
            backgroundColor: 'rgba(245, 158, 11, 0.2)',
            color: 'var(--accent-gold)',
            fontSize: '0.75rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-gold)', animation: 'pulse 1s infinite' }} />
            HISTORICAL REPLAY
          </div>
          {currentIndex >= 0 && (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
              {formatTime(events[currentIndex].timestamp)}
            </span>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <div className="speed-selector" style={{ display: 'flex', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '2px' }}>
            {[1, 5, 10, 50].map(speed => (
              <button
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                style={{
                  padding: '4px 8px',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: playbackSpeed === speed ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: playbackSpeed === speed ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'all 0.2s'
                }}
              >
                {speed}x
              </button>
            ))}
          </div>
          <button 
            onClick={stopReplay}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.1)',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Square size={14} fill="#ef4444" />
            Stop
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <Calendar size={14} color="var(--text-secondary)" />
          <input 
            type="datetime-local" 
            value={from} 
            onChange={e => setFrom(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--surface-border)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              padding: '4px 8px',
              fontSize: '0.8rem',
              outline: 'none'
            }}
          />
          <ChevronRight size={14} color="var(--text-secondary)" />
          <input 
            type="datetime-local" 
            value={to} 
            onChange={e => setTo(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--surface-border)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              padding: '4px 8px',
              fontSize: '0.8rem',
              outline: 'none'
            }}
          />
        </div>
        <button 
          onClick={loadEvents}
          disabled={isLoading}
          style={{
            padding: '8px 20px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: 'var(--accent-blue)',
            color: 'white',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: isLoading ? 'wait' : 'pointer',
            opacity: isLoading ? 0.7 : 1,
            transition: 'all 0.2s'
          }}
        >
          {isLoading ? 'Loading...' : 'Load Events'}
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button 
          onClick={togglePlay}
          disabled={events.length === 0}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: isPlaying ? 'rgba(255,255,255,0.1)' : 'var(--accent-green)',
            color: isPlaying ? 'var(--text-primary)' : 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: events.length === 0 ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            opacity: events.length === 0 ? 0.5 : 1
          }}
        >
          {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" style={{ marginLeft: '2px' }} />}
        </button>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <input 
            type="range"
            min="-1"
            max={events.length - 1}
            value={currentIndex}
            onChange={handleScrubberChange}
            disabled={events.length === 0}
            style={{
              width: '100%',
              accentColor: 'var(--accent-blue)',
              cursor: events.length === 0 ? 'not-allowed' : 'pointer'
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
            <span>{events.length > 0 ? 'Start' : 'No events loaded'}</span>
            <span>{events.length > 0 ? `${currentIndex + 1} / ${events.length}` : ''}</span>
            <span>{events.length > 0 ? 'End' : ''}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
