'use client';

import { useState, useEffect } from 'react';
import { getMyProducts, getTransactionHistory, getStoredUser } from '../../lib/api';

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
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: isUp ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: 2 }}>
                    {isUp ? '↑' : '↓'} {Math.abs(pctChange).toFixed(1)}%
                </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                <span>Previous: ₱{previous.toFixed(0)}</span>
                <span style={{ color: isUp ? '#10b981' : '#ef4444', fontWeight: 600 }}>{isUp ? '+' : ''}₱{diff.toFixed(0)}</span>
            </div>
        </div>
    );
}

const thStyle = { padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 };
const tdStyle = { padding: '10px 12px' };

export default function ReportsContent() {
    const [products, setProducts] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('financials');
    const [trendPeriod, setTrendPeriod] = useState('daily');

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [prods, txns] = await Promise.all([getMyProducts(), getTransactionHistory()]);
            setProducts(prods);
            setTransactions(txns);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const mySellerTxns = transactions.filter(t => t.buyer_id !== getStoredUser()?.id);
    const gmv = mySellerTxns.reduce((sum, t) => sum + t.amount, 0);
    const netRevenue = mySellerTxns.reduce((sum, t) => sum + t.seller_amount, 0);
    const totalCommission = mySellerTxns.reduce((sum, t) => sum + t.admin_commission, 0);
    const aov = mySellerTxns.length > 0 ? gmv / mySellerTxns.length : 0;
    const totalOrders = mySellerTxns.length;

    const getRevenueSeries = (period) => {
        const now = new Date();
        const data = {};

        if (period === 'daily') {
            for (let i = 0; i < 24; i++) {
                const hourStr = (i === 0 ? 12 : i > 12 ? i - 12 : i) + (i < 12 ? 'AM' : 'PM');
                data[hourStr] = 0;
            }
            mySellerTxns.forEach(t => {
                const d = new Date(t.created_at);
                if (d.toDateString() === now.toDateString()) {
                    const h = d.getHours();
                    const hourStr = (h === 0 ? 12 : h > 12 ? h - 12 : h) + (h < 12 ? 'AM' : 'PM');
                    data[hourStr] += t.seller_amount;
                }
            });
            return Object.entries(data);
        } else if (period === 'weekly') {
            const days = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
                const key = `${d.getMonth() + 1}-${d.getDate()}`;
                days.push({ key, dateStr: d.toDateString() });
                data[key] = 0;
            }
            mySellerTxns.forEach(t => {
                const d = new Date(t.created_at);
                const ds = d.toDateString();
                const dayMatch = days.find(x => x.dateStr === ds);
                if (dayMatch) {
                    data[dayMatch.key] += t.seller_amount;
                }
            });
            return Object.entries(data);
        } else {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            months.forEach(m => data[m] = 0);
            mySellerTxns.forEach(t => {
                const d = new Date(t.created_at);
                if (d.getFullYear() === now.getFullYear()) {
                    const m = months[d.getMonth()];
                    data[m] += t.seller_amount;
                }
            });
            return Object.entries(data);
        }
    };

    const revenueSeries = getRevenueSeries(trendPeriod);
    const maxRev = Math.max(...revenueSeries.map(([, v]) => v), 1);

    const now = new Date();
    const todayStr = now.toDateString();
    const yesterdayStr = new Date(now.getTime() - 86400000).toDateString();
    const todaySales = mySellerTxns.filter(t => new Date(t.created_at).toDateString() === todayStr).reduce((s, t) => s + t.seller_amount, 0);
    const yesterdaySales = mySellerTxns.filter(t => new Date(t.created_at).toDateString() === yesterdayStr).reduce((s, t) => s + t.seller_amount, 0);

    const getWeekNumber = (d) => { const oneJan = new Date(d.getFullYear(), 0, 1); return Math.ceil(((d - oneJan) / 86400000 + oneJan.getDay() + 1) / 7); };
    const thisWeek = getWeekNumber(now);
    const lastWeek = thisWeek - 1;
    const thisWeekSales = mySellerTxns.filter(t => { const d = new Date(t.created_at); return getWeekNumber(d) === thisWeek && d.getFullYear() === now.getFullYear(); }).reduce((s, t) => s + t.seller_amount, 0);
    const lastWeekSales = mySellerTxns.filter(t => { const d = new Date(t.created_at); return getWeekNumber(d) === lastWeek && d.getFullYear() === now.getFullYear(); }).reduce((s, t) => s + t.seller_amount, 0);
    const thisMonthSales = mySellerTxns.filter(t => { const d = new Date(t.created_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).reduce((s, t) => s + t.seller_amount, 0);
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthSales = mySellerTxns.filter(t => { const d = new Date(t.created_at); return d.getMonth() === lastMonthDate.getMonth() && d.getFullYear() === lastMonthDate.getFullYear(); }).reduce((s, t) => s + t.seller_amount, 0);
    const pctChange = (curr, prev) => prev === 0 ? (curr > 0 ? 100 : 0) : (((curr - prev) / prev) * 100);

    const lowStockProducts = products.filter(p => p.stock > 0 && p.stock <= 5);
    const outOfStockProducts = products.filter(p => p.stock === 0);
    const healthyStockProducts = products.filter(p => p.stock > 5);
    const productsWithTracking = products.filter(p => p.tracking_number);

    const productSalesMap = {};
    mySellerTxns.forEach(t => {
        if (!productSalesMap[t.product_id]) productSalesMap[t.product_id] = { title: t.product_title, count: 0, revenue: 0 };
        productSalesMap[t.product_id].count += 1;
        productSalesMap[t.product_id].revenue += t.amount;
    });
    const topSellingProducts = Object.entries(productSalesMap).map(([id, data]) => ({ id, ...data })).sort((a, b) => b.count - a.count).slice(0, 5);

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 12 }}>
                <div className="spinner" style={{ width: 40, height: 40 }}></div>
                <p style={{ color: 'var(--text-muted)' }}>Loading reports...</p>
            </div>
        );
    }

    const tabs = [{ key: 'financials', label: '💰 Financials' }, { key: 'operations', label: '📦 Operations' }];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Insights & Reports</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Comprehensive analytics to grow your business</p>
                </div>
                <button
                    onClick={() => {
                        const csv = [
                            ['Seller Report Summary'],
                            ['Generated on', new Date().toLocaleString()],
                            [],
                            ['FINANCIAL SUMMARY'],
                            ['Metric', 'Value'],
                            ['Gross Merchandise Value', `₱${gmv.toFixed(2)}`],
                            ['Net Revenue (90%)', `₱${netRevenue.toFixed(2)}`],
                            ['Platform Commission (10%)', `₱${totalCommission.toFixed(2)}`],
                            ['Average Order Value', `₱${aov.toFixed(2)}`],
                            ['Total Orders', totalOrders],
                            [],
                            ['REVENUE TRENDS', trendPeriod.toUpperCase()],
                            ['Period', 'Revenue'],
                            ...revenueSeries.map(([label, value]) => [label, `₱${value.toFixed(2)}`]),
                            [],
                            ['PERIOD COMPARISONS'],
                            ['Period', 'Current', 'Previous', 'Change %'],
                            ['Today vs Yesterday', `₱${todaySales.toFixed(2)}`, `₱${yesterdaySales.toFixed(2)}`, `${pctChange(todaySales, yesterdaySales).toFixed(1)}%`],
                            ['This Week vs Last Week', `₱${thisWeekSales.toFixed(2)}`, `₱${lastWeekSales.toFixed(2)}`, `${pctChange(thisWeekSales, lastWeekSales).toFixed(1)}%`],
                            ['This Month vs Last Month', `₱${thisMonthSales.toFixed(2)}`, `₱${lastMonthSales.toFixed(2)}`, `${pctChange(thisMonthSales, lastMonthSales).toFixed(1)}%`],
                            [],
                            ['OPERATIONS SUMMARY'],
                            ['Metric', 'Value'],
                            ['Total Products', products.length],
                            ['Healthy Stock (>5)', healthyStockProducts.length],
                            ['Low Stock (1-5)', lowStockProducts.length],
                            ['Out of Stock', outOfStockProducts.length],
                            ['Products with Tracking', productsWithTracking.length],
                            ['Fulfillment Rate', `${products.length > 0 ? ((productsWithTracking.length / products.length) * 100).toFixed(0) : 0}%`],
                            [],
                            ['TOP SELLING PRODUCTS'],
                            ['Rank', 'Product Title', 'Times Sold', 'Total Revenue'],
                            ...topSellingProducts.map((p, i) => [i + 1, p.title || 'Untitled', p.count, `₱${p.revenue.toFixed(2)}`]),
                        ];
                        const csvContent = csv.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                        const link = document.createElement('a');
                        const url = URL.createObjectURL(blob);
                        link.setAttribute('href', url);
                        link.setAttribute('download', `seller-report-${new Date().toISOString().split('T')[0]}.csv`);
                        link.style.visibility = 'hidden';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 20px', borderRadius: 10, border: '1px solid rgba(99,102,241,0.3)',
                        background: 'rgba(99,102,241,0.1)', color: '#6366f1',
                        cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem',
                        fontFamily: 'Inter, sans-serif', transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(99,102,241,0.1)'}
                >
                    📥 Export CSV
                </button>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 24, background: 'var(--card-bg)', borderRadius: 12, padding: 6, border: '1px solid var(--border-color)' }}>
                {tabs.map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                        flex: 1, minWidth: 120, padding: '12px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                        fontWeight: 600, fontSize: '0.9rem', transition: 'all 0.2s',
                        background: activeTab === tab.key ? 'var(--accent-primary)' : 'transparent',
                        color: activeTab === tab.key ? '#fff' : 'var(--text-secondary)',
                    }}>{tab.label}</button>
                ))}
            </div>

            {activeTab === 'financials' && (
                <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                        <MetricCard label="Gross Merchandise Value" value={`₱${gmv.toFixed(2)}`} subtitle="Total sales including commissions" color="#10b981" icon="💎" />
                        <MetricCard label="Net Revenue (90%)" value={`₱${netRevenue.toFixed(2)}`} subtitle="Earnings after 10% commission" color="#6366f1" icon="💵" />
                        <MetricCard label="Average Order Value" value={`₱${aov.toFixed(2)}`} subtitle={`Across ${totalOrders} order${totalOrders !== 1 ? 's' : ''}`} color="#f59e0b" icon="📊" />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                        <ComparisonCard label="Today vs Yesterday" current={todaySales} previous={yesterdaySales} pctChange={pctChange(todaySales, yesterdaySales)} />
                        <ComparisonCard label="This Week vs Last Week" current={thisWeekSales} previous={lastWeekSales} pctChange={pctChange(thisWeekSales, lastWeekSales)} />
                        <ComparisonCard label="This Month vs Last Month" current={thisMonthSales} previous={lastMonthSales} pctChange={pctChange(thisMonthSales, lastMonthSales)} />
                    </div>
                    <div className="card" style={{ marginBottom: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3 style={{ margin: 0 }}>Revenue Trend</h3>
                            <div style={{ display: 'flex', gap: 4, background: 'var(--bg-secondary)', borderRadius: 8, padding: 3 }}>
                                {['daily', 'weekly', 'monthly'].map(p => (
                                    <button key={p} onClick={() => setTrendPeriod(p)} style={{
                                        padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                                        background: trendPeriod === p ? 'var(--accent-primary)' : 'transparent',
                                        color: trendPeriod === p ? '#fff' : 'var(--text-muted)', textTransform: 'capitalize',
                                    }}>{p}</button>
                                ))}
                            </div>
                        </div>
                        {revenueSeries.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>No revenue data yet</p>
                        ) : (
                            <div style={{ position: 'relative', height: 200, padding: '0 4px' }}>
                                <svg viewBox={`0 0 ${revenueSeries.length * 60} 180`} style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
                                    {[0, 0.25, 0.5, 0.75, 1].map(frac => (
                                        <line key={frac} x1="0" y1={20 + (1 - frac) * 140} x2={revenueSeries.length * 60} y2={20 + (1 - frac) * 140} stroke="var(--border-color)" strokeWidth="1" opacity="0.5" />
                                    ))}
                                    <polygon points={[...revenueSeries.map(([, v], i) => `${i * 60 + 30},${20 + (1 - v / maxRev) * 140}`), `${(revenueSeries.length - 1) * 60 + 30},160`, `30,160`].join(' ')} fill="url(#areaGradReport)" opacity="0.3" />
                                    <polyline points={revenueSeries.map(([, v], i) => `${i * 60 + 30},${20 + (1 - v / maxRev) * 140}`).join(' ')} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                                    {revenueSeries.map(([, v], i) => (<circle key={i} cx={i * 60 + 30} cy={20 + (1 - v / maxRev) * 140} r="4" fill="#6366f1" stroke="#1a1a2e" strokeWidth="2" />))}
                                    <defs><linearGradient id="areaGradReport" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="transparent" /></linearGradient></defs>
                                </svg>
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
                    <div className="card">
                        <h3 style={{ marginBottom: 16 }}>Recent Sales</h3>
                        {mySellerTxns.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>No sales yet</p>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                    <thead><tr style={{ borderBottom: '2px solid var(--border-color)' }}><th style={thStyle}>Product</th><th style={thStyle}>Amount</th><th style={thStyle}>Date</th></tr></thead>
                                    <tbody>
                                        {mySellerTxns.slice(0, 10).map(t => (
                                            <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                <td style={tdStyle}>{t.product_title || 'Unknown'}</td>
                                                <td style={tdStyle}>₱{t.amount.toFixed(2)}</td>
                                                <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{new Date(t.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'operations' && (
                <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
                        <MetricCard label="Total Products" value={products.length} color="#6366f1" icon="📦" />
                        <MetricCard label="Healthy Stock (>5)" value={healthyStockProducts.length} color="#10b981" icon="✅" />
                        <MetricCard label="Low Stock (1-5)" value={lowStockProducts.length} color="#f59e0b" icon="⚠️" />
                        <MetricCard label="Out of Stock" value={outOfStockProducts.length} color="#ef4444" icon="🚫" />
                    </div>
                    <div className="card" style={{ marginBottom: 24 }}>
                        <h3 style={{ marginBottom: 16 }}>Top-Selling Products</h3>
                        {topSellingProducts.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>No sales data yet</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {topSellingProducts.map((prod, i) => {
                                    const maxCount = topSellingProducts[0]?.count || 1;
                                    return (
                                        <div key={prod.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <span style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, background: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : 'var(--border-color)', color: i < 3 ? '#fff' : 'var(--text-secondary)' }}>{i + 1}</span>
                                            <div style={{ flex: 1 }}>
                                                <p style={{ fontWeight: 600, marginBottom: 4, fontSize: '0.9rem' }}>{prod.title || 'Untitled'}</p>
                                                <div style={{ height: 6, borderRadius: 3, background: 'var(--border-color)', overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', borderRadius: 3, width: `${(prod.count / maxCount) * 100}%`, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', transition: 'width 0.5s ease' }} />
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
                    {lowStockProducts.length > 0 && (
                        <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
                            <h3 style={{ marginBottom: 12 }}>Low Stock Alerts</h3>
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
                    <div className="card" style={{ marginTop: 24 }}>
                        <h3 style={{ marginBottom: 16 }}>Incoming Orders</h3>
                        {mySellerTxns.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>No orders received yet</p>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                    <thead><tr style={{ borderBottom: '2px solid var(--border-color)' }}><th style={thStyle}>Product</th><th style={thStyle}>Qty</th><th style={thStyle}>Amount</th><th style={thStyle}>Your Share</th><th style={thStyle}>Status</th><th style={thStyle}>Date</th></tr></thead>
                                    <tbody>
                                        {mySellerTxns.map(t => (
                                            <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                <td style={tdStyle}>{t.product_title || 'Unknown'}</td>
                                                <td style={tdStyle}>{t.quantity || 1}</td>
                                                <td style={tdStyle}>₱{t.amount.toFixed(2)}</td>
                                                <td style={{ ...tdStyle, color: '#10b981', fontWeight: 600 }}>₱{t.seller_amount.toFixed(2)}</td>
                                                <td style={tdStyle}>
                                                    <span style={{
                                                        padding: '2px 8px', borderRadius: 10, fontSize: '0.75rem',
                                                        background: t.status === 'delivered' ? 'rgba(16,185,129,0.15)' : 'rgba(251,191,36,0.15)',
                                                        color: t.status === 'delivered' ? '#10b981' : '#fbbf24', fontWeight: 600,
                                                    }}>{t.status}</span>
                                                </td>
                                                <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{new Date(t.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
