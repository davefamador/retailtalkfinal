'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getStoredUser, logout, getBalance, getStoredAdmin, adminLogout } from '../lib/api';
import {
    ShoppingCart, Heart, Package, Truck, User, Sun, Moon,
} from 'lucide-react';

export default function RootLayout({ children }) {
    const [user, setUser] = useState(null);
    const [admin, setAdmin] = useState(null);
    const [balance, setBalance] = useState(null);
    const [hydrated, setHydrated] = useState(false);
    const pathname = usePathname();
    const hideNav = pathname === '/sell' || pathname?.startsWith('/manager') || pathname === '/delivery' || pathname?.startsWith('/admin/dashboard');

    useEffect(() => {
        const storedUser = getStoredUser();
        const storedAdmin = getStoredAdmin();
        document.documentElement.setAttribute('data-theme', 'dark');

        if (storedUser) {
            setUser(storedUser);
            getBalance().then(b => setBalance(b.balance)).catch(() => { });
        }

        if (storedAdmin) {
            setAdmin(storedAdmin);
        }

        setHydrated(true);
    }, []);

    const handleLogout = () => {
        logout();
        setUser(null);
        setBalance(null);
        window.location.href = '/';
    };

    const handleAdminLogout = () => {
        adminLogout();
        setAdmin(null);
        window.location.href = '/admin';
    };

    return (
        <>
            {!hideNav && <nav className="navbar">
                    <a href="/" className="navbar-brand" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img src="/logo.png" alt="RetailTalk Logo" style={{ height: '32px', width: '32px' }} />
                        RetailTalk
                    </a>

                    <div className="navbar-links">
                        {/* Search & Browse: only for buyer, admin, or unauthenticated users */}
                        {(!hydrated || !user || user.role === 'buyer' || admin) && (
                            <>
                                <a href="/search">Search</a>
                                <a href="/products">Browse</a>
                            </>
                        )}

                        {hydrated && (
                            <>
                                {user && user.role === 'staff' && (
                                    <>
                                        <a href="/sell">Products</a>
                                        <a href="/sell/reports">Reports</a>
                                        <a href="/transactions">Order History</a>
                                    </>
                                )}

                                {user && user.role === 'buyer' && (
                                    <>
                                        <a href="/cart" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><ShoppingCart size={16} /> Cart</a>
                                        <a href="/wishlist" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Heart size={16} /> Wishlist</a>
                                        <a href="/orders" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Package size={16} /> Orders</a>
                                        <a href="/transactions">Order History</a>
                                    </>
                                )}

                                {user && user.role === 'manager' && (
                                    <a href="/manager/dashboard" style={{ color: 'var(--accent-warning)' }}>Manager Dashboard</a>
                                )}

                                {user && user.role === 'delivery' && (
                                    <a href="/delivery" style={{ color: 'var(--accent-secondary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Truck size={16} /> Delivery</a>
                                )}

                                {admin && (
                                    <a href="/admin/dashboard" style={{ color: 'var(--accent-danger)' }}>Admin</a>
                                )}
                            </>
                        )}
                    </div>

                    <div className="navbar-user">
                        {hydrated ? (
                            admin ? (
                                <>
                                    <span style={{
                                        color: 'var(--accent-danger)', fontWeight: 'bold', fontSize: '0.85rem',
                                        border: '1px solid var(--accent-danger)', padding: '4px 10px', borderRadius: 20,
                                    }}>
                                        ADMIN
                                    </span>
                                    <button onClick={handleAdminLogout} className="btn btn-outline btn-sm">
                                        Logout
                                    </button>
                                </>
                            ) : user ? (
                                <>
                                    {balance !== null && (
                                        <a href="/wallet" className="navbar-balance" style={{ textDecoration: 'none', color: 'inherit' }}>
                                            PHP {parseFloat(balance).toFixed(2)}
                                        </a>
                                    )}
                                    <a href="/profile" style={{
                                        color: 'var(--text-secondary)', fontSize: '0.85rem',
                                        textDecoration: 'none', padding: '4px 12px', borderRadius: 8,
                                        border: '1px solid var(--border-color)', transition: 'all 0.2s',
                                        fontWeight: 500,
                                    }}
                                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(108,99,255,0.1)'; e.currentTarget.style.color = 'var(--accent-primary)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                    >
                                        <User size={16} style={{ marginRight: 2 }} /> {user.full_name}
                                    </a>
                                    <button onClick={handleLogout} className="btn btn-outline btn-sm">
                                        Logout
                                    </button>
                                </>
                            ) : (
                                <>
                                    <a href="/login" className="btn btn-outline btn-sm">Login</a>
                                    <a href="/register" className="btn btn-primary btn-sm">Sign Up</a>
                                </>
                            )
                        ) : null}
                    </div>
                </nav>}
            {children}
        </>
    );
}
