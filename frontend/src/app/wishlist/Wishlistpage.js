'use client';

import { useState, useEffect } from 'react';
import { getWishlist, removeFromWishlist, getStoredUser } from '../../lib/api';
import { Heart, Package } from 'lucide-react';

export default function Wishlistpage() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [removing, setRemoving] = useState(null);

    useEffect(() => {
        const stored = getStoredUser();
        if (!stored || stored.role !== 'buyer') {
            window.location.href = '/login';
            return;
        }
        loadWishlist();
    }, []);

    const loadWishlist = async () => {
        try {
            const data = await getWishlist();
            setItems(data);
        } catch (err) {
            console.error('Failed to load wishlist:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = async (productId) => {
        setRemoving(productId);
        try {
            await removeFromWishlist(productId);
            setItems(prev => prev.filter(i => i.product_id !== productId));
        } catch (err) {
            console.error('Failed to remove:', err);
        } finally {
            setRemoving(null);
        }
    };

    if (loading) {
        return (
            <div className="page">
                <div className="loading-container">
                    <div className="spinner" style={{ width: 40, height: 40 }}></div>
                    <p>Loading your wishlist...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page" style={{ maxWidth: 900 }}>
            <div className="page-header">
                <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Heart size={28} /> My Wishlist</h1>
                <p style={{ color: 'var(--text-muted)' }}>
                    {items.length} item{items.length !== 1 ? 's' : ''} saved
                </p>
            </div>

            {items.length === 0 ? (
                <div className="empty-state" style={{
                    textAlign: 'center', padding: '60px 20px',
                    background: 'var(--card-bg)', borderRadius: 16,
                    border: '1px solid var(--border-color)',
                }}>
                    <div style={{ fontSize: '3rem', marginBottom: 16 }}>💔</div>
                    <h3 style={{ marginBottom: 8 }}>Your wishlist is empty</h3>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
                        Browse products and tap the heart icon to save items you love!
                    </p>
                    <a href="/products" className="btn btn-primary" style={{ padding: '12px 28px' }}>
                        Browse Products
                    </a>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                    {items.map(item => {
                        const inStock = item.stock > 0;
                        return (
                            <div
                                key={item.id}
                                className="card"
                                style={{
                                    display: 'flex', flexDirection: 'column', padding: 0,
                                    transition: 'transform 0.2s, box-shadow 0.2s',
                                    cursor: 'pointer', position: 'relative',
                                    overflow: 'hidden',
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.2)';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                {/* Image */}
                                <a href={`/products/${item.product_id}`} style={{ textDecoration: 'none', display: 'block' }}>
                                    <div style={{
                                        width: '100%', height: 180, overflow: 'hidden',
                                        background: 'var(--bg-secondary)',
                                        borderBottom: '1px solid var(--border-color)',
                                    }}>
                                        {item.image_url ? (
                                            <img src={item.image_url} alt={item.title}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{
                                                width: '100%', height: '100%', display: 'flex',
                                                alignItems: 'center', justifyContent: 'center',
                                                color: 'var(--text-muted)',
                                            }}><Package size={40} /></div>
                                        )}
                                    </div>
                                </a>

                                {/* Info */}
                                <div style={{ padding: 16, flex: 1 }}>
                                    <a href={`/products/${item.product_id}`}
                                        style={{ textDecoration: 'none', color: 'inherit' }}>
                                        <h3 style={{
                                            fontSize: '1.05rem', fontWeight: 700, marginBottom: 6,
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        }}>
                                            {item.title}
                                        </h3>
                                    </a>

                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 8 }}>
                                        Sold by <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                                            {item.seller_name}
                                        </span>
                                    </p>

                                    <div style={{
                                        fontSize: '1.3rem', fontWeight: 800,
                                        color: 'var(--accent-secondary)', marginBottom: 8,
                                    }}>
                                        PHP {parseFloat(item.price).toFixed(2)}
                                    </div>

                                    <div style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 6,
                                        padding: '3px 10px', borderRadius: 12, fontSize: '0.75rem',
                                        fontWeight: 600,
                                        background: inStock ? 'rgba(16,185,129,0.1)' : 'rgba(255,71,87,0.1)',
                                        color: inStock ? '#10b981' : '#ef4444',
                                        border: `1px solid ${inStock ? 'rgba(16,185,129,0.3)' : 'rgba(255,71,87,0.3)'}`,
                                    }}>
                                        <span style={{
                                            width: 6, height: 6, borderRadius: '50%',
                                            background: inStock ? '#10b981' : '#ef4444',
                                        }}></span>
                                        {inStock ? `${item.stock} in stock` : 'Out of stock'}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div style={{
                                    display: 'flex', gap: 8, padding: '12px 16px',
                                    borderTop: '1px solid var(--border-color)',
                                }}>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleRemove(item.product_id); }}
                                        disabled={removing === item.product_id}
                                        style={{
                                            flex: 1,
                                            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                                            color: '#ef4444', padding: '8px 14px', borderRadius: 10,
                                            cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem',
                                            transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                        }}
                                        onMouseEnter={e => {
                                            e.currentTarget.style.background = 'rgba(239,68,68,0.2)';
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
                                        }}
                                    >
                                        {removing === item.product_id ? (
                                            <span className="spinner" style={{ width: 14, height: 14 }}></span>
                                        ) : '💔'} Remove
                                    </button>

                                    <a href={`/products/${item.product_id}`}
                                        className="btn btn-primary btn-sm"
                                        style={{
                                            flex: 1, textAlign: 'center',
                                            padding: '8px 14px', fontSize: '0.8rem',
                                            borderRadius: 10, textDecoration: 'none',
                                        }}>
                                        View Product
                                    </a>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
