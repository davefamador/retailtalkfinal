'use client';

import { useState, useEffect, useRef } from 'react';
import { createProduct, getMyProducts, updateProduct, getStoredUser, logout, uploadProductImage, createRestockRequest, getMyRestockRequests, getStaffDeliveryOrders, updateDeliveryOrderStatus, getTransactionHistory, getBalance, withdraw, getSellerWishlistReport, getSalaryHistory } from '../../lib/api';
import SearchContent from '../components/SearchContent';
import Toast from '../components/Toast';
import {
    LayoutDashboard, Tag, ShoppingCart, Truck, Package,
    Search, ClipboardList, Heart, LogOut, TrendingUp, DollarSign,
} from 'lucide-react';

// ── Sidebar Item ─────────────────────────────────────────
function SidebarItem({ icon: Icon, label, active, onClick, badge }) {
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
            <span style={{ width: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {typeof Icon === 'string' ? Icon : <Icon size={20} strokeWidth={1.8} />}
            </span>
            <span style={{ flex: 1 }}>{label}</span>
            {badge != null && badge > 0 && (
                <span style={{
                    background: 'rgba(99,102,241,0.2)', color: 'var(--accent-primary)',
                    padding: '2px 8px', borderRadius: 10, fontSize: '0.7rem', fontWeight: 700,
                }}>{badge}</span>
            )}
        </button>
    );
}


export default function SellPage() {
    const [user, setUser] = useState(null);
    const [authChecked, setAuthChecked] = useState(false);
    const [products, setProducts] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [stock, setStock] = useState('1');
    const [imageFiles, setImageFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploadingImages, setUploadingImages] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef(null);
    // Restock state
    const [showRestockModal, setShowRestockModal] = useState(false);
    const [restockProductId, setRestockProductId] = useState('');
    const [restockQuantity, setRestockQuantity] = useState('');
    const [restockNotes, setRestockNotes] = useState('');
    const [restockRequests, setRestockRequests] = useState([]);
    const [restockLoading, setRestockLoading] = useState(false);
    // Delivery orders state
    // Delivery orders state
    const [deliveryOrders, setDeliveryOrders] = useState([]);
    const [deliveryLoading, setDeliveryLoading] = useState(false);
    const [staffDeliveryFilter, setStaffDeliveryFilter] = useState('all');
    const [staffDeliverySearch, setStaffDeliverySearch] = useState('');
    // Active section tab
    const [activeSection, setActiveSection] = useState('dashboard');
    const [initialLoading, setInitialLoading] = useState(true);
    // Dashboard state
    const [sellerBalance, setSellerBalance] = useState(0);
    const [sellerTxns, setSellerTxns] = useState([]);
    const [orderHistoryStatusFilter, setOrderHistoryStatusFilter] = useState('all');
    // Wishlist analytics
    const [wishlistReport, setWishlistReport] = useState(null);
    const [wishlistLoading, setWishlistLoading] = useState(false);
    // Salary state
    const [salaryInfo, setSalaryInfo] = useState(null);
    const [salaryLoading, setSalaryLoading] = useState(false);
    const [withdrawAmt, setWithdrawAmt] = useState('');
    const [withdrawing, setWithdrawing] = useState(false);
    const [salaryMsg, setSalaryMsg] = useState({ type: '', text: '' });

    useEffect(() => {
        const stored = getStoredUser();
        if (!stored) {
            window.location.href = '/login';
            return;
        }
        if (stored.role !== 'staff') {
            window.location.href = '/';
            return;
        }
        setUser(stored);
        setAuthChecked(true);
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        setInitialLoading(true);
        try {
            await Promise.all([loadProducts(), loadRestockRequests(), loadDeliveryOrders(), loadDashboardData(), loadWishlistReport()]);
        } finally {
            setInitialLoading(false);
        }
    };

    const loadWishlistReport = async () => {
        setWishlistLoading(true);
        try {
            const data = await getSellerWishlistReport();
            setWishlistReport(data);
        } catch (e) { console.error(e); }
        finally { setWishlistLoading(false); }
    };
    const loadSalaryInfo = async () => {
        setSalaryLoading(true);
        try { setSalaryInfo(await getSalaryHistory()); } catch (e) { console.error(e); }
        finally { setSalaryLoading(false); }
    };
    const handleSalaryWithdraw = async () => {
        const amt = parseFloat(withdrawAmt);
        if (!amt || amt <= 0) { setSalaryMsg({ type: 'error', text: 'Enter a valid amount' }); return; }
        setWithdrawing(true);
        try {
            const res = await withdraw(amt);
            setSellerBalance(res.balance || 0);
            setWithdrawAmt('');
            setSalaryMsg({ type: 'success', text: `Successfully withdrew PHP ${amt.toFixed(2)}` });
            loadSalaryInfo();
        } catch (e) { setSalaryMsg({ type: 'error', text: e.message }); }
        finally { setWithdrawing(false); }
    };

    const loadDashboardData = async () => {
        try {
            const [txns, bal] = await Promise.all([getTransactionHistory(), getBalance()]);
            setSellerTxns(txns);
            setSellerBalance(parseFloat(bal.balance) || 0);
        } catch (e) { console.error(e); }
    };

    const loadProducts = async () => {
        try {
            const data = await getMyProducts();
            setProducts(data);
        } catch (err) {
            console.error(err);
        }
    };

    const loadRestockRequests = async () => {
        try {
            const data = await getMyRestockRequests();
            setRestockRequests(data);
        } catch (err) { console.error(err); }
    };

    const handleRestockSubmit = async () => {
        if (!restockProductId || !restockQuantity || parseInt(restockQuantity) < 1) {
            setError('Please select a product and enter a valid quantity');
            return;
        }
        setRestockLoading(true);
        try {
            await createRestockRequest({
                product_id: restockProductId,
                requested_quantity: parseInt(restockQuantity),
                notes: restockNotes,
            });
            setSuccess('Restock request submitted!');
            setShowRestockModal(false);
            setRestockProductId('');
            setRestockQuantity('');
            setRestockNotes('');
            loadRestockRequests();
        } catch (err) { setError(err.message); }
        finally { setRestockLoading(false); }
    };

    const loadDeliveryOrders = async () => {
        try {
            const data = await getStaffDeliveryOrders();
            setDeliveryOrders(data);
        } catch (err) { console.error(err); }
    };

    const handleDeliveryStatusUpdate = async (txnId, newStatus) => {
        setDeliveryLoading(true);
        try {
            await updateDeliveryOrderStatus(txnId, newStatus);
            setSuccess(`Order marked as ready for pickup`);
            loadDeliveryOrders();
            loadDashboardData();
        } catch (err) { setError(err.message); }
        finally { setDeliveryLoading(false); }
    };

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setPrice('');
        setStock('1');
        setImageFiles([]);
        setEditingProduct(null);
        setShowForm(false);
    };


    // --- Drag & Drop ---
    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
        if (e.type === 'dragleave') setDragActive(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        addFiles(files);
    };

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
        addFiles(files);
        e.target.value = '';
    };

    const addFiles = (files) => {
        const remaining = 5 - imageFiles.length;
        if (remaining <= 0) {
            setError('Maximum 5 images allowed');
            return;
        }
        const toAdd = files.slice(0, remaining);
        const newItems = toAdd.map(f => ({
            file: f,
            preview: URL.createObjectURL(f),
            url: null,
        }));
        setImageFiles(prev => [...prev, ...newItems]);
    };

    const removeImage = (index) => {
        setImageFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!title.trim()) { setError('Product title is required'); return; }
        if (!description.trim()) { setError('Product description is required'); return; }
        if (!price || parseFloat(price) <= 0) { setError('Price must be greater than 0'); return; }
        if (!stock || parseInt(stock) < 1) { setError('Stock must be at least 1'); return; }
        if (imageFiles.length === 0) { setError('At least one product image is required'); return; }

        setLoading(true);

        try {
            setUploadingImages(true);
            const imageUrls = [];
            for (const img of imageFiles) {
                if (img.url) {
                    imageUrls.push(img.url);
                } else if (img.file) {
                    const result = await uploadProductImage(img.file);
                    imageUrls.push(result.url);
                }
            }
            setUploadingImages(false);

            const productData = {
                title: title.trim(),
                description: description.trim(),
                price: parseFloat(price),
                stock: parseInt(stock),
                images: imageUrls,
            };

            if (editingProduct) {
                await updateProduct(editingProduct.id, productData);
                setSuccess('Product updated successfully!');
            } else {
                await createProduct(productData);
                setSuccess('Product created successfully!');
            }
            resetForm();
            loadProducts();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
            setUploadingImages(false);
        }
    };


    const handleLogout = () => { logout(); window.location.href = '/login'; };

    if (!authChecked) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner" style={{ width: 40, height: 40 }}></div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            {/* ===== SIDEBAR ===== */}
            <aside style={{
                width: 260, background: 'var(--bg-secondary)',
                borderRight: '1px solid var(--border-color)',
                display: 'flex', flexDirection: 'column',
                position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 200,
            }}>
                <div style={{
                    padding: '20px 16px 16px',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex', alignItems: 'center', gap: 10,
                }}>
                    <img src="/logo.png" alt="RetailTalk" style={{ width: 40, height: 40, borderRadius: 10 }} />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>RetailTalk</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Seller</div>
                    </div>
                </div>

                <nav style={{ padding: '16px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <SidebarItem icon={LayoutDashboard} label="Dashboard" active={activeSection === 'dashboard'} onClick={() => setActiveSection('dashboard')} />
                    <SidebarItem icon={Tag} label="Products" active={activeSection === 'products'} onClick={() => setActiveSection('products')} />
                    <SidebarItem icon={Truck} label="Delivery Orders" active={activeSection === 'delivery'} onClick={() => setActiveSection('delivery')} badge={deliveryOrders.filter(g => g.status === 'pending').length} />
                    <SidebarItem icon={Package} label="Restock" active={activeSection === 'restock'} onClick={() => setActiveSection('restock')} badge={restockRequests.length} />

                    <div style={{ height: 1, background: 'var(--border-color)', margin: '8px 0' }} />
                    <SidebarItem icon={ClipboardList} label="Order History" active={activeSection === 'orderhistory'} onClick={() => { setActiveSection('orderhistory'); loadDashboardData(); }} />
                    <SidebarItem icon={Heart} label="Wishlist Analytics" active={activeSection === 'wishlist'} onClick={() => { setActiveSection('wishlist'); loadWishlistReport(); }} />
                    <SidebarItem icon={DollarSign} label="Salary" active={activeSection === 'salary'} onClick={() => { setActiveSection('salary'); loadSalaryInfo(); loadDashboardData(); }} />
                </nav>

                <div style={{
                    padding: '16px 20px', borderTop: '1px solid var(--border-color)',
                    display: 'flex', alignItems: 'center', gap: 12,
                }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: 'rgba(16,185,129,0.15)', color: '#10b981',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: '0.85rem',
                    }}>
                        {user?.full_name?.charAt(0)?.toUpperCase() || 'S'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {user?.full_name}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Staff</div>
                    </div>
                    <button onClick={handleLogout} title="Logout" style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
                    }}><LogOut size={18} /></button>
                </div>
            </aside>

            {/* ===== MAIN CONTENT ===== */}
            <main style={{ marginLeft: 260, flex: 1, padding: '32px 40px', maxWidth: 1200 }}>
                {/* ===== TOAST NOTIFICATION ===== */}
                <Toast 
                    message={
                        error ? { type: 'error', text: error } :
                        success ? { type: 'success', text: success } :
                        salaryMsg.text ? salaryMsg : null
                    } 
                    onClose={() => {
                        setError('');
                        setSuccess('');
                        setSalaryMsg({ type: '', text: '' });
                    }} 
                />

                {/* Loading state for initial data */}
                {initialLoading && (activeSection === 'dashboard' || activeSection === 'products' || activeSection === 'delivery' || activeSection === 'restock') && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 16 }}>
                        <div className="spinner" style={{ width: 40, height: 40 }}></div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading data...</p>
                    </div>
                )}

                {/* ===== DASHBOARD ===== */}
                {activeSection === 'dashboard' && !initialLoading && (() => {
                    const mySoldTxns = sellerTxns.filter(t => t.buyer_id !== user?.id);
                    const totalRevenue = mySoldTxns.reduce((sum, t) => sum + (t.seller_amount || 0), 0);
                    const completedTxns = mySoldTxns.filter(t => ['delivered', 'completed'].includes(t.status));
                    const totalSales = completedTxns.reduce((sum, t) => sum + t.amount, 0);
                    const activeProducts = products.filter(p => p.is_active);
                    const lowStock = products.filter(p => p.is_active && (p.stock || 0) <= 5);

                    return (
                        <div>
                            <div style={{ marginBottom: 24 }}>
                                <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Dashboard</h1>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Overview of your store activity</p>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
                                <div className="card" style={{ padding: 20, textAlign: 'center' }}>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Wallet Balance</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-primary)' }}>PHP {sellerBalance.toFixed(2)}</div>
                                </div>
                                <div className="card" style={{ padding: 20, textAlign: 'center' }}>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Total Revenue</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>PHP {totalRevenue.toFixed(2)}</div>
                                </div>
                                <div className="card" style={{ padding: 20, textAlign: 'center' }}>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Total Sales</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}>PHP {totalSales.toFixed(2)}</div>
                                </div>
                                <div className="card" style={{ padding: 20, textAlign: 'center' }}>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Total Transactions</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{mySoldTxns.length}</div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
                                <div className="card" style={{ padding: 20, textAlign: 'center' }}>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Active Products</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#3b82f6' }}>{activeProducts.length}</div>
                                </div>
                                <div className="card" style={{ padding: 20, textAlign: 'center' }}>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Low Stock</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: lowStock.length > 0 ? '#ef4444' : '#10b981' }}>{lowStock.length}</div>
                                </div>

                                <div className="card" style={{ padding: 20, textAlign: 'center' }}>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Pending Delivery</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fbbf24' }}>{deliveryOrders.filter(g => g.status === 'pending').length}</div>
                                </div>
                            </div>

                            {/* Low stock alerts */}
                            {lowStock.length > 0 && (
                                <div className="card" style={{ padding: 20 }}>
                                    <h3 style={{ fontWeight: 700, marginBottom: 12, color: '#ef4444' }}>Low Stock Products</h3>
                                    <div style={{ display: 'grid', gap: 8 }}>
                                        {lowStock.map(p => (
                                            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.05)' }}>
                                                <span style={{ fontWeight: 600 }}>{p.title}</span>
                                                <span style={{ color: '#ef4444', fontWeight: 700 }}>{p.stock || 0} left</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}

                {/* ===== WISHLIST ANALYTICS TAB ===== */}
                {activeSection === 'wishlist' && (
                    <div>
                        <div style={{ marginBottom: 24 }}>
                            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}><Heart size={24} /> Wishlist Analytics</h1>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Store-wide wishlist insights — shared across all staff in your department</p>
                        </div>

                        {wishlistLoading ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', flexDirection: 'column', gap: 16 }}>
                                <div className="spinner" style={{ width: 36, height: 36 }} />
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading wishlist data...</p>
                            </div>
                        ) : (
                            <>
                                {/* Summary Cards */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
                                    <div className="card" style={{ padding: 20, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                                        <div style={{ position: 'absolute', top: -4, right: -4, opacity: 0.07 }}><Heart size={56} /></div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Wishlists</div>
                                        <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ef4444' }}>{wishlistReport?.total_wishlists ?? 0}</div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>times your products were saved</div>
                                    </div>
                                    <div className="card" style={{ padding: 20, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                                        <div style={{ position: 'absolute', top: -4, right: -4, opacity: 0.07 }}><Package size={56} /></div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Products Tracked</div>
                                        <div style={{ fontSize: '2rem', fontWeight: 800, color: '#6366f1' }}>{wishlistReport?.total_products ?? 0}</div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>products in your store</div>
                                    </div>
                                    <div className="card" style={{ padding: 20, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                                        <div style={{ position: 'absolute', top: -4, right: -4, opacity: 0.07 }}><TrendingUp size={56} /></div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Avg / Product</div>
                                        <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f59e0b' }}>{wishlistReport?.wishlist_per_product?.toFixed(2) ?? '0.00'}</div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>average wishlists per product</div>
                                    </div>
                                </div>

                                {/* Per-Product Breakdown */}
                                <div className="card">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                        <h3 style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}><Heart size={18} /> Wishlist by Product</h3>
                                        <button
                                            onClick={loadWishlistReport}
                                            style={{
                                                padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border-color)',
                                                background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
                                                cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                                                fontFamily: 'Inter, sans-serif',
                                            }}
                                        >↻ Refresh</button>
                                    </div>

                                    {(!wishlistReport?.products || wishlistReport.products.length === 0) ? (
                                        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                                            <div style={{ marginBottom: 12, color: 'var(--text-muted)' }}><Heart size={40} /></div>
                                            <p style={{ fontWeight: 600, marginBottom: 6 }}>No wishlist data yet</p>
                                            <p style={{ fontSize: '0.85rem' }}>When buyers save your products, they'll appear here</p>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                            {wishlistReport.products.map((prod, i) => {
                                                const maxCount = wishlistReport.products[0]?.wishlist_count || 1;
                                                const barWidth = maxCount > 0 ? (prod.wishlist_count / maxCount) * 100 : 0;
                                                const rankColors = ['#ef4444', '#f59e0b', '#6366f1'];
                                                const rankColor = rankColors[i] || 'var(--border-color)';
                                                return (
                                                    <div key={prod.product_id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                        {/* Rank */}
                                                        <span style={{
                                                            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            fontSize: '0.78rem', fontWeight: 700,
                                                            background: i < 3 ? rankColor : 'var(--border-color)',
                                                            color: i < 3 ? '#fff' : 'var(--text-muted)',
                                                        }}>{i + 1}</span>

                                                        {/* Image */}
                                                        {prod.image_url && (
                                                            <div style={{
                                                                width: 40, height: 40, borderRadius: 8, overflow: 'hidden',
                                                                border: '1px solid var(--border-color)', flexShrink: 0,
                                                            }}>
                                                                <img src={prod.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                                                            </div>
                                                        )}

                                                        {/* Name + Bar */}
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <p style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {prod.title || 'Untitled'}
                                                            </p>
                                                            <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                                                                <div style={{
                                                                    height: '100%', borderRadius: 3,
                                                                    width: `${barWidth}%`,
                                                                    background: 'linear-gradient(90deg, #ef4444, #f59e0b)',
                                                                    transition: 'width 0.6s ease',
                                                                }} />
                                                            </div>
                                                        </div>

                                                        {/* Count badge */}
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                                                            <div style={{
                                                                display: 'flex', alignItems: 'center', gap: 4,
                                                                padding: '4px 10px', borderRadius: 20,
                                                                background: 'rgba(239,68,68,0.1)',
                                                                color: '#ef4444', fontWeight: 700, fontSize: '0.85rem',
                                                            }}>
                                                                <Heart size={14} />
                                                                <span>{prod.wishlist_count}</span>
                                                            </div>
                                                            {(() => {
                                                                const s = prod.stock ?? 0;
                                                                const isOut = s === 0;
                                                                const isLow = s > 0 && s <= 5;
                                                                return (
                                                                    <div style={{
                                                                        display: 'flex', alignItems: 'center', gap: 4,
                                                                        padding: '3px 8px', borderRadius: 20,
                                                                        background: isOut ? 'rgba(239,68,68,0.1)' : isLow ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
                                                                        color: isOut ? '#ef4444' : isLow ? '#f59e0b' : '#10b981',
                                                                        fontWeight: 600, fontSize: '0.75rem',
                                                                    }}>
                                                                        <Package size={12} />
                                                                        <span>{s} {isOut ? 'out' : isLow ? 'low' : 'in stock'}</span>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}



                {/* ===== ORDER HISTORY TAB ===== */}
                {activeSection === 'orderhistory' && (() => {
                    const storeOrders = sellerTxns.filter(t => t.buyer_id !== user?.id);
                    const [ohStatusFilter, setOhStatusFilter] = [orderHistoryStatusFilter, setOrderHistoryStatusFilter];
                    const filteredOrders = storeOrders.filter(t => {
                        if (ohStatusFilter !== 'all' && t.status !== ohStatusFilter) return false;
                        return true;
                    });
                    const statusClr = {
                        pending: '#f59e0b', approved: '#10b981', ondeliver: '#3b82f6',
                        delivered: '#10b981', completed: '#10b981',
                        undelivered: '#ef4444', cancelled: '#94a3b8',
                    };
                    const allStatuses = [...new Set(storeOrders.map(t => t.status))].sort();
                    return (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                                <div>
                                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Order History</h1>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Store-wide purchase history — shared across all staff</p>
                                </div>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <select
                                        value={ohStatusFilter} onChange={e => setOhStatusFilter(e.target.value)}
                                        style={{
                                            padding: '10px 14px', borderRadius: 10,
                                            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                                            color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem',
                                        }}
                                    >
                                        <option value="all">All Statuses</option>
                                        {allStatuses.map(s => (
                                            <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                                        ))}
                                    </select>
                                    <div style={{
                                        background: 'var(--card-bg)', padding: '8px 16px', borderRadius: 10,
                                        border: '1px solid var(--border-color)', fontSize: '0.85rem', color: 'var(--text-secondary)',
                                    }}>
                                        {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
                                    </div>
                                </div>
                            </div>

                            {filteredOrders.length === 0 ? (
                                <div className="card" style={{ padding: 60, textAlign: 'center' }}>
                                    <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📋</div>
                                    <h3 style={{ fontWeight: 700, marginBottom: 6 }}>No orders yet</h3>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Purchases made in your store will appear here</p>
                                </div>
                            ) : (
                                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Buyer</th><th>Staff</th><th>Product</th><th>Qty</th><th>Amount</th><th>Status</th><th>Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredOrders.map(t => (
                                                <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                    <td style={{ fontWeight: 500 }}>{t.buyer_name || '—'}</td>
                                                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t.seller_name || '—'}</td>
                                                    <td style={{ color: 'var(--text-secondary)' }}>{t.product_title || '—'}</td>
                                                    <td>{t.quantity || 1}</td>
                                                    <td style={{ fontWeight: 600 }}>₱{parseFloat(t.amount || 0).toFixed(2)}</td>
                                                    <td>
                                                        <span style={{
                                                            padding: '3px 8px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600,
                                                            background: `${statusClr[t.status] || '#94a3b8'}15`,
                                                            color: statusClr[t.status] || '#94a3b8',
                                                        }}>{(t.status || '').replace(/_/g, ' ')}</span>
                                                    </td>
                                                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                                        {t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    );
                })()}

                {/* ===== PRODUCTS TAB ===== */}
                {activeSection === 'products' && !initialLoading && (<>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                        <div>
                            <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>My Products</h1>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Manage your product listings</p>
                        </div>
                        {!user.department_id && (
                            <button className="btn btn-primary" onClick={() => { if (showForm) resetForm(); else setShowForm(true); }}>
                                {showForm ? 'Cancel' : '+ New Product'}
                            </button>
                        )}
                    </div>

                    {/* Create / Edit Product Form */}
                    {showForm && !user.department_id && (
                        <div className="card" style={{ marginBottom: 24 }}>
                            <h3 style={{ marginBottom: 16 }}>
                                {editingProduct ? 'Edit Product' : 'Create New Product'}
                            </h3>
                            <form onSubmit={handleSubmit}>
                                <div className="form-group">
                                    <label>Product Title *</label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="e.g. Wireless Bluetooth Headphones"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Description *</label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Describe your product in detail..."
                                        rows={3}
                                        required
                                    />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div className="form-group">
                                        <label>Price (PHP) *</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            value={price}
                                            onChange={(e) => setPrice(e.target.value)}
                                            placeholder="299.00"
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Stock Quantity *</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={stock}
                                            onChange={(e) => setStock(e.target.value)}
                                            placeholder="10"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Image Upload — Drag & Drop */}
                                <div className="form-group">
                                    <label>Product Images * (max 5)</label>
                                    <div
                                        className={`dropzone ${dragActive ? 'active' : ''}`}
                                        onDragEnter={handleDrag}
                                        onDragOver={handleDrag}
                                        onDragLeave={handleDrag}
                                        onDrop={handleDrop}
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp,image/gif"
                                            multiple
                                            onChange={handleFileSelect}
                                            style={{ display: 'none' }}
                                        />
                                        <div style={{ fontSize: '2rem', marginBottom: 8 }}>📁</div>
                                        <p style={{ fontWeight: 500, marginBottom: 4 }}>
                                            Drag & drop images here or click to browse
                                        </p>
                                        <p style={{ fontSize: '0.8rem' }}>
                                            JPEG, PNG, WebP, GIF — Max 5MB each — {imageFiles.length}/5 uploaded
                                        </p>
                                    </div>

                                    {imageFiles.length > 0 && (
                                        <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                                            {imageFiles.map((img, i) => (
                                                <div key={i} style={{ position: 'relative' }}>
                                                    <img
                                                        src={img.preview}
                                                        alt={`Preview ${i + 1}`}
                                                        style={{
                                                            width: 80, height: 80, objectFit: 'cover',
                                                            borderRadius: 8, border: '2px solid var(--border-color)',
                                                        }}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => removeImage(i)}
                                                        style={{
                                                            position: 'absolute', top: -6, right: -6,
                                                            width: 22, height: 22, borderRadius: '50%',
                                                            background: 'var(--accent-danger)', color: 'white',
                                                            border: 'none', cursor: 'pointer', fontSize: '0.7rem',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        }}
                                                    >✕</button>
                                                    {i === 0 && (
                                                        <div style={{
                                                            position: 'absolute', bottom: 2, left: 2, right: 2,
                                                            background: 'rgba(0,0,0,0.7)', color: 'white',
                                                            fontSize: '0.6rem', textAlign: 'center',
                                                            borderRadius: '0 0 6px 6px', padding: '2px 0',
                                                        }}>Main</div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <button type="submit" className="btn btn-success" disabled={loading} style={{ marginTop: 8 }}>
                                    {loading ? (
                                        <><span className="spinner"></span> {uploadingImages ? 'Uploading images...' : 'Saving...'}</>
                                    ) : (
                                        editingProduct ? 'Update Product' : 'Create Product'
                                    )}
                                </button>
                            </form>
                        </div>
                    )}

                    {/* Products List */}
                    {user.department_id && (
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                            Click a product to request a restock from your manager.
                        </p>
                    )}
                    {products.length === 0 ? (
                        <div className="empty-state">
                            <h3>No products yet</h3>
                            <p>Click "+ New Product" to create your first listing</p>
                        </div>
                    ) : (
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Image</th>
                                        <th>Title</th>
                                        <th>Price</th>
                                        <th>Stock</th>
                                        {user.department_id && <th>Action</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {products.map((p) => (
                                        <tr key={p.id}
                                            style={{ cursor: user.department_id ? 'pointer' : 'default', transition: 'background 0.15s' }}
                                            onClick={() => {
                                                if (!user.department_id) return;
                                                setRestockProductId(p.id);
                                                setRestockQuantity('');
                                                setRestockNotes('');
                                                setShowRestockModal(true);
                                            }}
                                            onMouseEnter={e => { if (user.department_id) e.currentTarget.style.background = 'rgba(99,102,241,0.06)'; }}
                                            onMouseLeave={e => { if (user.department_id) e.currentTarget.style.background = 'transparent'; }}
                                        >
                                            <td>
                                                {p.images && p.images.length > 0 ? (
                                                    <img
                                                        src={p.images[0]}
                                                        alt={p.title}
                                                        style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }}
                                                        onError={(e) => {
                                                            e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect fill="%23333" width="48" height="48"/><text fill="%23888" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="10">No img</text></svg>';
                                                        }}
                                                    />
                                                ) : (
                                                    <div style={{
                                                        width: 48, height: 48, background: 'var(--glass-bg)', borderRadius: 6,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: '0.7rem', color: 'var(--text-muted)',
                                                    }}>No img</div>
                                                )}
                                            </td>
                                            <td style={{ fontWeight: 500 }}>{p.title}</td>
                                            <td style={{ color: 'var(--accent-secondary)' }}>PHP {parseFloat(p.price).toFixed(2)}</td>
                                            <td>
                                                {(() => {
                                                    const s = p.stock || 0;
                                                    const isOut = s === 0;
                                                    const isLow = s > 0 && s <= 5;
                                                    return (
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                                                            <span style={{ fontWeight: 700, fontSize: '1rem', color: isOut ? '#ef4444' : isLow ? '#f59e0b' : '#10b981' }}>
                                                                {s}
                                                            </span>
                                                            <span style={{
                                                                fontSize: '0.65rem', fontWeight: 600, padding: '1px 6px', borderRadius: 4,
                                                                background: isOut ? 'rgba(239,68,68,0.12)' : isLow ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)',
                                                                color: isOut ? '#ef4444' : isLow ? '#f59e0b' : '#10b981',
                                                            }}>
                                                                {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                                                            </span>
                                                        </div>
                                                    );
                                                })()}
                                            </td>
                                            {user.department_id && (
                                                <td>
                                                    <span style={{
                                                        fontSize: '0.75rem', fontWeight: 600, padding: '4px 10px', borderRadius: 6,
                                                        background: 'rgba(99,102,241,0.1)', color: '#6366f1', whiteSpace: 'nowrap',
                                                    }}>
                                                        Request Restock
                                                    </span>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>)}

                {/* ===== DELIVERY ORDERS TAB ===== */}
                {activeSection === 'delivery' && !initialLoading && (() => {
                    const deliveryColors = {
                        pending: { bg: 'rgba(251,191,36,0.1)', color: '#fbbf24', label: 'Pending' },
                        approved: { bg: 'rgba(16,185,129,0.1)', color: '#10b981', label: 'Ready for Pickup' },
                        ondeliver: { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6', label: 'On Delivery' },
                        delivered: { bg: 'rgba(16,185,129,0.1)', color: '#10b981', label: 'Delivered' },
                        undelivered: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', label: 'Undelivered' },
                        cancelled: { bg: 'rgba(148,163,184,0.1)', color: '#94a3b8', label: 'Cancelled' },
                    };
                    let filtered = deliveryOrders;
                    if (staffDeliveryFilter !== 'all') filtered = filtered.filter(g => g.status === staffDeliveryFilter);
                    if (staffDeliverySearch.trim()) {
                        const q = staffDeliverySearch.toLowerCase();
                        filtered = filtered.filter(g =>
                            (g.buyer_name || '').toLowerCase().includes(q) ||
                            (g.items || []).some(item => (item.product_title || '').toLowerCase().includes(q))
                        );
                    }
                    const approvedOrders = deliveryOrders.filter(g => g.status === 'approved');
                    const pendingOrders = deliveryOrders.filter(g => g.status === 'pending');
                    const renderOrderRow = (group, accentColor, borderColor) => {
                        const firstImg = group.items?.[0]?.product_images?.[0] || null;
                        const extraImgs = (group.items || []).slice(1).map(i => i.product_images?.[0]).filter(Boolean);
                        return (
                            <div key={group.group_id} style={{
                                background: 'var(--bg-card)', borderRadius: 10, padding: 12,
                                border: `1px solid ${borderColor}`,
                                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                            }}>
                                {/* Product images strip */}
                                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                    {firstImg ? (
                                        <div style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-color)', flexShrink: 0 }}>
                                            <img src={firstImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                                        </div>
                                    ) : (
                                        <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--bg-secondary)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>📦</div>
                                    )}
                                    {extraImgs.slice(0, 2).map((img, i) => (
                                        <div key={i} style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-color)', flexShrink: 0 }}>
                                            <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                                        </div>
                                    ))}
                                    {extraImgs.length > 2 && (
                                        <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--bg-secondary)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                                            +{extraImgs.length - 2}
                                        </div>
                                    )}
                                </div>
                                {/* Info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>📦 Box — {group.buyer_name}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        {group.items?.length || 0} item{group.items?.length !== 1 ? 's' : ''} · PHP {group.total_amount?.toFixed(2)}
                                    </div>
                                    {group.delivery_address && (
                                        <div style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', marginTop: 2 }}>📍 {group.delivery_address}</div>
                                    )}
                                </div>
                                <span style={{
                                    padding: '3px 10px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 600,
                                    background: `${accentColor}22`, color: accentColor, flexShrink: 0,
                                }}>{group.status === 'approved' ? 'Ready for Pickup' : 'Pending'}</span>
                                {group.status === 'pending' && (
                                    <button
                                        className="btn btn-primary btn-sm"
                                        disabled={deliveryLoading}
                                        onClick={() => handleDeliveryStatusUpdate(group.group_id, 'approved')}
                                        style={{ fontWeight: 600, fontSize: '0.75rem', padding: '5px 12px', flexShrink: 0 }}
                                    >
                                        ✓ Approve
                                    </button>
                                )}
                            </div>
                        );
                    };
                    return (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <div>
                                <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Delivery Orders</h1>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Manage delivery boxes — approve entire groups for pickup</p>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input
                                    type="text" placeholder="Search orders..."
                                    value={staffDeliverySearch} onChange={e => setStaffDeliverySearch(e.target.value)}
                                    style={{
                                        width: 180, padding: '8px 12px', borderRadius: 8,
                                        background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                                        color: 'var(--text-primary)', fontSize: '0.82rem',
                                    }}
                                />
                                <button className="btn btn-outline btn-sm" onClick={loadDeliveryOrders}>Refresh</button>
                            </div>
                        </div>
                        {/* ===== APPROVED ORDERS BOX ===== */}
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(5,150,105,0.06) 100%)',
                            border: '1px solid rgba(16,185,129,0.3)', borderRadius: 14, padding: 20, marginBottom: 16,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: approvedOrders.length > 0 ? 14 : 0 }}>
                                <span style={{ fontSize: '1.1rem' }}>✅</span>
                                <div>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#10b981' }}>
                                        Approved Orders — Ready for Pickup
                                    </h3>
                                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                                        {approvedOrders.length > 0 ? `${approvedOrders.length} box${approvedOrders.length > 1 ? 'es' : ''} waiting for a delivery rider` : 'No approved orders waiting for pickup'}
                                    </p>
                                </div>
                            </div>
                            {approvedOrders.length > 0 && (
                                <div style={{ display: 'grid', gap: 8, maxHeight: approvedOrders.length > 5 ? 340 : 'none', overflowY: approvedOrders.length > 5 ? 'auto' : 'visible', paddingRight: approvedOrders.length > 5 ? 4 : 0 }}>
                                    {approvedOrders.map(g => renderOrderRow(g, '#10b981', 'rgba(16,185,129,0.2)'))}
                                </div>
                            )}
                        </div>
                        {/* ===== PENDING ORDERS BOX ===== */}
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(251,191,36,0.08) 0%, rgba(245,158,11,0.06) 100%)',
                            border: '1px solid rgba(251,191,36,0.35)', borderRadius: 14, padding: 20, marginBottom: 24,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: pendingOrders.length > 0 ? 14 : 0 }}>
                                <span style={{ fontSize: '1.1rem' }}>🕐</span>
                                <div>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#fbbf24' }}>
                                        Pending Orders — Awaiting Approval
                                    </h3>
                                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                                        {pendingOrders.length > 0 ? `${pendingOrders.length} box${pendingOrders.length > 1 ? 'es' : ''} need your approval` : 'No pending orders'}
                                    </p>
                                </div>
                            </div>
                            {pendingOrders.length > 0 && (
                                <div style={{ display: 'grid', gap: 8, maxHeight: pendingOrders.length > 5 ? 340 : 'none', overflowY: pendingOrders.length > 5 ? 'auto' : 'visible', paddingRight: pendingOrders.length > 5 ? 4 : 0 }}>
                                    {pendingOrders.map(g => renderOrderRow(g, '#fbbf24', 'rgba(251,191,36,0.2)'))}
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                            {[{ key: 'all', label: 'All' }, ...Object.entries(deliveryColors).map(([k, v]) => ({ key: k, label: v.label }))].map(f => (
                                <button key={f.key} onClick={() => setStaffDeliveryFilter(f.key)} style={{
                                    padding: '5px 14px', borderRadius: 8, border: '1px solid',
                                    borderColor: staffDeliveryFilter === f.key ? 'var(--accent-primary)' : 'var(--border-color)',
                                    background: staffDeliveryFilter === f.key ? 'rgba(99,102,241,0.15)' : 'transparent',
                                    color: staffDeliveryFilter === f.key ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                    fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                                    fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
                                }}>{f.label}</button>
                            ))}
                        </div>
                        {filtered.length === 0 ? (
                            <div className="empty-state"><h3>No delivery orders</h3><p>Delivery orders from buyers will appear here</p></div>
                        ) : (
                            <div style={{ display: 'grid', gap: 16 }}>
                                {filtered.map(group => {
                                    const sc = deliveryColors[group.status] || { bg: 'var(--bg-secondary)', color: 'var(--text-muted)', label: group.status };
                                    return (
                                        <div key={group.group_id} className="card" style={{ padding: 20, border: group.status === 'pending' ? '1px solid rgba(251,191,36,0.3)' : undefined }}>
                                            {/* Group header */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>📦 Delivery Box</div>
                                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                        Buyer: <strong>{group.buyer_name}</strong>
                                                    </div>
                                                    {group.delivery_address && (
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', marginTop: 3, fontWeight: 600 }}>
                                                            📍 {group.delivery_address}
                                                        </div>
                                                    )}
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 3 }}>
                                                        {new Date(group.created_at).toLocaleString()}
                                                    </div>
                                                </div>
                                                <span style={{
                                                    padding: '4px 14px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
                                                    background: sc.bg, color: sc.color, flexShrink: 0,
                                                }}>{sc.label}</span>
                                            </div>
                                            {/* Items list */}
                                            <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
                                                {(group.items || []).map((item, idx) => {
                                                    const img = item.product_images && item.product_images.length > 0 ? item.product_images[0] : null;
                                                    return (
                                                        <div key={item.id || idx} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: idx < group.items.length - 1 ? 8 : 0 }}>
                                                            {img ? (
                                                                <div style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                                                                    <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                                                                </div>
                                                            ) : (
                                                                <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--bg-card)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: 'var(--text-muted)' }}>No img</div>
                                                            )}
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.product_title}</div>
                                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Qty: {item.quantity} × PHP {item.product_price?.toFixed(2)}</div>
                                                            </div>
                                                            <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>PHP {item.amount?.toFixed(2)}</div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {/* Footer */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                    Total: <strong>PHP {group.total_amount?.toFixed(2)}</strong>
                                                    <span style={{ marginLeft: 10, color: 'var(--accent-primary)', fontWeight: 600 }}>
                                                        + PHP {group.delivery_fee?.toFixed(2)} delivery fee
                                                    </span>
                                                </div>
                                                {group.status === 'pending' && (
                                                    <button
                                                        className="btn btn-primary btn-sm"
                                                        disabled={deliveryLoading}
                                                        onClick={() => handleDeliveryStatusUpdate(group.group_id, 'approved')}
                                                        style={{ fontWeight: 600 }}
                                                    >
                                                        ✓ Approve Box
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    );
                })()}

                {/* ===== RESTOCK TAB ===== */}
                {activeSection === 'restock' && !initialLoading && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <div>
                                <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>My Restock Requests</h1>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Request restock for products running low</p>
                            </div>
                            <button className="btn btn-primary btn-sm" onClick={() => setShowRestockModal(true)}>
                                + Request Restock
                            </button>
                        </div>
                        {restockRequests.length === 0 ? (
                            <div className="empty-state"><h3>No restock requests</h3><p>Request restock for your products that are running low</p></div>
                        ) : (
                            <div style={{ display: 'grid', gap: 12 }}>
                                {restockRequests.map(req => {
                                    const statusMap = {
                                        pending_manager: { bg: 'rgba(251,191,36,0.1)', color: '#fbbf24', label: 'Pending Manager' },
                                        approved_manager: { bg: 'rgba(16,185,129,0.1)', color: '#10b981', label: 'Approved' },
                                        rejected_manager: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', label: 'Rejected' },
                                        accepted_delivery: { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6', label: 'Accepted by Delivery' },
                                        in_transit: { bg: 'rgba(108,99,255,0.1)', color: '#6366f1', label: 'In Transit' },
                                        delivered: { bg: 'rgba(16,185,129,0.1)', color: '#10b981', label: 'Delivered' },
                                    };
                                    const sc = statusMap[req.status] || { bg: 'var(--bg-secondary)', color: 'var(--text-muted)', label: req.status };
                                    const productImage = req.product_images && req.product_images.length > 0 ? req.product_images[0] : null;
                                    return (
                                        <div key={req.id} className="card" style={{ padding: 20 }}>
                                            <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                                                {productImage && (
                                                    <div style={{
                                                        width: 64, height: 64, borderRadius: 10, overflow: 'hidden',
                                                        background: 'var(--bg-secondary)', flexShrink: 0,
                                                    }}>
                                                        <img src={productImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                            onError={e => e.target.style.display = 'none'} />
                                                    </div>
                                                )}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                        <h4 style={{ fontWeight: 700, marginBottom: 4 }}>{req.product_title}</h4>
                                                        <span style={{
                                                            padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
                                                            background: sc.bg, color: sc.color, flexShrink: 0,
                                                        }}>{sc.label}</span>
                                                    </div>
                                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                        Requested: {req.requested_quantity} units
                                                        {req.approved_quantity != null && ` | Approved: ${req.approved_quantity}`}
                                                    </p>
                                                    {req.notes && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>Note: {req.notes}</p>}
                                                    {req.manager_notes && <p style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', marginTop: 4 }}>Manager: {req.manager_notes}</p>}
                                                </div>
                                            </div>
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                {new Date(req.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ===== SALARY TAB ===== */}
                {activeSection === 'salary' && (
                    <div style={{ padding: '32px 24px', maxWidth: 800 }}>
                        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 24 }}>My Salary</h2>
                        {salaryLoading ? (
                            <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ width: 32, height: 32, margin: '0 auto' }}></div></div>
                        ) : salaryInfo ? (
                            <>
                                {salaryMsg.text && (
                                    <div className={`alert alert-${salaryMsg.type}`} style={{ marginBottom: 16 }}>{salaryMsg.text}</div>
                                )}
                                {/* Summary Cards */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
                                    <div className="card" style={{ padding: 20 }}>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Fixed Salary</p>
                                        <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-primary)' }}>PHP {salaryInfo.fixed_salary.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                    <div className="card" style={{ padding: 20 }}>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Paid This Month</p>
                                        <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}>PHP {salaryInfo.paid_this_month.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                    <div className="card" style={{ padding: 20 }}>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Remaining</p>
                                        <p style={{ fontSize: '1.5rem', fontWeight: 800, color: salaryInfo.remaining_this_month > 0 ? '#ef4444' : '#10b981' }}>PHP {salaryInfo.remaining_this_month.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                    <div className="card" style={{ padding: 20 }}>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Your Balance</p>
                                        <p style={{ fontSize: '1.5rem', fontWeight: 800 }}>PHP {sellerBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                </div>
                                {/* Withdraw Section */}
                                <div className="card" style={{ padding: 20, marginBottom: 28 }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <DollarSign size={18} /> Withdraw Salary
                                    </h3>
                                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                        <input type="number" min="0" placeholder="Amount to withdraw"
                                            value={withdrawAmt} onChange={e => setWithdrawAmt(e.target.value)}
                                            style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.9rem', fontFamily: 'Inter, sans-serif' }}
                                        />
                                        <button onClick={handleSalaryWithdraw} disabled={withdrawing || !withdrawAmt}
                                            className="btn btn-primary" style={{ padding: '10px 24px', borderRadius: 10, fontSize: '0.88rem' }}>
                                            {withdrawing ? 'Processing...' : 'Withdraw'}
                                        </button>
                                    </div>
                                </div>
                                {/* Transaction History */}
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Transaction History</h3>
                                {salaryInfo.history.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No transactions yet</div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {salaryInfo.history.map(p => {
                                            const isDeposit = p.type === 'salary_deposit';
                                            return (
                                                <div key={p.id} className="card" style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                        <div style={{
                                                            width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            background: isDeposit ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)',
                                                        }}>
                                                            <span style={{ fontSize: '1rem' }}>{isDeposit ? '↓' : '↑'}</span>
                                                        </div>
                                                        <div>
                                                            <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 2, color: isDeposit ? '#10b981' : '#ef4444' }}>
                                                                {isDeposit ? '+' : '-'}PHP {p.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                                            </p>
                                                            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{p.notes || (isDeposit ? 'Salary deposit' : 'Withdrawal')}</p>
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <span style={{
                                                            display: 'inline-block', padding: '2px 10px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700, marginBottom: 4,
                                                            background: isDeposit ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)',
                                                            color: isDeposit ? '#10b981' : '#ef4444',
                                                        }}>
                                                            {isDeposit ? 'Salary' : 'Withdrawal'}
                                                        </span>
                                                        {p.payment_month && <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{p.payment_month}</p>}
                                                        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{new Date(p.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                <div style={{ marginTop: 20, padding: 14, borderRadius: 10, background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', textAlign: 'center' }}>
                                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Total Salary Received (All Time): <strong style={{ color: 'var(--accent-primary)' }}>PHP {salaryInfo.total_all_time.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></p>
                                </div>
                            </>
                        ) : (
                            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Failed to load salary data</div>
                        )}
                    </div>
                )}
                {/* Restock Request Modal */}
                {showRestockModal && (
                    <div style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
                    }} onClick={() => setShowRestockModal(false)}>
                        <div className="card" style={{ maxWidth: 420, width: '100%', padding: 32 }} onClick={e => e.stopPropagation()}>
                            <h3 style={{ marginBottom: 4 }}>Request Restock</h3>
                            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                                This request will be sent to your manager for approval.
                            </p>
                            <div className="form-group">
                                <label>Product</label>
                                {restockProductId ? (
                                    (() => {
                                        const sel = products.find(p => p.id === restockProductId);
                                        return sel ? (
                                            <div style={{
                                                display: 'flex', alignItems: 'center', gap: 12,
                                                padding: '10px 14px', borderRadius: 10,
                                                background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                                            }}>
                                                {sel.images?.[0] && (
                                                    <img src={sel.images[0]} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
                                                        onError={e => e.target.style.display = 'none'} />
                                                )}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sel.title}</p>
                                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Current stock: {sel.stock || 0}</p>
                                                </div>
                                                <button type="button" onClick={() => setRestockProductId('')}
                                                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem', padding: 4 }}>✕</button>
                                            </div>
                                        ) : null;
                                    })()
                                ) : (
                                    <select value={restockProductId} onChange={e => setRestockProductId(e.target.value)}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                                        <option value="">Select a product...</option>
                                        {products.filter(p => p.is_active).map(p => (
                                            <option key={p.id} value={p.id}>{p.title} (Stock: {p.stock || 0})</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                            <div className="form-group">
                                <label>Quantity</label>
                                <input type="number" min="1" value={restockQuantity} onChange={e => setRestockQuantity(e.target.value)} placeholder="e.g. 50" />
                            </div>
                            <div className="form-group">
                                <label>Notes (optional)</label>
                                <textarea value={restockNotes} onChange={e => setRestockNotes(e.target.value)} placeholder="Reason for restock..." rows={2} />
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn btn-outline" onClick={() => setShowRestockModal(false)} style={{ flex: 1 }}>Cancel</button>
                                <button className="btn btn-primary" onClick={handleRestockSubmit} disabled={restockLoading} style={{ flex: 1 }}>
                                    {restockLoading ? 'Submitting...' : 'Submit Request'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
