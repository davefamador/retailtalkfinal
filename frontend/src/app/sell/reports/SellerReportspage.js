'use client';

import { useState, useEffect } from 'react';
import { getMyProducts, getTransactionHistory, getStoredUser, getSellerWishlistReport } from '../../../lib/api';

/**
 * SellerReportspage.js — Seller Insights & Reports Dashboard
 *
 * Financials: Total Revenue, AOV, Revenue Trend (daily/weekly/monthly line chart)
 *             + Comparison cards (today vs yesterday, this week vs last, this month vs last)
 * Operations: Stock Levels, Top-Selling, Tracking, Fulfillment, Incoming Orders
 */

export default function SellerReportsPage() {
    const [products, setProducts] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [wishlistReport, setWishlistReport] = useState(null);
    const [wishlistError, setWishlistError] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('financials');
    const [trendPeriod, setTrendPeriod] = useState('daily');

    useEffect(() => {
        const stored = getStoredUser();
        if (!stored) { window.location.href = '/login'; return; }
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [prods, txns, wlReport] = await Promise.all([
                getMyProducts(),
                getTransactionHistory(),
                getSellerWishlistReport().catch((err) => { console.error('Wishlist report error:', err); setWishlistError(true); return null; }),
            ]);
            setProducts(prods);
            setTransactions(txns);
            setWishlistReport(wlReport);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    // ── Compute Financial Metrics ──────────────────────────
    const mySellerTxns = transactions.filter(t => t.seller_id === getStoredUser()?.id);
    const gmv = mySellerTxns.reduce((sum, t) => sum + t.amount, 0);
    const aov = mySellerTxns.length > 0 ? gmv / mySellerTxns.length : 0;
    const totalOrders = mySellerTxns.length;

    // ── Revenue by Period ──────────────────────────────────
    const getRevenueSeries = (period) => {
        const data = {};
        mySellerTxns.forEach(t => {
            const d = new Date(t.created_at);
            let key;
            if (period === 'daily') {
                key = d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
            } else if (period === 'weekly') {
                const oneJan = new Date(d.getFullYear(), 0, 1);
                const week = Math.ceil(((d - oneJan) / 86400000 + oneJan.getDay() + 1) / 7);
                key = `W${week}`;
            } else {
                key = d.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' });
            }
            data[key] = (data[key] || 0) + t.amount;
        });
        const maxEntries = period === 'daily' ? 14 : period === 'weekly' ? 8 : 6;
        return Object.entries(data).slice(-maxEntries);
    };

    const revenueSeries = getRevenueSeries(trendPeriod);
    const maxRev = Math.max(...revenueSeries.map(([, v]) => v), 1);

    // ── Comparison metrics ──────────────────────────────────
    const now = new Date();
    const todayStr = now.toDateString();
    const yesterdayStr = new Date(now.getTime() - 86400000).toDateString();

    const todaySales = mySellerTxns.filter(t => new Date(t.created_at).toDateString() === todayStr).reduce((s, t) => s + t.amount, 0);
    const yesterdaySales = mySellerTxns.filter(t => new Date(t.created_at).toDateString() === yesterdayStr).reduce((s, t) => s + t.amount, 0);

    const getWeekNumber = (d) => {
        const oneJan = new Date(d.getFullYear(), 0, 1);
        return Math.ceil(((d - oneJan) / 86400000 + oneJan.getDay() + 1) / 7);
    };
    const thisWeek = getWeekNumber(now);
    const lastWeek = thisWeek - 1;
    const thisWeekSales = mySellerTxns.filter(t => { const d = new Date(t.created_at); return getWeekNumber(d) === thisWeek && d.getFullYear() === now.getFullYear(); }).reduce((s, t) => s + t.amount, 0);
    const lastWeekSales = mySellerTxns.filter(t => { const d = new Date(t.created_at); return getWeekNumber(d) === lastWeek && d.getFullYear() === now.getFullYear(); }).reduce((s, t) => s + t.amount, 0);

    const thisMonthSales = mySellerTxns.filter(t => { const d = new Date(t.created_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).reduce((s, t) => s + t.amount, 0);
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthSales = mySellerTxns.filter(t => { const d = new Date(t.created_at); return d.getMonth() === lastMonthDate.getMonth() && d.getFullYear() === lastMonthDate.getFullYear(); }).reduce((s, t) => s + t.amount, 0);

    const pctChange = (curr, prev) => prev === 0 ? (curr > 0 ? 100 : 0) : (((curr - prev) / prev) * 100);

    // ── Product Stock Insights ──────────────────────────────
    const lowStockProducts = products.filter(p => p.stock > 0 && p.stock <= 5);
    const outOfStockProducts = products.filter(p => p.stock === 0);
    const healthyStockProducts = products.filter(p => p.stock > 5);
    const productsWithTracking = products.filter(p => p.tracking_number);

    // ── Top-Selling Products ────────────────────────────────
    const productSalesMap = {};
    mySellerTxns.forEach(t => {
        if (!productSalesMap[t.product_id]) productSalesMap[t.product_id] = { title: t.product_title, count: 0, revenue: 0 };
        productSalesMap[t.product_id].count += 1;
        productSalesMap[t.product_id].revenue += t.amount;
    });
    const topSellingProducts = Object.entries(productSalesMap)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.count - a.count).slice(0, 5);

    if (loading) {
        return (
            <div className="page">
                <div className="loading-container">
                    <div className="spinner" style={{ width: 40, height: 40 }}></div>
                    <p>Loading seller insights...</p>
                </div>
            </div>
        );
    }

    const tabs = [
        { key: 'financials', label: '💰 Financials' },
        { key: 'operations', label: '📦 Operations' },
        { key: 'wishlist', label: '❤️ Wishlist' },
    ];

    return (
        <div className="page">
            <div className="page-header">
                <h1>📈 Seller Insights & Reports</h1>
                <p>Comprehensive analytics to grow your business</p>
            </div>

            {/* Tab Navigation */}
            <div style={{
                display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap',
                background: 'var(--card-bg)', borderRadius: 12, padding: 6,
                border: '1px solid var(--border-color)',
            }}>
                {tabs.map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                        flex: 1, minWidth: 120, padding: '12px 16px',
                        borderRadius: 8, border: 'none', cursor: 'pointer',
                        fontWeight: 600, fontSize: '0.9rem', transition: 'all 0.2s',
                        background: activeTab === tab.key ? 'var(--accent-primary)' : 'transparent',
                        color: activeTab === tab.key ? '#fff' : 'var(--text-secondary)',
                    }}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ═══ FINANCIALS ═══ */}
            {activeTab === 'financials' && (
                <div>
                    {/* Metric Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                        <MetricCard label="Total Revenue" value={`₱${gmv.toFixed(2)}`} subtitle="Total sales revenue" color="#10b981" icon="💎" />
                        <MetricCard label="Average Order Value" value={`₱${aov.toFixed(2)}`} subtitle={`Across ${totalOrders} order${totalOrders !== 1 ? 's' : ''}`} color="#f59e0b" icon="📊" />
                    </div>

                    {/* Comparison Cards: Today vs Yesterday, Week vs Last Week, Month vs Last Month */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                        <ComparisonCard label="Today vs Yesterday" current={todaySales} previous={yesterdaySales} pctChange={pctChange(todaySales, yesterdaySales)} />
                        <ComparisonCard label="This Week vs Last Week" current={thisWeekSales} previous={lastWeekSales} pctChange={pctChange(thisWeekSales, lastWeekSales)} />
                        <ComparisonCard label="This Month vs Last Month" current={thisMonthSales} previous={lastMonthSales} pctChange={pctChange(thisMonthSales, lastMonthSales)} />
                    </div>

                    {/* Revenue Trend — Line Chart */}
                    <div className="card" style={{ marginBottom: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3 style={{ margin: 0 }}>📈 Revenue Trend</h3>
                            <div style={{ display: 'flex', gap: 4, background: 'var(--bg-secondary)', borderRadius: 8, padding: 3 }}>
                                {['daily', 'weekly', 'monthly'].map(p => (
                                    <button key={p} onClick={() => setTrendPeriod(p)} style={{
                                        padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                                        fontSize: '0.75rem', fontWeight: 600, transition: 'all 0.2s',
                                        background: trendPeriod === p ? 'var(--accent-primary)' : 'transparent',
                                        color: trendPeriod === p ? '#fff' : 'var(--text-muted)',
                                        textTransform: 'capitalize',
                                    }}>{p}</button>
                                ))}
                            </div>
                        </div>

                        {revenueSeries.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>No revenue data yet</p>
                        ) : (
                            <div style={{ position: 'relative', height: 200, padding: '0 4px' }}>
                                {/* SVG Line Chart */}
                                <svg viewBox={`0 0 ${revenueSeries.length * 60} 180`} style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
                                    {/* Grid lines */}
                                    {[0, 0.25, 0.5, 0.75, 1].map(frac => (
                                        <line key={frac} x1="0" y1={20 + (1 - frac) * 140} x2={revenueSeries.length * 60} y2={20 + (1 - frac) * 140}
                                            stroke="var(--border-color)" strokeWidth="1" opacity="0.5" />
                                    ))}
                                    {/* Area fill */}
                                    <polygon
                                        points={[
                                            ...revenueSeries.map(([, v], i) => `${i * 60 + 30},${20 + (1 - v / maxRev) * 140}`),
                                            `${(revenueSeries.length - 1) * 60 + 30},160`,
                                            `30,160`,
                                        ].join(' ')}
                                        fill="url(#areaGrad)" opacity="0.3"
                                    />
                                    {/* Line */}
                                    <polyline
                                        points={revenueSeries.map(([, v], i) => `${i * 60 + 30},${20 + (1 - v / maxRev) * 140}`).join(' ')}
                                        fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
                                    />
                                    {/* Dots */}
                                    {revenueSeries.map(([, v], i) => (
                                        <circle key={i} cx={i * 60 + 30} cy={20 + (1 - v / maxRev) * 140} r="4" fill="#6366f1" stroke="#1a1a2e" strokeWidth="2" />
                                    ))}
                                    <defs>
                                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#6366f1" />
                                            <stop offset="100%" stopColor="transparent" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                                {/* X-axis labels */}
                                <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 4 }}>
                                    {revenueSeries.map(([label, value]) => (
                                        <div key={label} style={{ textAlign: 'center', flex: 1 }}>
                                            <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{label}</p>
                                            <p style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontWeight: 600 }}>₱{value.toFixed(0)}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Recent Sales Table */}
                    <div className="card">
                        <h3 style={{ marginBottom: 16 }}>🧾 Recent Sales</h3>
                        {mySellerTxns.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>No sales yet</p>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                                            <th style={thStyle}>Product</th>
                                            <th style={thStyle}>Amount</th>
                                            <th style={thStyle}>Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {mySellerTxns.slice(0, 10).map(t => (
                                            <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                <td style={tdStyle}>{t.product_title || 'Unknown'}</td>
                                                <td style={{ ...tdStyle, fontWeight: 600 }}>₱{t.amount.toFixed(2)}</td>
                                                <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                                                    {new Date(t.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══ OPERATIONS ═══ */}
            {activeTab === 'operations' && (
                <div>
                    {/* Stock Overview Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
                        <MetricCard label="Total Products" value={products.length} color="#6366f1" icon="📦" />
                        <MetricCard label="Healthy Stock (>5)" value={healthyStockProducts.length} color="#10b981" icon="✅" />
                        <MetricCard label="Low Stock (1-5)" value={lowStockProducts.length} color="#f59e0b" icon="⚠️" />
                        <MetricCard label="Out of Stock" value={outOfStockProducts.length} color="#ef4444" icon="🚫" />
                    </div>

                    {/* Top-Selling Products */}
                    <div className="card" style={{ marginBottom: 24 }}>
                        <h3 style={{ marginBottom: 16 }}>🏆 Top-Selling Products</h3>
                        {topSellingProducts.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>No sales data yet</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {topSellingProducts.map((prod, i) => {
                                    const maxCount = topSellingProducts[0]?.count || 1;
                                    return (
                                        <div key={prod.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <span style={{
                                                width: 28, height: 28, borderRadius: '50%',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '0.8rem', fontWeight: 700,
                                                background: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : 'var(--border-color)',
                                                color: i < 3 ? '#fff' : 'var(--text-secondary)',
                                            }}>{i + 1}</span>
                                            <div style={{ flex: 1 }}>
                                                <p style={{ fontWeight: 600, marginBottom: 4, fontSize: '0.9rem' }}>{prod.title || 'Untitled'}</p>
                                                <div style={{ height: 6, borderRadius: 3, background: 'var(--border-color)', overflow: 'hidden' }}>
                                                    <div style={{
                                                        height: '100%', borderRadius: 3,
                                                        width: `${(prod.count / maxCount) * 100}%`,
                                                        background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                                                        transition: 'width 0.5s ease',
                                                    }} />
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right', minWidth: 80 }}>
                                                <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>{prod.count} sold</p>
                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>₱{prod.revenue.toFixed(0)}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Tracking Number Status */}
                    <div className="card" style={{ marginBottom: 24 }}>
                        <h3 style={{ marginBottom: 16 }}>🚚 Tracking Number Status</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                            <div style={{ padding: 16, borderRadius: 8, textAlign: 'center', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                                <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>{productsWithTracking.length}</p>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>With Tracking</p>
                            </div>
                            <div style={{ padding: 16, borderRadius: 8, textAlign: 'center', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                                <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444' }}>{products.length - productsWithTracking.length}</p>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Without Tracking</p>
                            </div>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            💡 Fulfillment Rate: <strong style={{ color: 'var(--text-primary)' }}>
                                {products.length > 0 ? ((productsWithTracking.length / products.length) * 100).toFixed(0) : 0}%
                            </strong> of products have tracking numbers assigned.
                        </p>
                    </div>

                    {/* Low Stock Alerts */}
                    {lowStockProducts.length > 0 && (
                        <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
                            <h3 style={{ marginBottom: 12 }}>⚠️ Low Stock Alerts</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {lowStockProducts.map(p => (
                                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                                        <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{p.title}</span>
                                        <span style={{ fontWeight: 700, color: '#f59e0b', fontSize: '0.85rem' }}>{p.stock} left</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Incoming Orders */}
                    <div className="card" style={{ marginTop: 24 }}>
                        <h3 style={{ marginBottom: 16 }}>🛒 Incoming Orders</h3>
                        {mySellerTxns.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>No orders received yet</p>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                                            <th style={thStyle}>Product</th>
                                            <th style={thStyle}>Qty</th>
                                            <th style={thStyle}>Amount</th>
                                            <th style={thStyle}>Status</th>
                                            <th style={thStyle}>Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {mySellerTxns.map(t => (
                                            <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                <td style={tdStyle}>{t.product_title || 'Unknown'}</td>
                                                <td style={tdStyle}>{t.quantity || 1}</td>
                                                <td style={{ ...tdStyle, fontWeight: 600 }}>₱{t.amount.toFixed(2)}</td>
                                                <td style={tdStyle}>
                                                    <span style={{
                                                        padding: '2px 8px', borderRadius: 10, fontSize: '0.75rem',
                                                        background: t.status === 'delivered' ? 'rgba(16,185,129,0.15)' : 'rgba(251,191,36,0.15)',
                                                        color: t.status === 'delivered' ? '#10b981' : '#fbbf24',
                                                        fontWeight: 600,
                                                    }}>{t.status}</span>
                                                </td>
                                                <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                                                    {new Date(t.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══ WISHLIST ANALYTICS ═══ */}
            {activeTab === 'wishlist' && (
                <div>
                    {wishlistError && (
                        <div style={{
                            padding: '12px 16px', marginBottom: 16, borderRadius: 8,
                            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                            color: '#ef4444', fontSize: '0.85rem',
                        }}>
                            Failed to load wishlist analytics. Please try refreshing the page.
                        </div>
                    )}

                    {/* Wishlist Metric Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
                        <MetricCard
                            label="Total Wishlists"
                            value={wishlistReport?.total_wishlists ?? 0}
                            subtitle="Times your products were wishlisted"
                            color="#ef4444" icon="❤️"
                        />
                        <MetricCard
                            label="Unique Buyers"
                            value={wishlistReport?.unique_buyers ?? 0}
                            subtitle="Buyers who saved your products"
                            color="#8b5cf6" icon="👥"
                        />
                        <MetricCard
                            label="Total Products"
                            value={wishlistReport?.total_products ?? 0}
                            subtitle="Products in your store"
                            color="#6366f1" icon="📦"
                        />
                        <MetricCard
                            label="Wishlists / Product"
                            value={wishlistReport?.wishlist_per_product?.toFixed(2) ?? '0.00'}
                            subtitle="Average wishlists per product"
                            color="#f59e0b" icon="📊"
                        />
                    </div>

                    {/* Per-Product Wishlist Breakdown */}
                    <div className="card">
                        <h3 style={{ marginBottom: 16 }}>❤️ Wishlist by Product</h3>
                        {(!wishlistReport?.products || wishlistReport.products.length === 0) ? (
                            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>No wishlist data yet</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {wishlistReport.products.map((prod, i) => {
                                    const maxCount = wishlistReport.products[0]?.wishlist_count || 1;
                                    return (
                                        <div key={prod.product_id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            {/* Rank badge */}
                                            <span style={{
                                                width: 28, height: 28, borderRadius: '50%',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '0.8rem', fontWeight: 700, flexShrink: 0,
                                                background: i === 0 ? '#ef4444' : i === 1 ? '#f59e0b' : i === 2 ? '#6366f1' : 'var(--border-color)',
                                                color: i < 3 ? '#fff' : 'var(--text-secondary)',
                                            }}>{i + 1}</span>

                                            {/* Product image */}
                                            <div style={{
                                                width: 36, height: 36, borderRadius: 8, overflow: 'hidden',
                                                border: '1px solid var(--border-color)', flexShrink: 0,
                                                background: 'var(--bg-secondary)',
                                            }}>
                                                {prod.image_url ? (
                                                    <img src={prod.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    <div style={{
                                                        width: '100%', height: '100%', display: 'flex',
                                                        alignItems: 'center', justifyContent: 'center',
                                                        color: 'var(--text-muted)', fontSize: '0.7rem',
                                                    }}>📦</div>
                                                )}
                                            </div>

                                            {/* Product info + bar */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{
                                                    fontWeight: 600, marginBottom: 4, fontSize: '0.9rem',
                                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                }}>
                                                    {prod.title || 'Untitled'}
                                                </p>
                                                <div style={{ height: 6, borderRadius: 3, background: 'var(--border-color)', overflow: 'hidden' }}>
                                                    <div style={{
                                                        height: '100%', borderRadius: 3,
                                                        width: `${maxCount > 0 ? (prod.wishlist_count / maxCount) * 100 : 0}%`,
                                                        background: 'linear-gradient(90deg, #ef4444, #f59e0b)',
                                                        transition: 'width 0.5s ease',
                                                    }} />
                                                </div>
                                            </div>

                                            {/* Count */}
                                            <div style={{ textAlign: 'right', minWidth: 60, flexShrink: 0 }}>
                                                <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                                                    {prod.wishlist_count} ❤️
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}


// ─── Reusable Components ──────────────────────────────────────────────

function MetricCard({ label, value, subtitle, color, icon }) {
    return (
        <div className="card" style={{ padding: '20px 16px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -8, right: -8, fontSize: '3rem', opacity: 0.08 }}>{icon}</div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 6 }}>{label}</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: color || 'var(--text-primary)' }}>{value}</p>
            {subtitle && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>{subtitle}</p>}
        </div>
    );
}

function ComparisonCard({ label, current, previous, pctChange }) {
    const isUp = pctChange >= 0;
    const diff = current - previous;
    return (
        <div className="card" style={{ padding: '18px 16px' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: 8 }}>{label}</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: '1.3rem', fontWeight: 700 }}>₱{current.toFixed(0)}</span>
                <span style={{
                    fontSize: '0.8rem', fontWeight: 700,
                    color: isUp ? '#10b981' : '#ef4444',
                    display: 'flex', alignItems: 'center', gap: 2,
                }}>
                    {isUp ? '↑' : '↓'} {Math.abs(pctChange).toFixed(1)}%
                </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                <span>Previous: ₱{previous.toFixed(0)}</span>
                <span style={{ color: isUp ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                    {isUp ? '+' : ''}₱{diff.toFixed(0)}
                </span>
            </div>
        </div>
    );
}

const thStyle = { padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 };
const tdStyle = { padding: '10px 12px' };
