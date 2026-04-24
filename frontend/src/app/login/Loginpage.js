'use client';

import { useState } from 'react';
import { login } from '../../lib/api';
import Toast from '../components/Toast';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const data = await login(email, password);
            const user = data.user || {};
            if (user.role === 'staff') {
                window.location.href = '/sell';
            } else if (user.role === 'manager') {
                window.location.href = '/manager/dashboard';
            } else if (user.role === 'delivery') {
                window.location.href = '/delivery';
            } else {
                window.location.href = '/';
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page auth-page">
            <div className="card auth-card">
                <h2>Welcome Back</h2>
                {/* ===== TOAST NOTIFICATION ===== */}
                <Toast 
                    message={error ? { type: 'error', text: error } : null} 
                    onClose={() => setError('')} 
                />
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            required
                        />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                        {loading ? <span className="spinner"></span> : 'Sign In'}
                    </button>
                </form>
                <div className="auth-switch">
                    Don't have an account? <a href="/register">Sign Up</a>
                </div>
            </div>
        </div>
    );
}
