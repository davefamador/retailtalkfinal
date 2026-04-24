'use client';

import { useState, useEffect } from 'react';
import { getBalance, topUp, withdraw, getSVFHistory, getStoredUser } from '../../lib/api';
import Toast from '../components/Toast';

export default function WalletPage() {
    const [balance, setBalance] = useState(null);
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [authChecked, setAuthChecked] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [svfHistory, setSvfHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [withdrawLoading, setWithdrawLoading] = useState(false);

    useEffect(() => {
        const stored = getStoredUser();
        if (!stored) {
            window.location.href = '/login';
            return;
        }
        setAuthChecked(true);
        loadBalance();
        loadSVFHistory();
    }, []);

    const loadBalance = async () => {
        try {
            const data = await getBalance();
            setBalance(data.balance);
        } catch (err) {
            console.error(err);
        }
    };

    const loadSVFHistory = async () => {
        setHistoryLoading(true);
        try {
            const data = await getSVFHistory();
            setSvfHistory(data);
        } catch (err) {
            console.error(err);
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleTopUp = async (e) => {
        e.preventDefault();
        const val = parseFloat(amount);
        if (!val || val <= 0) return;

        setLoading(true);
        setMessage({ type: '', text: '' });
        try {
            const data = await topUp(val);
            setBalance(data.balance);
            setAmount('');
            setMessage({ type: 'success', text: `Successfully added PHP ${val.toFixed(2)} to your wallet!` });
            loadSVFHistory(); // Refresh SVF history
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setLoading(false);
        }
    };

    const handleWithdraw = async (e) => {
        e.preventDefault();
        const val = parseFloat(withdrawAmount);
        if (!val || val <= 0) return;

        setWithdrawLoading(true);
        setMessage({ type: '', text: '' });
        try {
            const data = await withdraw(val);
            setBalance(data.balance);
            setWithdrawAmount('');
            setMessage({ type: 'success', text: `Successfully withdrew PHP ${val.toFixed(2)} from your wallet.` });
            loadSVFHistory();
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setWithdrawLoading(false);
        }
    };

    const quickAmounts = [100, 500, 1000, 5000];

    // Compute SVF summary
    const totalDeposits = svfHistory.filter(s => s.transaction_type === 'deposit').reduce((sum, s) => sum + s.amount, 0);
    const totalDebits = svfHistory.filter(s => s.transaction_type === 'withdrawal' || s.transaction_type === 'purchase').reduce((sum, s) => sum + s.amount, 0);

    if (!authChecked) {
        return (
            <div className="page">
                <div className="loading-container">
                    <div className="spinner" style={{ width: 40, height: 40 }}></div>
                </div>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="page-header">
                <h1>💰 Wallet</h1>
                <p>Manage your Stored Value Facility</p>
            </div>

            {/* Balance Card */}
            <div className="card" style={{ textAlign: 'center', padding: '48px 24px', marginBottom: 24, background: 'linear-gradient(135deg, var(--card-bg), rgba(99,102,241,0.1))' }}>
                <p style={{ color: 'var(--text-muted)', marginBottom: 8, fontSize: '0.9rem' }}>Current Balance</p>
                <h2 style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>
                    PHP {balance !== null ? parseFloat(balance).toFixed(2) : '...'}
                </h2>
            </div>

            {/* SVF Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                <div className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 4 }}>Total Deposits (Liability)</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>PHP {totalDeposits.toFixed(2)}</p>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 4 }}>Total Spent (Debits)</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444' }}>PHP {totalDebits.toFixed(2)}</p>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 4 }}>Net SVF Balance</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-primary)' }}>PHP {(totalDeposits - totalDebits).toFixed(2)}</p>
                </div>
            </div>

            {/* Top Up */}
            <div className="card" style={{ marginBottom: 24 }}>
                <h3 style={{ marginBottom: 16 }}>➕ Add Funds</h3>
                {/* ===== TOAST NOTIFICATION ===== */}
                <Toast 
                    message={message} 
                    onClose={() => setMessage({ type: '', text: '' })} 
                />
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                    {quickAmounts.map((amt) => (
                        <button
                            key={amt}
                            className="btn btn-outline btn-sm"
                            onClick={() => setAmount(amt.toString())}
                        >
                            PHP {amt}
                        </button>
                    ))}
                </div>
                <form onSubmit={handleTopUp} style={{ display: 'flex', gap: 12 }}>
                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                        <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="Enter amount in PHP"
                            required
                        />
                    </div>
                    <button type="submit" className="btn btn-success" disabled={loading}>
                        {loading ? <span className="spinner"></span> : 'Add Funds'}
                    </button>
                </form>
            </div>

            {/* Withdraw */}
            <div className="card" style={{ marginBottom: 24 }}>
                <h3 style={{ marginBottom: 16 }}>➖ Withdraw Funds</h3>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                    {quickAmounts.map((amt) => (
                        <button
                            key={`w-${amt}`}
                            className="btn btn-outline btn-sm"
                            onClick={() => setWithdrawAmount(amt.toString())}
                        >
                            PHP {amt}
                        </button>
                    ))}
                </div>
                <form onSubmit={handleWithdraw} style={{ display: 'flex', gap: 12 }}>
                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                        <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={withdrawAmount}
                            onChange={(e) => setWithdrawAmount(e.target.value)}
                            placeholder="Enter amount in PHP"
                            required
                        />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ background: '#ef4444', borderColor: '#ef4444' }} disabled={withdrawLoading}>
                        {withdrawLoading ? <span className="spinner"></span> : 'Withdraw Funds'}
                    </button>
                </form>
            </div>

            {/* SVF Transaction History */}
            <div className="card">
                <h3 style={{ marginBottom: 16 }}>📋 SVF Transaction History</h3>
                {historyLoading ? (
                    <div style={{ textAlign: 'center', padding: 24 }}>
                        <div className="spinner" style={{ width: 30, height: 30 }}></div>
                    </div>
                ) : svfHistory.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>No transactions yet. Top up to get started!</p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                                    <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Date</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Type</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600 }}>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {svfHistory.map((entry) => (
                                    <tr key={entry.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                                            {new Date(entry.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td style={{ padding: '10px 12px' }}>
                                            <span style={{
                                                padding: '3px 10px',
                                                borderRadius: 12,
                                                fontSize: '0.8rem',
                                                fontWeight: 600,
                                                background: entry.transaction_type === 'deposit'
                                                    ? 'rgba(16,185,129,0.15)'
                                                    : entry.transaction_type === 'purchase'
                                                    ? 'rgba(245,158,11,0.15)'
                                                    : 'rgba(239,68,68,0.15)',
                                                color: entry.transaction_type === 'deposit'
                                                    ? '#10b981'
                                                    : entry.transaction_type === 'purchase'
                                                    ? '#f59e0b'
                                                    : '#ef4444',
                                            }}>
                                                {entry.transaction_type === 'deposit'
                                                    ? '↑ Deposit'
                                                    : entry.transaction_type === 'purchase'
                                                    ? `🛒 Purchase${entry.metadata?.product_title ? ` — ${entry.metadata.product_title}` : ''}`
                                                    : '↓ Withdrawal'}
                                            </span>
                                        </td>
                                        <td style={{
                                            padding: '10px 12px',
                                            textAlign: 'right',
                                            fontWeight: 700,
                                            color: entry.transaction_type === 'deposit' ? '#10b981' : '#ef4444',
                                        }}>
                                            {entry.transaction_type === 'deposit' ? '+' : '-'}PHP {entry.amount.toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
