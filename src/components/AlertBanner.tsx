import React, { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';

interface AlertBannerProps {
  id: string;
  name: string;
  message: string;
  timestamp: number;
  onDismiss: () => void;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({ name, message, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Animate in
    const timer = setTimeout(() => setIsVisible(true), 10);
    
    // Auto-dismiss after 8 seconds
    const dismissTimer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onDismiss, 300); // Wait for fade out animation
    }, 8000);

    return () => {
      clearTimeout(timer);
      clearTimeout(dismissTimer);
    };
  }, [onDismiss]);

  const handleManualDismiss = () => {
    setIsVisible(false);
    setTimeout(onDismiss, 300);
  };

  return (
    <div
      className="glass-panel"
      style={{
        position: 'fixed',
        top: '24px',
        left: '50%',
        transform: `translate(-50%, ${isVisible ? '0' : '-100px'})`,
        opacity: isVisible ? 1 : 0,
        zIndex: 2000,
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        minWidth: '400px',
        maxWidth: '90vw',
        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        borderLeft: '4px solid var(--accent-gold)',
        boxShadow: '0 12px 48px rgba(0, 0, 0, 0.5), 0 0 20px rgba(245, 158, 11, 0.2)',
      }}
    >
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: '10px',
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Bell size={20} color="var(--accent-gold)" className="pulse" />
      </div>
      
      <div style={{ flex: 1 }}>
        <h4 style={{ 
          margin: 0, 
          fontSize: '0.95rem', 
          color: 'var(--text-primary)',
          fontWeight: 600 
        }}>
          {name}
        </h4>
        <p style={{ 
          margin: '2px 0 0', 
          fontSize: '0.85rem', 
          color: 'var(--text-secondary)' 
        }}>
          {message}
        </p>
      </div>

      <button
        onClick={handleManualDismiss}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          padding: '4px',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s',
        }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <X size={18} />
      </button>

      <style dangerouslySetInnerHTML={{ __html: `
        .pulse {
          animation: bellPulse 2s infinite;
        }
        @keyframes bellPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.8; }
        }
      `}} />
    </div>
  );
};
