'use client';

import { useState, useEffect } from 'react';
import { getProfile, updateProfile, getStoredUser } from '../../lib/api';
import Toast from '../components/Toast';

export default function ProfilePage() {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [contactNumber, setContactNumber] = useState('');
    const [deliveryAddress, setDeliveryAddress] = useState('');

    useEffect(() => {
        const user = getStoredUser();
        if (!user) {
            window.location.href = '/login';
            return;
        }
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const data = await getProfile();
            setProfile(data);
            setFullName(data.full_name || '');
            setEmail(data.email || '');
            setContactNumber(data.contact_number || '');
            setDeliveryAddress(data.delivery_address || '');
        } catch (e) {
            setMessage({ type: 'error', text: 'Failed to load profile: ' + e.message });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage({ type: '', text: '' });
        try {
            await updateProfile({ full_name: fullName, email, contact_number: contactNumber, delivery_address: deliveryAddress });
            setMessage({ type: 'success', text: 'Profile updated successfully!' });
            loadProfile();
        } catch (e) {
            setMessage({ type: 'error', text: e.message });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
                <div className="spinner" style={{ width: 40, height: 40 }}></div>
            </div>
        );
    }

    const roleColors = {
        buyer: { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
        seller: { bg: 'rgba(108,99,255,0.12)', color: '#6366f1' },
        delivery: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
    };
    const rc = roleColors[profile?.role] || roleColors.buyer;

    return (
        <div style={{
            minHeight: '100vh', background: 'var(--bg-primary)', paddingTop: 100,
            display: 'flex', justifyContent: 'center', padding: '100px 20px 40px',
        }}>
            <div style={{ width: '100%', maxWidth: 600 }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{
                        width: 80, height: 80, borderRadius: '50%',
                        background: 'var(--gradient-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 16px', fontSize: '2rem', fontWeight: 800, color: 'white',
                    }}>
                        {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 8 }}>
                        My Profile
                    </h1>
                    <span style={{
                        padding: '5px 14px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 700,
                        textTransform: 'capitalize', background: rc.bg, color: rc.color,
                    }}>
                        {profile?.role}
                    </span>
                </div>

                {/* Balance Card */}
                <div style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                    borderRadius: 16, padding: '20px 24px', marginBottom: 24,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                            Balance
                        </p>
                        <p style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>
                            ₱{(profile?.balance || 0).toFixed(2)}
                        </p>
                    </div>
                    <div style={{
                        width: 48, height: 48, borderRadius: 12,
                        background: 'rgba(0,212,170,0.1)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem',
                    }}>
                        💰
                    </div>
                </div>

                {/* ===== TOAST NOTIFICATION ===== */}
                <Toast 
                    message={message} 
                    onClose={() => setMessage({ type: '', text: '' })} 
                />

                {/* Form */}
                <form onSubmit={handleSave} style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                    borderRadius: 16, padding: 28,
                }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>
                        Edit Information
                    </h3>

                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Full Name
                        </label>
                        <input
                            type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                            style={{
                                width: '100%', padding: '12px 16px', borderRadius: 10,
                                border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
                                color: 'var(--text-primary)', fontSize: '0.9rem', fontFamily: 'Inter, sans-serif',
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Email
                        </label>
                        <input
                            type="email" value={email} onChange={e => setEmail(e.target.value)}
                            style={{
                                width: '100%', padding: '12px 16px', borderRadius: 10,
                                border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
                                color: 'var(--text-primary)', fontSize: '0.9rem', fontFamily: 'Inter, sans-serif',
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: 24 }}>
                        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Contact Number
                        </label>
                        <input
                            type="text" value={contactNumber} onChange={e => setContactNumber(e.target.value)}
                            placeholder="09xxxxxxxxx"
                            style={{
                                width: '100%', padding: '12px 16px', borderRadius: 10,
                                border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
                                color: 'var(--text-primary)', fontSize: '0.9rem', fontFamily: 'Inter, sans-serif',
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: 24 }}>
                        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Delivery Address
                        </label>
                        <textarea
                            value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)}
                            placeholder="e.g. 123 Main St, Springfield, IL 62701"
                            rows={3}
                            style={{
                                width: '100%', padding: '12px 16px', borderRadius: 10, resize: 'vertical',
                                border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
                                color: 'var(--text-primary)', fontSize: '0.9rem', fontFamily: 'Inter, sans-serif',
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Member Since
                        </label>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', padding: '12px 0' }}>
                            {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                        </p>
                    </div>

                    <button
                        type="submit" className="btn btn-primary"
                        disabled={saving}
                        style={{
                            width: '100%', padding: '14px 0', fontSize: '0.95rem', fontWeight: 700,
                            borderRadius: 12, marginTop: 8,
                        }}
                    >
                        {saving ? 'Saving...' : '💾 Save Changes'}
                    </button>
                </form>
            </div>
        </div>
    );
}
