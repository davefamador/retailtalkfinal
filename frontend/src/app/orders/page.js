'use client';

import { getTransactionHistory, getStoredUser, cancelOrder } from '../../lib/api';
import { useState, useEffect } from 'react';
import { Package, ShoppingCart, Truck } from 'lucide-react';
import Toast from '../components/Toast';

export default function OrdersPage() {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [authChecked, setAuthChecked] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [cancelling, setCancelling] = useState(null);
    const [cancelConfirmGroup, setCancelConfirmGroup] = useState(null);
    const [msg, setMsg] = useState({ type: '', text: '' });

    useEffect(() => {
        const stored = getStoredUser();
        if (!stored) { window.location.href = '/login'; return; }
        setAuthChecked(true);
        loadData();
    }, []);

    const canCancelGroup = (group) => {
        return ['pending', 'approved', 'ondeliver'].includes(group.status);
    };

    const loadData = async () => {
        try {
            const txns = await getTransactionHistory();
            setTransactions(txns);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleCancelGroup = async (group) => {
        setCancelConfirmGroup(null);
        setCancelling(group.group_id);
        setMsg({ type: '', text: '' });
        try {
            const result = await cancelOrder(group.group_id);
            setMsg({ type: 'success', text: result.message || 'Order group cancelled successfully.' });
            await loadData();
        } catch (err) {
            setMsg({ type: 'error', text: err.message || 'Failed to cancel order.' });
        } finally {
            setCancelling(null);
        }
    };

    const user = getStoredUser();
    const myBuyerTxns = transactions.filter(t => t.buyer_id === user?.id);

    // Group transactions by group_id into delivery boxes
    const groupOrders = (txns) => {
        const groups = {};
        for (const t of txns) {
            const gid = t.group_id || t.id;
            if (!groups[gid]) {
                groups[gid] = {
                    group_id: gid,
                    seller_name: t.seller_name || 'Seller',
                    delivery_address: t.delivery_address || '',
                    delivery_user_name: t.delivery_user_name || '',
                    delivery_user_contact: t.delivery_user_contact || '',
                    status: t.status,
                    created_at: t.created_at,
                    items: [],
                    total_amount: 0,
                    delivery_fee: 0,
                };
            }
            groups[gid].items.push(t);
            groups[gid].total_amount += t.amount;
            groups[gid].delivery_fee += t.delivery_fee || 0;
            // Escalate status: ondeliver > approved > pending
            const pri = { pending: 0, approved: 1, ondeliver: 2, delivered: 3, undelivered: 4, cancelled: 5 };
            if ((pri[t.status] ?? 0) > (pri[groups[gid].status] ?? 0)) {
                groups[gid].status = t.status;
            }
            // Update delivery user info if available
            if (t.delivery_user_name && !groups[gid].delivery_user_name) {
                groups[gid].delivery_user_name = t.delivery_user_name;
                groups[gid].delivery_user_contact = t.delivery_user_contact || '';
            }
        }
        return Object.values(groups);
    };

    const allGroups = groupOrders(myBuyerTxns);

    const statusMap = {
        pending: { label: 'Pending', color: '#fbbf24', progress: 10 },
        approved: { label: 'Approved', color: '#8b5cf6', progress: 20 },
        ondeliver: { label: 'On Deliver', color: '#3b82f6', progress: 50 },
        delivered: { label: 'Delivered', color: '#10b981', progress: 100 },
        undelivered: { label: 'Undelivered', color: '#ef4444', progress: 0 },
        cancelled: { label: 'Cancelled', color: '#94a3b8', progress: 0 },
    };

    if (!authChecked || loading) {
        return (
            <div className="page">
                <div className="loading-container">
                    <div className="spinner" style={{ width: 40, height: 40 }}></div>
                    <p>Loading your orders...</p>
                </div>
            </div>
        );
    }

    const renderGroupCard = (group) => {
        const sInfo = statusMap[group.status] || { label: group.status, color: '#94a3b8', progress: 0 };
        const isSingleItem = group.items.length === 1;
        const firstItem = group.items[0];
        const firstImage = firstItem?.product_images?.[0] || null;

        return (
            <div key={group.group_id} onClick={() => setSelectedGroup(group)} style={{
                padding: 16, borderRadius: 14, cursor: 'pointer',
                border: '1px solid var(--border-color)',
                background: 'var(--card-bg)',
                transition: 'border-color 0.2s, transform 0.15s',
            }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ display: 'flex', gap: 10, flex: 1, minWidth: 0 }}>
                        {isSingleItem && firstImage ? (
                            <div style={{ width: 50, height: 50, borderRadius: 10, overflow: 'hidden', background: 'var(--bg-secondary)', flexShrink: 0 }}>
                                <img src={firstImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                            </div>
                        ) : (
                            <div style={{
                                width: 50, height: 50, borderRadius: 10, background: 'var(--bg-secondary)', flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem',
                            }}>
                                {group.items.length > 1 ? '\uD83D\uDCE6' : <Package size={22} style={{ color: 'var(--text-muted)' }} />}
                            </div>
                        )}
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <p style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 2 }}>
                                {isSingleItem ? (firstItem.product_title || 'Product') : `Delivery Box (${group.items.length} items)`}
                            </p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {group.seller_name} {'\u2022'} {new Date(group.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                            </p>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        <span style={{
                            padding: '2px 8px', borderRadius: 10, fontSize: '0.7rem', fontWeight: 600,
                            background: `${sInfo.color}20`, color: sInfo.color,
                        }}>{sInfo.label}</span>
                        <p style={{ fontSize: '0.85rem', fontWeight: 700, marginTop: 0 }}>{'\u20B1'}{group.total_amount.toFixed(2)}</p>
                    </div>
                </div>

                {/* Multi-item: show item thumbnails */}
                {!isSingleItem && (
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '8px 12px', marginBottom: 10 }}>
                        {group.items.map((item, idx) => {
                            const img = item.product_images?.[0] || null;
                            return (
                                <div key={item.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: idx < group.items.length - 1 ? 6 : 0 }}>
                                    {img ? (
                                        <div style={{ width: 32, height: 32, borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
                                            <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                                        </div>
                                    ) : (
                                        <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--bg-card)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Package size={14} style={{ color: 'var(--text-muted)' }} />
                                        </div>
                                    )}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <span style={{ fontWeight: 600, fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{item.product_title}</span>
                                    </div>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>x{item.quantity} {'\u20B1'}{item.amount.toFixed(2)}</span>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Progress bar */}
                <div style={{ height: 3, borderRadius: 2, background: 'var(--border-color)', marginBottom: 6 }}>
                    <div style={{
                        height: '100%', borderRadius: 2, width: `${sInfo.progress}%`,
                        background: sInfo.color, transition: 'width 0.5s',
                    }} />
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        {group.delivery_user_name && (
                            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Truck size={12} /> {group.delivery_user_name}
                            </p>
                        )}
                        {group.delivery_fee > 0 && (
                            <p style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', fontWeight: 600, marginTop: 2 }}>
                                + {'\u20B1'}{group.delivery_fee.toFixed(2)} delivery
                            </p>
                        )}
                    </div>

                    {/* Cancel button */}
                    {canCancelGroup(group) && (
                        <button
                            onClick={e => { e.stopPropagation(); setCancelConfirmGroup(group); }}
                            disabled={cancelling === group.group_id}
                            style={{
                                padding: '8px 14px', borderRadius: 10, border: 'none',
                                background: group.status === 'ondeliver'
                                    ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                                    : 'linear-gradient(135deg, #ef4444, #dc2626)',
                                color: '#fff',
                                fontWeight: 700, fontSize: '0.75rem',
                                cursor: cancelling === group.group_id ? 'not-allowed' : 'pointer',
                                opacity: cancelling === group.group_id ? 0.6 : 1,
                                transition: 'all 0.2s', fontFamily: 'Inter, sans-serif',
                                whiteSpace: 'nowrap',
                                boxShadow: group.status === 'ondeliver'
                                    ? '0 2px 8px rgba(245,158,11,0.3)'
                                    : '0 2px 8px rgba(239,68,68,0.3)',
                            }}
                            onMouseEnter={e => { if (cancelling !== group.group_id) e.currentTarget.style.transform = 'scale(1.05)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                        >
                            {cancelling === group.group_id ? 'Cancelling...'
                                : group.status === 'ondeliver' ? `Cancel Box (${'\u20B1'}50 fee)`
                                : 'Cancel Box'}
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="page">
            <div className="page-header">
                <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Package size={28} /> My Orders</h1>
                <p>Track your delivery orders</p>
            </div>

            {/* ===== TOAST NOTIFICATION ===== */}
            <Toast 
                message={msg.text ? msg : null} 
                onClose={() => setMsg({ type: '', text: '' })} 
            />

            {/* Active Orders */}
            {(() => {
                const activeStatuses = ['pending', 'approved', 'ondeliver'];
                const activeGroups = allGroups.filter(g => activeStatuses.includes(g.status));

                return (
                    <div className="card" style={{ marginBottom: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <ShoppingCart size={18} /> Active Orders
                                <span style={{
                                    fontSize: '0.75rem', fontWeight: 700,
                                    padding: '2px 10px', borderRadius: 12,
                                    background: 'rgba(59,130,246,0.12)', color: '#3b82f6',
                                }}>{activeGroups.length}</span>
                            </h3>
                        </div>
                        {activeGroups.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 40 }}>
                                <Package size={40} style={{ color: 'var(--text-muted)', opacity: 0.3, marginBottom: 12 }} />
                                <p style={{ color: 'var(--text-muted)' }}>No active orders right now</p>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Start shopping to see your orders here!</p>
                            </div>
                        ) : (
                            <div style={{ maxHeight: 600, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 6 }}>
                                {activeGroups.map(g => renderGroupCard(g))}
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* Group Detail Modal */}
            {selectedGroup && (() => {
                const sInfo = statusMap[selectedGroup.status] || { label: selectedGroup.status, color: '#94a3b8' };
                return (
                    <div style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
                    }} onClick={() => setSelectedGroup(null)}>
                        <div className="card" style={{ maxWidth: 500, width: '100%', padding: 32, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                <div>
                                    <h3 style={{ marginBottom: 4 }}>
                                        {selectedGroup.items.length > 1 ? '\uD83D\uDCE6 Delivery Box' : 'Order Details'}
                                    </h3>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                        {new Date(selectedGroup.created_at).toLocaleString()}
                                    </p>
                                </div>
                                <span style={{
                                    padding: '3px 10px', borderRadius: 12, fontSize: '0.8rem', fontWeight: 700,
                                    background: `${sInfo.color}20`, color: sInfo.color,
                                }}>{sInfo.label}</span>
                            </div>

                            {/* Items */}
                            <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
                                {selectedGroup.items.map((item, idx) => {
                                    const img = item.product_images?.[0] || null;
                                    return (
                                        <div key={item.id} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: idx < selectedGroup.items.length - 1 ? 10 : 0 }}>
                                            {img ? (
                                                <div style={{ width: 48, height: 48, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                                                    <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                </div>
                                            ) : (
                                                <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--bg-card)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Package size={18} style={{ color: 'var(--text-muted)' }} />
                                                </div>
                                            )}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.product_title}</p>
                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Qty: {item.quantity || 1}</p>
                                            </div>
                                            <p style={{ fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>{'\u20B1'}{item.amount.toFixed(2)}</p>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Summary */}
                            <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Store</span>
                                    <span style={{ fontWeight: 600 }}>{selectedGroup.seller_name}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Items Total</span>
                                    <span style={{ fontWeight: 700, color: 'var(--accent-secondary)' }}>{'\u20B1'}{selectedGroup.total_amount.toFixed(2)}</span>
                                </div>
                                {selectedGroup.delivery_fee > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>Delivery Fee</span>
                                        <span>{'\u20B1'}{selectedGroup.delivery_fee.toFixed(2)}</span>
                                    </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: 10 }}>
                                    <span style={{ fontWeight: 700 }}>Grand Total</span>
                                    <span style={{ fontWeight: 800, color: 'var(--accent-primary)' }}>{'\u20B1'}{(selectedGroup.total_amount + selectedGroup.delivery_fee).toFixed(2)}</span>
                                </div>
                                {selectedGroup.delivery_address && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>Delivery Address</span>
                                        <span style={{ fontWeight: 600, textAlign: 'right', maxWidth: '60%' }}>{selectedGroup.delivery_address}</span>
                                    </div>
                                )}
                            </div>

                            {/* Delivery Info */}
                            {selectedGroup.delivery_user_name ? (
                                <div style={{
                                    padding: 16, borderRadius: 10, background: 'rgba(59,130,246,0.08)',
                                    border: '1px solid rgba(59,130,246,0.2)', marginBottom: 16,
                                }}>
                                    <h4 style={{ fontWeight: 700, marginBottom: 8, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}><Truck size={16} /> Delivery Man Info</h4>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.85rem' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>Name</span>
                                        <span style={{ fontWeight: 600 }}>{selectedGroup.delivery_user_name}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>Contact</span>
                                        <span style={{ fontWeight: 600 }}>{selectedGroup.delivery_user_contact || 'N/A'}</span>
                                    </div>
                                </div>
                            ) : (
                                <div style={{
                                    padding: 14, borderRadius: 10, background: 'rgba(148,163,184,0.08)',
                                    textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 16,
                                }}>No delivery man assigned yet</div>
                            )}

                            <button className="btn btn-outline" style={{ width: '100%' }} onClick={() => setSelectedGroup(null)}>Close</button>
                        </div>
                    </div>
                );
            })()}

            {/* Cancel Confirmation Modal */}
            {cancelConfirmGroup && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                    zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: 'fadeIn 0.2s ease',
                }} onClick={() => setCancelConfirmGroup(null)}>
                    <div style={{
                        background: 'var(--bg-primary, #1a1a2e)', borderRadius: 20, padding: 32,
                        width: 420, maxWidth: '90vw', border: '1px solid var(--border-color, #333)',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                        animation: 'scaleIn 0.2s ease',
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ textAlign: 'center', marginBottom: 20 }}>
                            <div style={{
                                width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px',
                                background: cancelConfirmGroup.status === 'ondeliver' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.5rem',
                            }}>
                                {cancelConfirmGroup.status === 'ondeliver' ? '\u26A0\uFE0F' : '\u274C'}
                            </div>
                            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 8 }}>
                                Cancel {cancelConfirmGroup.items.length > 1 ? 'Delivery Box' : 'Order'}?
                            </h2>
                            <p style={{ color: 'var(--text-secondary, #aaa)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                                {cancelConfirmGroup.items.length > 1
                                    ? <>Are you sure you want to cancel this delivery box with <strong style={{ color: 'var(--text-primary, #fff)' }}>{cancelConfirmGroup.items.length} items</strong>?</>
                                    : <>Are you sure you want to cancel your order for <strong style={{ color: 'var(--text-primary, #fff)' }}>{cancelConfirmGroup.items[0]?.product_title}</strong>?</>
                                }
                            </p>
                        </div>

                        <div style={{
                            background: 'var(--bg-secondary, #16162a)', borderRadius: 12, padding: 16, marginBottom: 20,
                        }}>
                            {/* Show items in group */}
                            {cancelConfirmGroup.items.length > 1 && (
                                <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--border-color, #333)' }}>
                                    {cancelConfirmGroup.items.map((item, idx) => (
                                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: idx < cancelConfirmGroup.items.length - 1 ? 4 : 0 }}>
                                            <span style={{ color: 'var(--text-muted, #888)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{item.product_title}</span>
                                            <span style={{ fontWeight: 600 }}>{'\u20B1'}{item.amount.toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 8 }}>
                                <span style={{ color: 'var(--text-muted, #888)' }}>Order Amount</span>
                                <span style={{ fontWeight: 600 }}>{'\u20B1'}{cancelConfirmGroup.total_amount.toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 8 }}>
                                <span style={{ color: 'var(--text-muted, #888)' }}>Delivery Fee</span>
                                <span style={{ fontWeight: 600 }}>{'\u20B1'}{(cancelConfirmGroup.delivery_fee || 0).toFixed(2)}</span>
                            </div>
                            {cancelConfirmGroup.status === 'ondeliver' && (
                                <div style={{
                                    display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem',
                                    padding: '8px 0 0', borderTop: '1px solid var(--border-color, #333)',
                                    marginTop: 8,
                                }}>
                                    <span style={{ color: '#f59e0b', fontWeight: 600 }}>Cancellation Fee</span>
                                    <span style={{ color: '#f59e0b', fontWeight: 700 }}>{'\u20B1'}50.00</span>
                                </div>
                            )}
                            <div style={{
                                display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem',
                                padding: '8px 0 0', borderTop: '1px solid var(--border-color, #333)',
                                marginTop: 8,
                            }}>
                                <span style={{ fontWeight: 700, color: '#10b981' }}>Refund Amount</span>
                                <span style={{ fontWeight: 800, color: '#10b981' }}>
                                    {'\u20B1'}{(cancelConfirmGroup.total_amount + (cancelConfirmGroup.delivery_fee || 0) - (cancelConfirmGroup.status === 'ondeliver' ? 50 : 0)).toFixed(2)}
                                </span>
                            </div>
                        </div>

                        {cancelConfirmGroup.status === 'ondeliver' && (
                            <div style={{
                                background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
                                borderRadius: 10, padding: '10px 14px', marginBottom: 20,
                                fontSize: '0.8rem', color: '#f59e0b', lineHeight: 1.5,
                            }}>
                                {'\u26A0\uFE0F'} This order is already being delivered. A <strong>{'\u20B1'}50 cancellation fee</strong> will be deducted from your refund.
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button
                                onClick={() => setCancelConfirmGroup(null)}
                                style={{
                                    flex: 1, padding: '12px 0', borderRadius: 12, border: '1px solid var(--border-color, #333)',
                                    background: 'transparent', color: 'var(--text-primary, #fff)',
                                    fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                                    transition: 'all 0.15s',
                                }}
                            >Go Back</button>
                            <button
                                onClick={() => handleCancelGroup(cancelConfirmGroup)}
                                style={{
                                    flex: 1, padding: '12px 0', borderRadius: 12, border: 'none',
                                    background: cancelConfirmGroup.status === 'ondeliver'
                                        ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                                        : 'linear-gradient(135deg, #ef4444, #dc2626)',
                                    color: '#fff',
                                    fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                                    boxShadow: cancelConfirmGroup.status === 'ondeliver'
                                        ? '0 4px 15px rgba(245,158,11,0.3)'
                                        : '0 4px 15px rgba(239,68,68,0.3)',
                                    transition: 'all 0.15s',
                                }}
                            >Confirm Cancellation</button>
                        </div>
                    </div>
                </div>
            )}
            <style>{`
                @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
                @keyframes scaleIn { from { opacity: 0; transform: scale(0.95) } to { opacity: 1; transform: scale(1) } }
            `}</style>
        </div>
    );
}
