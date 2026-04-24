'use client';

import { useState, useEffect } from 'react';
import { listProducts, getStoredUser, getStoredAdmin, getBuyerRecommendations } from '../../lib/api';
import ProductDetailModal from '../components/ProductDetailModal';

// Static demo products shown when DB is empty so user can see the UI
const DEMO_PRODUCTS = [
    {
        id: 'demo-1', title: 'Wireless Noise-Cancelling Headphones',
        description: 'Premium over-ear headphones with active noise cancellation, 30-hour battery life, and Hi-Res audio support. Features adaptive sound control and speak-to-chat technology.',
        price: 2499.00, stock: 15,
        images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop'],
        is_active: true, created_at: new Date().toISOString(), seller_name: 'TechStore PH', _demo: true,
    },
    {
        id: 'demo-2', title: 'Smart Fitness Watch Pro',
        description: 'Track your health with heart rate monitoring, GPS, sleep tracking, and 7-day battery life. Water-resistant up to 50m with over 100 workout modes.',
        price: 3999.00, stock: 8,
        images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop'],
        is_active: true, created_at: new Date().toISOString(), seller_name: 'GadgetHub', _demo: true,
    },
    {
        id: 'demo-3', title: 'Portable Bluetooth Speaker',
        description: 'Waterproof, 360° surround sound, 20-hour playtime. Perfect for outdoor adventures. Built-in microphone for hands-free calls.',
        price: 1299.00, stock: 25,
        images: ['https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400&h=400&fit=crop'],
        is_active: true, created_at: new Date().toISOString(), seller_name: 'AudioWorld', _demo: true,
    },
    {
        id: 'demo-4', title: 'Mechanical Gaming Keyboard',
        description: 'RGB backlit, hot-swappable switches, aluminum frame. Built for competitive gamers with N-key rollover and programmable macros.',
        price: 4599.00, stock: 12,
        images: ['https://images.unsplash.com/photo-1541140532154-b024d1b23bef?w=400&h=400&fit=crop'],
        is_active: true, created_at: new Date().toISOString(), seller_name: 'GameZone', _demo: true,
    },
    {
        id: 'demo-5', title: 'Minimalist Leather Backpack',
        description: 'Handcrafted genuine leather, padded laptop compartment, anti-theft design. Fits up to 15.6" laptops with multiple organizer pockets.',
        price: 2899.00, stock: 6,
        images: ['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=400&fit=crop'],
        is_active: true, created_at: new Date().toISOString(), seller_name: 'UrbanCraft', _demo: true,
    },
    {
        id: 'demo-6', title: 'Organic Coffee Beans 1kg',
        description: 'Single-origin Arabica beans from Benguet highlands. Medium roast, chocolatey notes with hints of citrus and caramel.',
        price: 599.00, stock: 50,
        images: ['https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&h=400&fit=crop'],
        is_active: true, created_at: new Date().toISOString(), seller_name: 'BeanBrew Co.', _demo: true,
    },
];


export default function ProductsPage() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [usingDemo, setUsingDemo] = useState(false);

    // Recommendations state
    const [recommendations, setRecommendations] = useState([]);
    const [recsBasedOn, setRecsBasedOn] = useState('');
    const [recsLoading, setRecsLoading] = useState(false);

    // Modal state
    const [selectedProduct, setSelectedProduct] = useState(null);

    useEffect(() => {
        const storedUser = getStoredUser() || getStoredAdmin();
        setUser(storedUser);
        loadProducts();
        if (storedUser) {
            loadRecommendations();
        }
    }, []);

    const loadRecommendations = async () => {
        setRecsLoading(true);
        try {
            const data = await getBuyerRecommendations();
            setRecommendations(data.recommendations || []);
            setRecsBasedOn(data.based_on || '');
        } catch (err) {
            // Silently fail — recommendations are optional
            setRecommendations([]);
        } finally {
            setRecsLoading(false);
        }
    };

    const loadProducts = async () => {
        try {
            const data = await listProducts();
            if (data.length === 0) {
                setProducts(DEMO_PRODUCTS);
                setUsingDemo(true);
            } else {
                setProducts(data);
                setUsingDemo(false);
            }
        } catch (err) {
            setProducts(DEMO_PRODUCTS);
            setUsingDemo(true);
        } finally {
            setLoading(false);
        }
    };

    const openProduct = (product) => {
        setSelectedProduct(product);
    };

    const closeModal = () => {
        setSelectedProduct(null);
    };

    if (loading) {
        return (
            <div className="page">
                <div className="loading-container">
                    <div className="spinner" style={{ width: 40, height: 40 }}></div>
                    <p>Loading products...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="page-header">
                <h1>Browse Products</h1>
                <p>Discover products from our marketplace</p>
            </div>

            {usingDemo && (
                <div className="alert" style={{
                    background: 'rgba(108,99,255,0.1)', border: '1px solid rgba(108,99,255,0.3)',
                    color: 'var(--accent-primary)', marginBottom: 24,
                }}>
                    ✨ These are demo products for preview. Sign up as a seller to add real products!
                </div>
            )}

            {/* ===== RECOMMENDED FOR YOU ===== */}
            {user && recommendations.length > 0 && (
                <div style={{
                    marginBottom: 36, padding: 28, borderRadius: 18,
                    background: 'linear-gradient(135deg, rgba(108,99,255,0.08) 0%, rgba(0,212,170,0.06) 100%)',
                    border: '1px solid rgba(108,99,255,0.15)',
                }}>
                    <div style={{ marginBottom: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                            <span style={{ fontSize: '1.15rem' }}>✨</span>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                                Recommended For You
                            </h2>
                        </div>
                        <p style={{
                            color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0, paddingLeft: 30,
                        }}>
                            {recsBasedOn && recsBasedOn !== 'popular'
                                ? <>Based on your search for "<span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{recsBasedOn}</span>"</>
                                : 'Popular products you might like'
                            }
                        </p>
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                        gap: 16,
                    }}>
                        {recommendations.map((p) => {
                            const firstImage = p.images && p.images.length > 0 ? p.images[0] : null;
                            return (
                                <div
                                    key={p.id}
                                    onClick={() => openProduct(p)}
                                    style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                >
                                    <div style={{
                                        borderRadius: 14, overflow: 'hidden',
                                        background: 'var(--bg-card)',
                                        border: '1px solid var(--border-color)',
                                        height: '100%',
                                    }}>
                                        <div style={{
                                            width: '100%', height: 150, overflow: 'hidden',
                                            background: 'var(--bg-secondary)',
                                        }}>
                                            {firstImage ? (
                                                <img
                                                    src={firstImage} alt={p.title}
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    onError={(e) => { e.target.style.display = 'none'; }}
                                                />
                                            ) : (
                                                <div style={{
                                                    width: '100%', height: '100%',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: 'var(--text-muted)', fontSize: '0.8rem',
                                                }}>No Image</div>
                                            )}
                                        </div>
                                        <div style={{ padding: '12px 14px' }}>
                                            <div style={{
                                                fontSize: '0.88rem', fontWeight: 700,
                                                marginBottom: 6, lineHeight: 1.35,
                                                display: '-webkit-box', WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical', overflow: 'hidden',
                                            }}>{p.title}</div>
                                            <div style={{
                                                fontSize: '1rem', fontWeight: 800,
                                                color: 'var(--accent-secondary)',
                                            }}>
                                                PHP {parseFloat(p.price).toFixed(2)}
                                            </div>
                                            <div style={{
                                                fontSize: '0.75rem', color: 'var(--text-muted)',
                                                marginTop: 4,
                                            }}>{p.seller_name || 'Seller'}</div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ===== PRODUCTS GROUPED BY STORE ===== */}
            {(() => {
                const inStockProducts = products.filter(p => !p.stock || p.stock > 0);
                // Group by seller_name
                const storeMap = {};
                inStockProducts.forEach(p => {
                    const store = p.seller_name || 'Seller';
                    if (!storeMap[store]) storeMap[store] = [];
                    storeMap[store].push(p);
                });
                const stores = Object.entries(storeMap);
                return stores.map(([storeName, storeProducts]) => (
                    <div key={storeName} style={{ marginBottom: 40 }}>
                        {/* Store header */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
                            paddingBottom: 12, borderBottom: '1px solid var(--border-color)',
                        }}>
                            <div style={{
                                width: 36, height: 36, borderRadius: 10,
                                background: 'linear-gradient(135deg, rgba(108,99,255,0.2) 0%, rgba(0,212,170,0.15) 100%)',
                                border: '1px solid rgba(108,99,255,0.25)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1rem', flexShrink: 0,
                            }}>🏪</div>
                            <div>
                                <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>{storeName}</h2>
                                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                                    {storeProducts.length} product{storeProducts.length !== 1 ? 's' : ''}
                                </p>
                            </div>
                        </div>
                        <div className="product-grid">
                            {storeProducts.map(p => {
                                const firstImage = p.images && p.images.length > 0 ? p.images[0] : null;
                                return (
                                    <div key={p.id} onClick={() => openProduct(p)} style={{ cursor: 'pointer' }}>
                                        <div className="card product-card" style={{ height: '100%' }}>
                                            <div style={{
                                                width: '100%', height: 200, borderRadius: 8, overflow: 'hidden',
                                                marginBottom: 14, background: 'var(--bg-secondary)',
                                            }}>
                                                {firstImage ? (
                                                    <img src={firstImage} alt={p.title}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        onError={(e) => { e.target.style.display = 'none'; }}
                                                    />
                                                ) : (
                                                    <div style={{
                                                        width: '100%', height: '100%',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        color: 'var(--text-muted)', fontSize: '0.85rem',
                                                    }}>No Image</div>
                                                )}
                                            </div>
                                            <div className="product-title">{p.title}</div>
                                            <p style={{
                                                color: 'var(--text-secondary)', fontSize: '0.85rem',
                                                marginBottom: 12, lineHeight: 1.5,
                                                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                                            }}>
                                                {p.description || 'No description available'}
                                            </p>
                                            <div className="product-price">PHP {parseFloat(p.price).toFixed(2)}</div>
                                            <div className="product-meta">
                                                <span style={{ fontSize: '0.75rem', fontWeight: 600, marginLeft: 'auto',
                                                    color: (p.stock || 0) > 0 ? 'var(--accent-success)' : 'var(--accent-danger)',
                                                }}>
                                                    {(p.stock || 0) > 0 ? `${p.stock} in stock` : 'Out of stock'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ));
            })()}

            {/* ===== PRODUCT DETAIL MODAL ===== */}
            <ProductDetailModal
                product={selectedProduct}
                user={user}
                onClose={closeModal}
                isDemo={selectedProduct?._demo || false}
                onPurchased={(product, qty) => {
                    setProducts(products.map(p =>
                        p.id === product.id ? { ...p, stock: p.stock - qty } : p
                    ));
                }}
            />
        </div>
    );
}
