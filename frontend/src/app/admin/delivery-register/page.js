'use client';

import { useState, useEffect } from 'react';
import { getStoredAdmin, adminRegisterDelivery } from '../../../lib/api';

export default function DeliveryRegisterPage() {
    const [authChecked, setAuthChecked] = useState(false);
    const [form, setForm] = useState({ fullName: '', email: '', password: '', contactNumber: '' });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        const stored = getStoredAdmin();
        if (!stored || stored.role !== 'admin') {
            window.location.href = '/admin';
            return;
        }
        setAuthChecked(true);
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.fullName || !form.email || !form.password || !form.contactNumber) {
            setMessage({ type: 'error', text: 'All fields are required' });
            return;
        }
        if (form.password.length < 6) {
            setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
            return;
        }
        setLoading(true);
        setMessage({ type: '', text: '' });
        try {
            const res = await adminRegisterDelivery(form.fullName, form.email, form.password, form.contactNumber);
            setMessage({ type: 'success', text: `✅ ${res.message} — ${res.user.full_name} (${res.user.email})` });
            setForm({ fullName: '', email: '', password: '', contactNumber: '' });
        } catch (err) {
            setMessage({ type: 'error', text: err.message || 'Failed to register delivery user' });
        } finally {
            setLoading(false);
        }
    };

    if (!authChecked) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
                <div className="spinner" style={{ width: 40, height: 40 }}></div>
            </div>
        );
    }

    const inputStyle = {
        width: '100%', padding: '12px 16px', borderRadius: 10,
        background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
        color: 'var(--text-primary)', fontSize: '0.9rem',
        fontFamily: 'Inter, sans-serif', outline: 'none',
        transition: 'border-color 0.2s',
    };

    return (
        <div style={{
            minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
            fontFamily: 'Inter, sans-serif',
        }}>
            <div style={{
                width: '100%', maxWidth: 500, background: 'var(--card-bg)',
                borderRadius: 20, border: '1px solid var(--border-color)',
                padding: '40px 36px', position: 'relative',
            }}>
                {/* Back button */}
                <button
                    onClick={() => window.location.href = '/admin/dashboard'}
                    style={{
                        position: 'absolute', top: 20, left: 20,
                        background: 'rgba(108,99,255,0.1)', border: '1px solid rgba(108,99,255,0.2)',
                        color: '#818cf8', borderRadius: 8, padding: '6px 14px',
                        cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                        fontFamily: 'Inter, sans-serif',
                    }}
                >
                    ← Back
                </button>

                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 32, marginTop: 16 }}>
                    <div style={{
                        width: 64, height: 64, borderRadius: '50%', margin: '0 auto 16px',
                        background: 'rgba(16,185,129,0.15)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem',
                    }}>🚚</div>
                    <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 4 }}>Register Deliveryman</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Add a new delivery user to the platform</p>
                </div>

                {/* Message */}
                {message.text && (
                    <div style={{
                        padding: '12px 16px', borderRadius: 10, marginBottom: 20,
                        fontSize: '0.85rem', fontWeight: 600, textAlign: 'center',
                        background: message.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                        border: `1px solid ${message.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                        color: message.type === 'success' ? '#10b981' : '#ef4444',
                    }}>
                        {message.text}
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                            Full Name *
                        </label>
                        <input
                            type="text" placeholder="e.g. Juan Dela Cruz"
                            value={form.fullName}
                            onChange={e => setForm({ ...form, fullName: e.target.value })}
                            style={inputStyle}
                            onFocus={e => e.target.style.borderColor = '#10b981'}
                            onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                            Email Address *
                        </label>
                        <input
                            type="email" placeholder="e.g. juan@example.com"
                            value={form.email}
                            onChange={e => setForm({ ...form, email: e.target.value })}
                            style={inputStyle}
                            onFocus={e => e.target.style.borderColor = '#10b981'}
                            onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                            Password *
                        </label>
                        <input
                            type="password" placeholder="Minimum 6 characters"
                            value={form.password}
                            onChange={e => setForm({ ...form, password: e.target.value })}
                            style={inputStyle}
                            onFocus={e => e.target.style.borderColor = '#10b981'}
                            onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                            Contact Number *
                        </label>
                        <input
                            type="text" placeholder="e.g. 09171234567"
                            value={form.contactNumber}
                            onChange={e => setForm({ ...form, contactNumber: e.target.value })}
                            style={inputStyle}
                            onFocus={e => e.target.style.borderColor = '#10b981'}
                            onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                        />
                    </div>

                    <button
                        type="submit" disabled={loading}
                        style={{
                            width: '100%', padding: '14px', marginTop: 8,
                            borderRadius: 12, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                            background: loading ? 'rgba(16,185,129,0.3)' : 'linear-gradient(135deg, #10b981, #059669)',
                            color: '#fff', fontWeight: 700, fontSize: '0.95rem',
                            fontFamily: 'Inter, sans-serif', transition: 'all 0.2s',
                            opacity: loading ? 0.7 : 1,
                        }}
                    >
                        {loading ? 'Registering...' : '🚚 Register Deliveryman'}
                    </button>
                </form>

                <p style={{
                    textAlign: 'center', marginTop: 20,
                    fontSize: '0.75rem', color: 'var(--text-muted)',
                }}>
                    Name, email, and contact number must each be unique.
                </p>
            </div>
        </div>
    );
}
