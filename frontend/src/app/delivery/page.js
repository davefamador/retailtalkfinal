'use client';

import { useState, useEffect } from 'react';
import {
    getStoredUser, getAvailableOrders, getActiveDeliveries, pickOrder,
    updateDeliveryStatus, getDeliveryEarnings, getDeliveryHistory,
    deliveryWithdraw, getMyContact, setMyContact,
    getRestockDeliveryQueue, acceptRestockDelivery, completeRestockDelivery, getActiveRestockDeliveries,
    getRestockDeliveryHistory, logout
} from '../../lib/api';
import Toast from '../components/Toast';

const STATUS_COLORS = {
    approved: { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
    ondeliver: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
    delivered: { bg: 'rgba(0,212,170,0.12)', color: '#00d4aa' },
    undelivered: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
    cancelled: { bg: 'rgba(148,163,184,0.12)', color: '#94a3b8' },
};

const RESTOCK_STATUS_COLORS = {
    approved_manager: { bg: 'rgba(251,191,36,0.12)', color: '#fbbf24' },
    accepted_delivery: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
    in_transit: { bg: 'rgba(168,85,247,0.12)', color: '#a855f7' },
    delivered: { bg: 'rgba(0,212,170,0.12)', color: '#00d4aa' },
};

const RESTOCK_STATUS_LABEL = {
    approved_manager: 'Awaiting Pickup',
    accepted_delivery: 'Accepted',
    in_transit: 'In Transit',
    delivered: 'Delivered',
};

function SidebarItem({ icon, label, active, onClick, badge }) {
    return (
        <button onClick={onClick} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 20px', width: '100%',
            border: 'none', cursor: 'pointer',
            background: active ? 'rgba(108,99,255,0.15)' : 'transparent',
            color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
            fontWeight: active ? 600 : 400,
            fontSize: '0.9rem', borderRadius: 10, textAlign: 'left',
            transition: 'all 0.2s',
            fontFamily: 'Inter, sans-serif',
        }}>
            <span style={{ fontSize: '1.1rem', width: 24, textAlign: 'center' }}>{icon}</span>
            <span style={{ flex: 1 }}>{label}</span>
            {badge != null && badge > 0 && (
                <span style={{
                    background: 'var(--accent-primary)', color: '#fff',
                    fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px',
                    borderRadius: 12, minWidth: 20, textAlign: 'center',
                }}>{badge}</span>
            )}
        </button>
    );
}

export default function DeliveryPage() {
    const [user, setUser] = useState(null);
    const [activeSection, setActiveSection] = useState('dashboard');
    const [available, setAvailable] = useState([]);
    const [active, setActive] = useState([]);
    const [earnings, setEarnings] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState('');
    const [err, setErr] = useState('');
    const [withdrawAmt, setWithdrawAmt] = useState('');
    const [contactModal, setContactModal] = useState(false);
    const [contactNum, setContactNum] = useState('');
    const [graphPeriod, setGraphPeriod] = useState('daily');
    const [restockQueue, setRestockQueue] = useState([]);
    const [restockActive, setRestockActive] = useState([]);
    const [restockHistory, setRestockHistory] = useState([]);
    const [historyFilter, setHistoryFilter] = useState('delivery');
    const [historyTab, setHistoryTab] = useState('delivery');
    const [confirmModal, setConfirmModal] = useState(null); // { groupId, status }
    const [selectedOrder, setSelectedOrder] = useState(null); // order group for detail modal

    useEffect(() => {
        const u = getStoredUser();
        setUser(u);
        if (u && u.role === 'delivery') loadAll();
        else setLoading(false);
    }, []);



    const loadAll = async () => {
        setLoading(true);
        try {
            const [avail, act, earn, hist, rQueue, rActive, rHist] = await Promise.all([
                getAvailableOrders(), getActiveDeliveries(), getDeliveryEarnings(), getDeliveryHistory(),
                getRestockDeliveryQueue().catch(() => []), getActiveRestockDeliveries().catch(() => []),
                getRestockDeliveryHistory().catch(() => [])
            ]);
            setAvailable(avail); setActive(act); setEarnings(earn); setHistory(hist);
            setRestockQueue(rQueue); setRestockActive(rActive); setRestockHistory(rHist);
        } catch (e) { setErr(e.message); }
        finally { setLoading(false); }
    };

    const handlePick = async (txnId) => {
        setErr(''); setMsg('');
        try {
            const r = await pickOrder(txnId);
            setMsg(r.message); await loadAll();
        } catch (e) {
            if (e.message?.includes('contact number')) setContactModal(true);
            else setErr(e.message);
        }
    };

    const handleStatus = async (txnId, status) => {
        setErr(''); setMsg('');
        try {
            const r = await updateDeliveryStatus(txnId, status);
            setMsg(r.message); await loadAll();
        } catch (e) { setErr(e.message); }
    };

    const handleWithdraw = async () => {
        const amt = parseFloat(withdrawAmt);
        if (!amt || amt <= 0) { setErr('Enter a valid amount'); return; }
        try {
            const r = await deliveryWithdraw(amt);
            setMsg(r.message); setWithdrawAmt(''); await loadAll();
        } catch (e) { setErr(e.message); }
    };

    const handleSaveContact = async () => {
        try {
            await setMyContact(contactNum.trim());
            setContactModal(false); setMsg('Contact saved!');
        } catch (e) { setErr(e.message); }
    };

    const handleAcceptRestock = async (id) => {
        setErr(''); setMsg('');
        try {
            const r = await acceptRestockDelivery(id);
            setMsg(r.message || 'Restock delivery accepted'); await loadAll();
        } catch (e) { setErr(e.message); }
    };

    const handleCompleteRestock = async (id) => {
        setErr(''); setMsg('');
        try {
            const r = await completeRestockDelivery(id);
            setMsg(r.message || 'Restock marked as delivered'); await loadAll();
        } catch (e) { setErr(e.message); }
    };

    const handleLogout = () => { logout(); window.location.href = '/login'; };

    if (!user || user.role !== 'delivery') {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="card" style={{ textAlign: 'center', padding: 40 }}>
                    <h2>Delivery Dashboard</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Please log in as a delivery user.</p>
                    <a href="/login" className="btn btn-primary" style={{ marginTop: 16 }}>Login</a>
                </div>
            </div>
        );
    }

    // Single line chart component with gap filling
    const LineChart = ({ data, period, valueKey = 'amount' }) => {
        if (!data) return null;
        let points = [];
        const svgW = 600, svgH = 160, padX = 20, padY = 20;
        const plotW = svgW - padX * 2, plotH = svgH - padY * 2;

        if (period === 'daily') {
            for (let i = 13; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const backendDate = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
                const label = (d.getMonth() + 1) + '-' + d.getDate();
                const matched = data.find(x => x.date === backendDate);
                points.push({
                    label,
                    val: matched ? matched[valueKey] : 0,
                });
            }
        } else if (period === 'monthly') {
            const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            const year = new Date().getFullYear();
            months.forEach((m, i) => {
                const backendDate = year + '-' + String(i + 1).padStart(2, '0');
                const matched = data.find(x => x.date === backendDate);
                points.push({
                    label: m,
                    val: matched ? matched[valueKey] : 0,
                });
            });
        } else { return null; }

        const maxVal = Math.max(...points.map(d => d.val), valueKey === 'count' ? 5 : 1);

        points = points.map((p, i) => {
            const cx = padX + (i / (points.length - 1)) * plotW;
            return {
                ...p,
                x: cx,
                y: padY + plotH - (p.val / maxVal) * plotH,
            };
        });

        const getLinePath = () => {
            if (points.length === 0) return '';
            if (points.length === 1) return `M${points[0].x},${points[0].y}`;
            let path = `M${points[0].x},${points[0].y}`;
            for (let i = 1; i < points.length; i++) {
                const cpx = (points[i - 1].x + points[i].x) / 2;
                path += ` C${cpx},${points[i - 1].y} ${cpx},${points[i].y} ${points[i].x},${points[i].y}`;
            }
            return path;
        };

        const path = getLinePath();
        const color = valueKey === 'amount' ? 'var(--accent-primary, #6c63ff)' : '#10b981';
        
        // Area path
        const areaPath = points.length > 1 ? path + ` L${points[points.length - 1].x},${padY + plotH} L${points[0].x},${padY + plotH} Z` : '';
        const gradId = `lineGrad_${valueKey}`;

        return (
            <div style={{ position: 'relative', width: '100%', marginTop: 10 }}>
                <svg viewBox={`0 0 ${svgW} ${svgH + 20}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                    <defs>
                        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
                            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                        </linearGradient>
                    </defs>
                    {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => (
                        <g key={i}>
                            <line x1={padX} y1={padY + plotH * (1 - frac)} x2={padX + plotW} y2={padY + plotH * (1 - frac)}
                                stroke="var(--border-color)" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="4 4" />
                        </g>
                    ))}
                    {/* Area fill */}
                    {areaPath && <path d={areaPath} fill={`url(#${gradId})`} />}
                    {/* Path */}
                    <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    {/* Points and Labels */}
                    {points.map((p, i) => (
                        <g key={i}>
                            <circle cx={p.x} cy={p.y} r="4" fill={color} stroke="var(--bg-card)" strokeWidth="2" />
                            <text x={p.x} y={svgH + 10} textAnchor="middle" fill="var(--text-muted)" fontSize="9" fontWeight="600" fontFamily="Inter, sans-serif">
                                {p.label}
                            </text>
                            {/* Values */}
                            {p.val > 0 && <text x={p.x} y={p.y - 8} textAnchor="middle" fill={color} fontSize="8" fontWeight="700">
                                {valueKey === 'amount' ? `₱${p.val}` : p.val}
                            </text>}
                        </g>
                    ))}
                </svg>
            </div>
        );
    };

    // Render product image helper
    const renderProductImage = (images) => {
        const img = images && images.length > 0 ? images[0] : null;
        if (!img) return null;
        return (
            <div style={{
                width: 64, height: 64, borderRadius: 10, overflow: 'hidden',
                background: 'var(--bg-secondary)', flexShrink: 0,
            }}>
                <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => e.target.style.display = 'none'} />
            </div>
        );
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            {/* ===== SIDEBAR ===== */}
            <aside style={{
                width: 260, background: 'var(--bg-secondary)',
                borderRight: '1px solid var(--border-color)',
                display: 'flex', flexDirection: 'column',
                position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 200,
            }}>
                <a href="/" style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '20px 20px 16px', textDecoration: 'none',
                    borderBottom: '1px solid var(--border-color)',
                }}>
                    <img src="/logo.png" alt="RetailTalk" style={{ height: 28, width: 28 }} />
                    <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif' }}>RetailTalk</span>
                </a>

                <nav style={{ padding: '16px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <SidebarItem icon="📊" label="Dashboard" active={activeSection === 'dashboard'} onClick={() => setActiveSection('dashboard')} />
                    <SidebarItem icon="🚚" label="Delivery" active={activeSection === 'delivery'} onClick={() => setActiveSection('delivery')} badge={available.length + restockQueue.length} />

                    <div style={{ height: 1, background: 'var(--border-color)', margin: '8px 0' }} />

                    <SidebarItem icon="💰" label="Transactions" active={activeSection === 'transactions'} onClick={() => setActiveSection('transactions')} />
                    <SidebarItem icon="🕒" label="History" active={activeSection === 'history'} onClick={() => setActiveSection('history')} />
                </nav>

                <div style={{
                    padding: '16px 20px', borderTop: '1px solid var(--border-color)',
                    display: 'flex', alignItems: 'center', gap: 12,
                }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: 'rgba(59,130,246,0.15)', color: '#3b82f6',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: '0.85rem',
                    }}>
                        {user?.full_name?.charAt(0)?.toUpperCase() || 'D'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {user?.full_name}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Delivery</div>
                    </div>
                    <button onClick={handleLogout} title="Logout" style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', fontSize: '1.1rem',
                    }}>🚪</button>
                </div>
            </aside>

            {/* ===== MAIN CONTENT ===== */}
            <main style={{ marginLeft: 260, flex: 1, padding: '32px 40px', maxWidth: 1200 }}>
            {/* ===== TOAST NOTIFICATION ===== */}
                <Toast 
                    message={err ? { type: 'error', text: err } : msg ? { type: 'success', text: msg } : null} 
                    onClose={() => { setErr(''); setMsg(''); }} 
                />

                {loading && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 16 }}>
                        <div className="spinner" style={{ width: 40, height: 40 }}></div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading data...</p>
                    </div>
                )}

                {/* ===== DASHBOARD ===== */}
                {activeSection === 'dashboard' && !loading && (
                    <div>
                        <div style={{ marginBottom: 24 }}>
                            <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Dashboard</h1>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Overview of your delivery activity</p>
                        </div>

                        {/* Summary cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
                            <div className="card" style={{ padding: 20, textAlign: 'center' }}>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Active Deliveries</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#3b82f6' }}>{active.length}/5</div>
                            </div>
                            <div className="card" style={{ padding: 20, textAlign: 'center' }}>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Available Orders</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fbbf24' }}>{available.length}</div>
                            </div>
                            <div className="card" style={{ padding: 20, textAlign: 'center' }}>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Total Earnings</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>PHP {earnings?.total_earnings?.toFixed(2) || '0.00'}</div>
                            </div>
                            <div className="card" style={{ padding: 20, textAlign: 'center' }}>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Wallet Balance</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-primary)' }}>PHP {earnings?.wallet_balance?.toFixed(2) || '0.00'}</div>
                            </div>
                        </div>

                        {/* Total Deliveries */}
                        <div className="card" style={{ padding: 20, marginBottom: 24, textAlign: 'center' }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Total Deliveries Completed</div>
                            <div style={{ fontSize: '2rem', fontWeight: 800 }}>{earnings?.total_deliveries || 0}</div>
                        </div>

                        {/* Restock summary */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                            <div className="card" style={{ padding: 20, textAlign: 'center' }}>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Active Restock</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#a855f7' }}>{restockActive.length}</div>
                            </div>
                            <div className="card" style={{ padding: 20, textAlign: 'center' }}>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Restock Queue</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fbbf24' }}>{restockQueue.length}</div>
                            </div>
                        </div>

                        {/* Report Section — Earnings & Delivery Count Graphs */}
                        {earnings && (
                            <>
                                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: 28, marginBottom: 12 }}>Delivery Report</h2>
                                {/* Graph period toggle */}
                                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                                    {['daily', 'monthly'].map(p => (
                                        <button key={p} onClick={() => setGraphPeriod(p)} style={{
                                            padding: '8px 18px', borderRadius: 10, fontSize: '0.85rem', fontWeight: 600,
                                            border: '1px solid',
                                            borderColor: graphPeriod === p ? 'var(--accent-primary)' : 'var(--border-color)',
                                            background: graphPeriod === p ? 'rgba(99,102,241,0.15)' : 'transparent',
                                            color: graphPeriod === p ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                            cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'Inter, sans-serif',
                                        }}>{p.charAt(0).toUpperCase() + p.slice(1)}</button>
                                    ))}
                                </div>

                                {/* Earnings graph */}
                                <div className="card" style={{ padding: 20, marginBottom: 16 }}>
                                    <h4 style={{ marginBottom: 10, fontWeight: 700 }}>Earnings ({graphPeriod})</h4>
                                    <LineChart data={earnings[graphPeriod]} period={graphPeriod} valueKey="amount" />
                                </div>

                                {/* Delivery count graph */}
                                <div className="card" style={{ padding: 20 }}>
                                    <h4 style={{ marginBottom: 10, fontWeight: 700 }}>Deliveries Count ({graphPeriod})</h4>
                                    <LineChart data={earnings[graphPeriod]} period={graphPeriod} valueKey="count" />
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* ===== DELIVERY ===== */}
                {activeSection === 'delivery' && !loading && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <div>
                                <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Delivery</h1>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Manage your product and restock deliveries</p>
                            </div>
                            <button className="btn btn-outline btn-sm" onClick={loadAll}>Refresh</button>
                        </div>

                        {/* === Active Deliveries (combined product + restock, max 5) === */}
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 12 }}>
                            Active Deliveries ({active.length + restockActive.length}/5)
                        </h2>
                        {active.length === 0 && restockActive.length === 0 ? (
                            <div className="card" style={{ padding: 24, textAlign: 'center', marginBottom: 24, color: 'var(--text-muted)' }}>No active deliveries</div>
                        ) : (
                            <div style={{ display: 'grid', gap: 16, marginBottom: 24 }}>
                                {active.map(g => (
                                    <div key={g.group_id} className="card" onClick={() => setSelectedOrder(g)} style={{ padding: 20, border: '1px solid rgba(59,130,246,0.3)', cursor: 'pointer' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>📦 Delivery Box <span style={{ fontSize: '0.75rem', background: 'rgba(99,102,241,0.15)', color: 'var(--accent-primary)', borderRadius: 6, padding: '2px 8px', marginLeft: 6 }}>Product</span></div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Buyer: {g.buyer_name} | Store: {g.seller_name}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>📞 {g.buyer_contact}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', marginTop: 2, fontWeight: 600 }}>📍 {g.delivery_address || 'No address set'}</div>
                                            </div>
                                            <span style={{ ...STATUS_COLORS.ondeliver, padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, flexShrink: 0 }}>On Deliver</span>
                                        </div>
                                        <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                                            {(g.items || []).map((item, idx) => (
                                                <div key={item.transaction_id || idx} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: idx < g.items.length - 1 ? 8 : 0 }}>
                                                    {renderProductImage(item.product_images)}
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.product_title}</div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Qty: {item.quantity} × PHP {item.product_price?.toFixed(2)}</div>
                                                    </div>
                                                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>PHP {item.amount?.toFixed(2)}</div>
                                                </div>
                                            ))}
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                                            <span>Products: PHP {g.total_amount?.toFixed(2)}</span>
                                            <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>Delivery Fee: PHP {g.delivery_fee?.toFixed(2)}</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
                                            <button className="btn btn-sm" onClick={() => setConfirmModal({ groupId: g.group_id, status: 'delivered' })}
                                                style={{ background: 'rgba(0,212,170,0.15)', color: '#00d4aa', border: 'none', fontWeight: 600 }}>Delivered</button>
                                            <button className="btn btn-sm" onClick={() => setConfirmModal({ groupId: g.group_id, status: 'undelivered' })}
                                                style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none', fontWeight: 600 }}>Undelivered</button>
                                        </div>
                                    </div>
                                ))}
                                {restockActive.map(r => (
                                    <div key={r.id} className="card" style={{ padding: 20, border: '1px solid rgba(168,85,247,0.3)' }}>
                                        <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                                            {renderProductImage(r.product_images)}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div>
                                                        <h4 style={{ fontWeight: 700, marginBottom: 4 }}>{r.product_title || 'Product'} <span style={{ fontSize: '0.75rem', background: 'rgba(168,85,247,0.15)', color: '#a855f7', borderRadius: 6, padding: '2px 8px', marginLeft: 4 }}>Restock</span></h4>
                                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                                                            Dept: {r.department_name || 'N/A'} | By: {r.staff_name || 'Staff'} | Qty: {r.quantity || r.approved_quantity || r.requested_quantity}
                                                        </p>
                                                        {r.notes && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>Note: {r.notes}</p>}
                                                    </div>
                                                    <span style={{ ...(RESTOCK_STATUS_COLORS[r.status] || {}), padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, flexShrink: 0 }}>
                                                        {RESTOCK_STATUS_LABEL[r.status] || r.status}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <button className="btn btn-sm" onClick={() => handleCompleteRestock(r.id)}
                                            style={{ background: 'rgba(0,212,170,0.15)', color: '#00d4aa', border: 'none', fontWeight: 600 }}>
                                            Mark Delivered
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* === Filter tabs for available requests === */}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                            {[
                                { key: 'delivery', label: 'Product Delivery' },
                                { key: 'restock', label: 'Restock Delivery' },
                            ].map(f => (
                                <button key={f.key} onClick={() => setHistoryFilter(f.key)} style={{
                                    padding: '8px 18px', borderRadius: 10, fontSize: '0.85rem', fontWeight: 600,
                                    border: '1px solid',
                                    borderColor: historyFilter === f.key ? 'var(--accent-primary)' : 'var(--border-color)',
                                    background: historyFilter === f.key ? 'rgba(99,102,241,0.15)' : 'transparent',
                                    color: historyFilter === f.key ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                    cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'Inter, sans-serif',
                                }}>{f.label}</button>
                            ))}
                        </div>

                        {/* === Product Delivery available === */}
                        {historyFilter === 'delivery' && (
                            <div>
                                {/* Available Orders */}
                                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 12 }}>
                                    Available for Pickup ({available.length})
                                </h2>
                                {available.length === 0 ? (
                                    <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No orders available for pickup</div>
                                ) : (
                                    <div style={{ display: 'grid', gap: 16 }}>
                                        {available.map(g => (
                                            <div key={g.group_id} className="card" onClick={() => setSelectedOrder(g)} style={{ padding: 20, border: '1px solid rgba(16,185,129,0.3)', cursor: 'pointer' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                                    <div>
                                                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>📦 Delivery Box</div>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Buyer: {g.buyer_name} | Store: {g.seller_name}</div>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>📞 {g.buyer_contact}</div>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', marginTop: 2, fontWeight: 600 }}>📍 {g.delivery_address || 'No address set'}</div>
                                                    </div>
                                                    <span style={{ ...STATUS_COLORS.approved, padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, flexShrink: 0 }}>Ready</span>
                                                </div>
                                                <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                                                    {(g.items || []).map((item, idx) => (
                                                        <div key={item.transaction_id || idx} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: idx < g.items.length - 1 ? 8 : 0 }}>
                                                            {renderProductImage(item.product_images)}
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.product_title}</div>
                                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Qty: {item.quantity} × PHP {item.product_price?.toFixed(2)}</div>
                                                            </div>
                                                            <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>PHP {item.amount?.toFixed(2)}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                                                    <span>Products: PHP {g.total_amount?.toFixed(2)}</span>
                                                    <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>Delivery Fee: PHP {g.delivery_fee?.toFixed(2)}</span>
                                                </div>
                                                <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); handlePick(g.group_id); }}
                                                    disabled={active.length + restockActive.length >= 5} style={{ fontWeight: 600 }}>
                                                    {active.length + restockActive.length >= 5 ? 'Max deliveries reached (5)' : '🚚 Pick Up Box'}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* === Restock available === */}
                        {historyFilter === 'restock' && (
                            <div>
                                {/* Available Restock Queue */}
                                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 12 }}>
                                    Available Restock Requests ({restockQueue.length})
                                </h2>
                                {restockQueue.length === 0 ? (
                                    <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No restock requests available</div>
                                ) : (
                                    <div style={{ display: 'grid', gap: 12 }}>
                                        {restockQueue.map(r => (
                                            <div key={r.id} className="card" style={{ padding: 20 }}>
                                                <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                                                    {renderProductImage(r.product_images)}
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                            <h4 style={{ fontWeight: 700, marginBottom: 4 }}>{r.product_title || 'Product'}</h4>
                                                            <span style={{
                                                                ...RESTOCK_STATUS_COLORS.approved_manager,
                                                                padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, flexShrink: 0,
                                                            }}>Approved</span>
                                                        </div>
                                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                            Dept: {r.department_name || 'N/A'} | By: {r.staff_name || 'Staff'} | Qty: {r.quantity || r.approved_quantity || r.requested_quantity}
                                                        </p>
                                                        {r.notes && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>Note: {r.notes}</p>}
                                                        {r.manager_notes && <p style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', marginTop: 4 }}>Manager: {r.manager_notes}</p>}
                                                    </div>
                                                </div>
                                                <button className="btn btn-primary btn-sm" onClick={() => handleAcceptRestock(r.id)}
                                                    disabled={active.length + restockActive.length >= 5} style={{ fontWeight: 600 }}>
                                                    {active.length + restockActive.length >= 5 ? 'Max deliveries reached (5)' : 'Accept Restock'}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                )}

                {/* ===== HISTORY ===== */}
                {activeSection === 'history' && !loading && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <div>
                                <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Delivery History</h1>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>View past product and restock deliveries</p>
                            </div>
                            <button className="btn btn-outline btn-sm" onClick={loadAll}>Refresh</button>
                        </div>

                        {/* Filter buttons */}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                            {[{ key: 'delivery', label: 'Product Delivery' }, { key: 'restock', label: 'Restock' }].map(f => (
                                <button key={f.key} onClick={() => setHistoryTab(f.key)} style={{
                                    padding: '8px 18px', borderRadius: 10, fontSize: '0.85rem', fontWeight: 600,
                                    border: '1px solid',
                                    borderColor: historyTab === f.key ? 'var(--accent-primary)' : 'var(--border-color)',
                                    background: historyTab === f.key ? 'rgba(99,102,241,0.15)' : 'transparent',
                                    color: historyTab === f.key ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                    cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'Inter, sans-serif',
                                }}>{f.label}</button>
                            ))}
                        </div>

                        {historyTab === 'delivery' && (
                            history.length === 0 ? (
                                <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No delivery history yet</div>
                            ) : (
                                <div style={{ display: 'grid', gap: 16 }}>
                                    {history.map(h => (
                                        <div key={h.group_id} className="card" onClick={() => setSelectedOrder(h)} style={{ padding: 20, cursor: 'pointer' }}>
                                            {/* Group header */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>📦 Delivery Box</div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                        Buyer: {h.buyer_name} | Store: {h.seller_name}
                                                    </div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>📞 {h.buyer_contact}</div>
                                                    <div style={{ fontSize: '0.8rem', color: h.delivery_address ? 'var(--accent-primary)' : 'var(--text-muted)', marginTop: 2, fontWeight: h.delivery_address ? 600 : 400 }}>📍 {h.delivery_address || 'No address set'}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Date: {new Date(h.created_at).toLocaleString()}</div>
                                                </div>
                                                <span style={{
                                                    ...(STATUS_COLORS[h.status] || {}),
                                                    padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, flexShrink: 0,
                                                }}>{h.status}</span>
                                            </div>
                                            {/* Items in box */}
                                            <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                                                {(h.items || []).map((item, idx) => (
                                                    <div key={item.transaction_id || idx} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: idx < h.items.length - 1 ? 8 : 0 }}>
                                                        {renderProductImage(item.product_images)}
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.product_title}</div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Qty: {item.quantity} × PHP {item.product_price?.toFixed(2)}</div>
                                                        </div>
                                                        <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>PHP {item.amount?.toFixed(2)}</div>
                                                    </div>
                                                ))}
                                            </div>
                                            {/* Totals */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                <span>Products: PHP {h.total_amount?.toFixed(2)}</span>
                                                <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>Delivery Fee: PHP {h.delivery_fee?.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}

                        {historyTab === 'restock' && (
                            restockHistory.length === 0 ? (
                                <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No restock history yet</div>
                            ) : (
                                <div style={{ display: 'grid', gap: 12 }}>
                                    {restockHistory.map(r => (
                                        <div key={r.id} className="card" style={{ padding: 20 }}>
                                            <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                                                {renderProductImage(r.product_images)}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                        <h4 style={{ fontWeight: 700, marginBottom: 4 }}>{r.product_title || 'Product'}</h4>
                                                        <span style={{
                                                            ...(RESTOCK_STATUS_COLORS[r.status] || {}),
                                                            padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, flexShrink: 0,
                                                        }}>{RESTOCK_STATUS_LABEL[r.status] || r.status}</span>
                                                    </div>
                                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                        Dept: {r.department_name} | By: {r.staff_name} | Qty: {r.quantity}
                                                    </p>
                                                    {r.notes && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>Note: {r.notes}</p>}
                                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                                        {r.delivered_at ? new Date(r.delivered_at).toLocaleString() : new Date(r.created_at).toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}
                    </div>
                )}

                {/* ===== TRANSACTIONS ===== */}
                {activeSection === 'transactions' && !loading && earnings && (
                    <div>
                        <div style={{ marginBottom: 24 }}>
                            <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Transactions</h1>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Your delivery earnings and wallet</p>
                        </div>

                        {/* Summary cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
                            <div className="card" style={{ padding: 20, textAlign: 'center' }}>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Total Earnings</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>PHP {earnings.total_earnings.toFixed(2)}</div>
                            </div>
                            <div className="card" style={{ padding: 20, textAlign: 'center' }}>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Total Deliveries</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{earnings.total_deliveries}</div>
                            </div>
                            <div className="card" style={{ padding: 20, textAlign: 'center' }}>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Wallet Balance</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-primary)' }}>PHP {earnings.wallet_balance.toFixed(2)}</div>
                            </div>
                        </div>

                        {/* Withdraw */}
                        <div className="card" style={{ padding: 20, marginBottom: 24 }}>
                            <h3 style={{ marginBottom: 12, fontWeight: 700 }}>Withdraw Earnings</h3>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <input type="number" placeholder="Amount" value={withdrawAmt} onChange={e => setWithdrawAmt(e.target.value)} style={{ flex: 1 }} />
                                <button className="btn btn-primary" onClick={handleWithdraw}>Withdraw</button>
                            </div>
                        </div>

                        {/* Transaction History */}
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 12 }}>Transaction History</h2>
                        <div className="card" style={{ padding: 20 }}>
                            {(!earnings.history || earnings.history.length === 0) ? (
                                <p style={{ color: 'var(--text-muted)', textAlign: 'center', margin: '20px 0' }}>No transactions found.</p>
                            ) : (
                                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                                            <th style={{ padding: '12px 8px', fontWeight: 600 }}>Type</th>
                                            <th style={{ padding: '12px 8px', fontWeight: 600 }}>Date</th>
                                            <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'right' }}>Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {earnings.history.map((tx, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                <td style={{ padding: '12px 8px', fontWeight: 500, color: tx.type === 'Withdrawal' ? '#ef4444' : 'var(--accent-primary)' }}>
                                                    {tx.type}
                                                </td>
                                                <td style={{ padding: '12px 8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                    {new Date(tx.date).toLocaleString()}
                                                </td>
                                                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700 }}>
                                                    {tx.type === 'Withdrawal' ? '-' : '+'}₱{tx.amount.toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                )}

            </main>

            {/* Order Detail Modal */}
            {selectedOrder && (
                <div
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050, padding: 20 }}
                    onClick={() => setSelectedOrder(null)}
                >
                    <div className="card" style={{ maxWidth: 520, width: '100%', padding: 28, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                            <div>
                                <div style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: 4 }}>📦 Delivery Box</div>
                                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Buyer: <strong>{selectedOrder.buyer_name}</strong> | Store: {selectedOrder.seller_name}</div>
                                {selectedOrder.buyer_contact && <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>📞 {selectedOrder.buyer_contact}</div>}
                                {selectedOrder.delivery_address && <div style={{ fontSize: '0.82rem', color: 'var(--accent-primary)', fontWeight: 600, marginTop: 2 }}>📍 {selectedOrder.delivery_address}</div>}
                                {selectedOrder.created_at && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>{new Date(selectedOrder.created_at).toLocaleString()}</div>}
                            </div>
                            <button onClick={() => setSelectedOrder(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.3rem', lineHeight: 1, padding: 4 }}>✕</button>
                        </div>
                        {/* Items with full images */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
                            {(selectedOrder.items || []).map((item, idx) => {
                                const img = item.product_images?.[0] || null;
                                return (
                                    <div key={item.transaction_id || idx} style={{ display: 'flex', gap: 14, alignItems: 'center', background: 'var(--bg-secondary)', borderRadius: 12, padding: 12 }}>
                                        <div style={{ width: 72, height: 72, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                                            {img
                                                ? <img src={img} alt={item.product_title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                                                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>📦</div>
                                            }
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 4 }}>{item.product_title}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Qty: {item.quantity} × PHP {item.product_price?.toFixed(2)}</div>
                                        </div>
                                        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--accent-secondary)', flexShrink: 0 }}>PHP {item.amount?.toFixed(2)}</div>
                                    </div>
                                );
                            })}
                        </div>
                        {/* Totals */}
                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                                <span>Products Total</span><span>PHP {selectedOrder.total_amount?.toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                                <span>Delivery Fee</span><span>PHP {selectedOrder.delivery_fee?.toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 800, marginTop: 4 }}>
                                <span>Grand Total</span><span style={{ color: 'var(--accent-secondary)' }}>PHP {((selectedOrder.total_amount || 0) + (selectedOrder.delivery_fee || 0)).toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Delivered/Undelivered Modal */}
            {confirmModal && (
                <div
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}
                    onClick={() => setConfirmModal(null)}
                >
                    <div className="card" style={{ maxWidth: 380, width: '90%', padding: 32 }} onClick={e => e.stopPropagation()}>
                        <div style={{ fontSize: '2rem', textAlign: 'center', marginBottom: 12 }}>
                            {confirmModal.status === 'delivered' ? '✅' : '⚠️'}
                        </div>
                        <h3 style={{ textAlign: 'center', fontWeight: 800, marginBottom: 8 }}>
                            {confirmModal.status === 'delivered' ? 'Mark as Delivered?' : 'Mark as Undelivered?'}
                        </h3>
                        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: 24 }}>
                            {confirmModal.status === 'delivered'
                                ? 'Confirm that this delivery box was successfully delivered to the buyer.'
                                : 'Confirm that this delivery box could not be delivered.'}
                        </p>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setConfirmModal(null)}>Cancel</button>
                            <button
                                className="btn"
                                style={{
                                    flex: 1, fontWeight: 700,
                                    background: confirmModal.status === 'delivered' ? 'rgba(0,212,170,0.2)' : 'rgba(239,68,68,0.2)',
                                    color: confirmModal.status === 'delivered' ? '#00d4aa' : '#ef4444',
                                    border: 'none',
                                }}
                                onClick={() => { handleStatus(confirmModal.groupId, confirmModal.status); setConfirmModal(null); }}
                            >
                                {confirmModal.status === 'delivered' ? 'Yes, Delivered' : 'Yes, Undelivered'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Contact Modal */}
            {contactModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
                    onClick={() => setContactModal(false)}>
                    <div className="card" style={{ maxWidth: 400, width: '100%', padding: 32 }} onClick={e => e.stopPropagation()}>
                        <h3>Add Contact Number</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 16 }}>Required before accepting deliveries.</p>
                        <input type="tel" placeholder="e.g. 09171234567" value={contactNum} onChange={e => setContactNum(e.target.value)} style={{ marginBottom: 12, width: '100%' }} />
                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleSaveContact}>Save</button>
                    </div>
                </div>
            )}
        </div>
    );
}
