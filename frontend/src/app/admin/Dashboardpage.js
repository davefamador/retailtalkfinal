'use client';

import { useState, useEffect } from 'react';
import { adminLogin, adminRegister, getStoredAdmin } from '../../lib/api';
import Toast from '../components/Toast';

export default function AdminPage() {
    const [mode, setMode] = useState('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const admin = getStoredAdmin();
        if (admin && admin.role === 'admin') {
            window.location.href = '/admin/dashboard';
        }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            if (mode === 'login') {
                await adminLogin(email, password);
            } else {
                await adminRegister(email, password, fullName);
            }
            window.location.href = '/admin/dashboard';
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
            background: 'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(239,68,68,0.05) 100%)',
        }}>
            <div className="card" style={{ maxWidth: 420, width: '100%', padding: 40 }}>
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{
                        width: 56, height: 56, borderRadius: 14, margin: '0 auto 16px',
                        background: 'linear-gradient(135deg, var(--accent-primary), #818cf8)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 800, fontSize: '1.3rem', color: '#fff',
                    }}>RT</div>
                    <h2 style={{ marginBottom: 6 }}>Admin Panel</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        {mode === 'login' ? 'Sign in to admin dashboard' : 'Create the admin account'}
                    </p>
                </div>

                {/* ===== TOAST NOTIFICATION ===== */}
                <Toast 
                    message={error ? { type: 'error', text: error } : null} 
                    onClose={() => setError('')} 
                />

                <form onSubmit={handleSubmit}>
                    {mode === 'register' && (
                        <div className="form-group">
                            <label>Full Name</label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Admin Name"
                                required
                            />
                        </div>
                    )}
                    <div className="form-group">
                        <label>Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="admin@retailtalk.com"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter password"
                            required
                        />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }} disabled={loading}>
                        {loading ? <span className="spinner"></span> : (mode === 'login' ? 'Sign In as Admin' : 'Create Admin Account')}
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: 20, fontSize: '0.85rem' }}>
                    {mode === 'login' ? (
                        <p style={{ color: 'var(--text-muted)' }}>
                            First time? <button onClick={() => { setMode('register'); setError(''); }} style={{
                                background: 'none', border: 'none', color: 'var(--accent-primary)',
                                cursor: 'pointer', fontWeight: 600, textDecoration: 'underline',
                            }}>Create admin account</button>
                        </p>
                    ) : (
                        <p style={{ color: 'var(--text-muted)' }}>
                            Already have an admin? <button onClick={() => { setMode('login'); setError(''); }} style={{
                                background: 'none', border: 'none', color: 'var(--accent-primary)',
                                cursor: 'pointer', fontWeight: 600, textDecoration: 'underline',
                            }}>Sign in</button>
                        </p>
                    )}
                </div>

                <div style={{ textAlign: 'center', marginTop: 16 }}>
                    <a href="/" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Back to RetailTalk</a>
                </div>
            </div>
        </div>
    );
}
