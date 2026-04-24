'use client';

import { getTransactionHistory, getBalance, getStoredUser } from '../../lib/api';
import { useState, useEffect } from 'react';
import { Wallet, ShoppingCart, Calendar, Package } from 'lucide-react';

function MetricCard({ label, value, color, icon }) {
    return (
        <div className="card" style={{ padding: '20px 16px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -8, right: -8, opacity: 0.08 }}>
                {typeof icon === 'string' ? <span style={{fontSize: '3rem'}}>{icon}</span> : icon}
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 6 }}>{label}</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: color || 'var(--text-primary)' }}>{value}</p>
        </div>
    );
}

export default function TransactionsContent() {
    const [transactions, setTransactions] = useState([]);
    const [balance, setBalance] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('spending');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [spendingPeriod, setSpendingPeriod] = useState('daily');

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [txns, bal] = await Promise.all([getTransactionHistory(), getBalance()]);
            setTransactions(txns);
            setBalance(bal.balance);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const user = getStoredUser();
    const myBuyerTxns = transactions.filter(t => t.buyer_id === user?.id);
    const totalSpent = myBuyerTxns.reduce((sum, t) => sum + t.amount + (t.delivery_fee || 0), 0);
    const now = new Date();
    const thisMonthTxns = myBuyerTxns.filter(t => {
        const d = new Date(t.created_at);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const thisMonthSpent = thisMonthTxns.reduce((sum, t) => sum + t.amount + (t.delivery_fee || 0), 0);

    const getSpendingData = (period) => {
        const data = {};
        myBuyerTxns.forEach(t => {
            const d = new Date(t.created_at);
            let key;
            if (period === 'daily') {
                key = d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
            } else if (period === 'weekly') {
                const oneJan = new Date(d.getFullYear(), 0, 1);
                const week = Math.ceil(((d - oneJan) / 86400000 + oneJan.getDay() + 1) / 7);
                key = `W${week} ${d.getFullYear()}`;
            } else {
                key = d.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' });
            }
            data[key] = (data[key] || 0) + t.amount + (t.delivery_fee || 0);
        });
        const maxEntries = period === 'daily' ? 14 : period === 'weekly' ? 8 : 6;
        return Object.entries(data).slice(-maxEntries);
    };

    const spendingData = getSpendingData(spendingPeriod);
    const maxSpend = Math.max(...spendingData.map(([, v]) => v), 1);

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 12 }}>
                <div className="spinner" style={{ width: 40, height: 40 }}></div>
                <p style={{ color: 'var(--text-muted)' }}>Loading transactions...</p>
            </div>
        );
    }

    const tabs = [
        { key: 'spending', label: '💰 Spending' },
        { key: 'orders', label: '📦 Orders' },
    ];

    return (
        <div>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Transactions</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Personalized reports & order tracking</p>
            </div>

            <div style={{
                display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap',
                background: 'var(--card-bg)', borderRadius: 12, padding: 6,
                border: '1px solid var(--border-color)',
            }}>
                {tabs.map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                        flex: 1, minWidth: 100, padding: '12px 16px',
                        borderRadius: 8, border: 'none', cursor: 'pointer',
                        fontWeight: 600, fontSize: '0.9rem', transition: 'all 0.2s',
                        background: activeTab === tab.key ? 'var(--accent-primary)' : 'transparent',
                        color: activeTab === tab.key ? '#fff' : 'var(--text-secondary)',
                    }}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'spending' && (
                <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
                        <MetricCard label="Wallet Balance" value={`₱${balance !== null ? parseFloat(balance).toFixed(2) : '0.00'}`} color="#10b981" icon={<Wallet size={56} />} />
                        <MetricCard label="Total Spent" value={`₱${totalSpent.toFixed(2)}`} color="#ef4444" icon={<ShoppingCart size={56} />} />
                        <MetricCard label="This Month" value={`₱${thisMonthSpent.toFixed(2)}`} color="#f59e0b" icon={<Calendar size={56} />} />
                        <MetricCard label="Orders" value={myBuyerTxns.length} color="#6366f1" icon={<Package size={56} />} />
                    </div>

                    <div className="card" style={{ marginBottom: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3 style={{ margin: 0 }}>Spending Breakdown</h3>
                            <div style={{ display: 'flex', gap: 4, background: 'var(--bg-secondary)', borderRadius: 8, padding: 3 }}>
                                {['daily', 'weekly', 'monthly'].map(p => (
                                    <button key={p} onClick={() => setSpendingPeriod(p)} style={{
                                        padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                                        fontSize: '0.75rem', fontWeight: 600, transition: 'all 0.2s',
                                        background: spendingPeriod === p ? 'var(--accent-primary)' : 'transparent',
                                        color: spendingPeriod === p ? '#fff' : 'var(--text-muted)',
                                        textTransform: 'capitalize',
                                    }}>{p}</button>
                                ))}
                            </div>
                        </div>
                        {spendingData.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>No spending data yet</p>
                        ) : (
                            <div style={{ position: 'relative', height: 200, padding: '0 4px' }}>
                                <svg viewBox={`0 0 ${Math.max(spendingData.length, 1) * 60} 180`} style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
                                    {[0, 0.25, 0.5, 0.75, 1].map(frac => (
                                        <line key={frac} x1="0" y1={20 + (1 - frac) * 140} x2={Math.max(spendingData.length, 1) * 60} y2={20 + (1 - frac) * 140} stroke="var(--border-color)" strokeWidth="1" opacity="0.5" />
                                    ))}
                                    <polygon points={[...spendingData.map(([, v], i) => `${i * 60 + 30},${20 + (1 - v / maxSpend) * 140}`), `${(spendingData.length - 1) * 60 + 30},160`, `30,160`].join(' ')} fill="url(#areaGradSpend)" opacity="0.3" />
                                    <polyline points={spendingData.map(([, v], i) => `${i * 60 + 30},${20 + (1 - v / maxSpend) * 140}`).join(' ')} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                                    {spendingData.map(([, v], i) => (<circle key={i} cx={i * 60 + 30} cy={20 + (1 - v / maxSpend) * 140} r="4" fill="#6366f1" stroke="#1a1a2e" strokeWidth="2" />))}
                                    <defs><linearGradient id="areaGradSpend" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="transparent" /></linearGradient></defs>
                                </svg>
                                <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 4 }}>
                                    {spendingData.map(([label, value]) => (
                                        <div key={label} style={{ textAlign: 'center', flex: 1 }}>
                                            <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{label}</p>
                                            <p style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontWeight: 600 }}>₱{value.toFixed(0)}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'orders' && (
                <div>
                    <div className="card" style={{ marginBottom: 24 }}>
                        <h3 style={{ marginBottom: 16 }}>Order Status</h3>
                        {myBuyerTxns.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>No orders yet. Start shopping!</p>
                        ) : (
                            <div style={{ maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 6 }}>
                                {myBuyerTxns.map(t => {
                                    const statusMap = {
                                        ondeliver: { label: 'On Deliver', color: '#3b82f6', progress: 30 },
                                        delivered: { label: 'Delivered', color: '#10b981', progress: 100 },
                                        undelivered: { label: 'Undelivered', color: '#ef4444', progress: 0 },
                                        cancelled: { label: 'Cancelled', color: '#94a3b8', progress: 0 },
                                    };
                                    const sInfo = statusMap[t.status] || statusMap.ondeliver;
                                    const productImage = t.product_images && t.product_images.length > 0 ? t.product_images[0] : null;
                                    return (
                                        <div key={t.id} onClick={() => setSelectedOrder(t)} style={{
                                            display: 'flex', gap: 12, padding: 14, borderRadius: 12, cursor: 'pointer',
                                            border: '1px solid var(--border-color)', background: 'var(--card-bg)', transition: 'border-color 0.2s',
                                        }}
                                            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
                                            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                                        >
                                            <div style={{ width: 56, height: 56, borderRadius: 10, overflow: 'hidden', background: 'var(--bg-secondary)', flexShrink: 0 }}>
                                                {productImage ? (
                                                    <img src={productImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                                                ) : (
                                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '1.2rem' }}>📦</div>
                                                )}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                                                    <div style={{ minWidth: 0, flex: 1, marginRight: 8 }}>
                                                        <p style={{ fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.product_title || 'Product'}</p>
                                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.seller_name || 'Seller'} • {new Date(t.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</p>
                                                    </div>
                                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: '0.7rem', fontWeight: 600, background: `${sInfo.color}20`, color: sInfo.color }}>{sInfo.label}</span>
                                                        <p style={{ fontSize: '0.85rem', fontWeight: 700, marginTop: 2 }}>₱{(t.amount + (t.delivery_fee || 0)).toFixed(2)}</p>
                                                    </div>
                                                </div>
                                                <div style={{ height: 3, borderRadius: 2, background: 'var(--border-color)' }}>
                                                    <div style={{ height: '100%', borderRadius: 2, width: `${sInfo.progress}%`, background: sInfo.color, transition: 'width 0.5s' }} />
                                                </div>
                                                {t.delivery_user_name && <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>🚚 {t.delivery_user_name}</p>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {selectedOrder && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => setSelectedOrder(null)}>
                    <div className="card" style={{ maxWidth: 480, width: '100%', padding: 32 }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ marginBottom: 4 }}>Order Details</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 20 }}>{new Date(selectedOrder.created_at).toLocaleString()}</p>
                        {selectedOrder.product_images && selectedOrder.product_images[0] && (
                            <div style={{ width: '100%', height: 160, borderRadius: 12, overflow: 'hidden', marginBottom: 16, background: 'var(--bg-secondary)' }}>
                                <img src={selectedOrder.product_images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                        )}
                        <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
                            {[
                                ['Product', selectedOrder.product_title, { fontWeight: 600 }],
                                ['Seller', selectedOrder.seller_name || '—', { fontWeight: 600 }],
                                ['Quantity', selectedOrder.quantity || 1, {}],
                                ['Amount', `₱${selectedOrder.amount.toFixed(2)}`, {}],
                                ['Delivery Fee', `₱${(selectedOrder.delivery_fee || 0).toFixed(2)}`, {}],
                                ['Total', `₱${(selectedOrder.amount + (selectedOrder.delivery_fee || 0)).toFixed(2)}`, { fontWeight: 700, color: 'var(--accent-secondary)' }],
                            ].map(([lbl, val, style]) => (
                                <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>{lbl}</span>
                                    <span style={style}>{val}</span>
                                </div>
                            ))}
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Status</span>
                                <span style={{
                                    padding: '3px 10px', borderRadius: 12, fontSize: '0.8rem', fontWeight: 700,
                                    background: ({ ondeliver: 'rgba(59,130,246,0.15)', delivered: 'rgba(16,185,129,0.15)', undelivered: 'rgba(239,68,68,0.15)' })[selectedOrder.status] || 'rgba(148,163,184,0.15)',
                                    color: ({ ondeliver: '#3b82f6', delivered: '#10b981', undelivered: '#ef4444' })[selectedOrder.status] || '#94a3b8',
                                }}>{selectedOrder.status}</span>
                            </div>
                        </div>
                        {selectedOrder.delivery_user_name ? (
                            <div style={{ padding: 16, borderRadius: 10, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', marginBottom: 16 }}>
                                <h4 style={{ fontWeight: 700, marginBottom: 8, fontSize: '0.9rem' }}>🚚 Delivery Man Info</h4>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.85rem' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Name</span><span style={{ fontWeight: 600 }}>{selectedOrder.delivery_user_name}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Contact</span><span style={{ fontWeight: 600 }}>{selectedOrder.delivery_user_contact || 'N/A'}</span>
                                </div>
                            </div>
                        ) : (
                            <div style={{ padding: 14, borderRadius: 10, background: 'rgba(148,163,184,0.08)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 16 }}>No delivery man assigned yet</div>
                        )}
                        <button className="btn btn-outline" style={{ width: '100%' }} onClick={() => setSelectedOrder(null)}>Close</button>
                    </div>
                </div>
            )}
        </div>
    );
}
