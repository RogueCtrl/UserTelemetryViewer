import React from 'react';
import { TrendingUp, ShoppingCart } from 'lucide-react';

export interface Transaction {
    id: string;
    userId: string;
    userName: string;
    amount: number;
    color: string;
    time: string;
}

interface TransactionPanelProps {
    transactions: Transaction[];
    totalRevenue: number;
    totalUsers: number;
}

export const TransactionPanel: React.FC<TransactionPanelProps> = ({ transactions, totalRevenue, totalUsers }) => {
    const conversionRate = totalUsers > 0
        ? ((transactions.length / totalUsers) * 100).toFixed(1)
        : '0.0';

    return (
        <div
            className="glass-panel"
            style={{
                position: 'absolute',
                bottom: 24,
                left: 24,
                width: '280px',
                zIndex: 100,
                padding: '0',
                overflow: 'hidden',
                border: '1px solid rgba(245, 158, 11, 0.15)',
            }}
        >
            {/* Header */}
            <div style={{
                padding: '14px 16px 10px',
                borderBottom: '1px solid var(--surface-border)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
            }}>
                <ShoppingCart size={16} color="var(--accent-gold)" />
                <h2 style={{ fontSize: '0.9rem', margin: 0, color: 'var(--text-primary)' }}>Transactions</h2>
            </div>

            {/* Revenue Stats */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--surface-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
                    <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Total Revenue
                        </div>
                        <div style={{
                            fontSize: '1.5rem',
                            fontWeight: 700,
                            fontFamily: "'Outfit', sans-serif",
                            color: 'var(--accent-gold)',
                            animation: 'countUp 0.3s ease-out',
                        }}>
                            ${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Conversion
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <TrendingUp size={12} color="var(--accent-green)" />
                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--accent-green)' }}>{conversionRate}%</span>
                        </div>
                    </div>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} from {totalUsers} user{totalUsers !== 1 ? 's' : ''}
                </div>
            </div>

            {/* Recent Transactions List */}
            <div style={{ maxHeight: '180px', overflowY: 'auto', padding: '8px 12px' }}>
                {transactions.length === 0 && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>
                        Waiting for purchases...
                    </p>
                )}
                {transactions.slice(0, 8).map(txn => (
                    <div key={txn.id} style={{
                        padding: '6px 8px',
                        marginBottom: '4px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(245, 158, 11, 0.05)',
                        border: '1px solid rgba(245, 158, 11, 0.08)',
                        animation: 'slideIn 0.3s ease-out',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: txn.color, flexShrink: 0 }} />
                            <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-primary)' }}>{txn.userName}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-gold)' }}>
                                ${txn.amount.toFixed(2)}
                            </span>
                            <span style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', opacity: 0.5 }}>{txn.time}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
