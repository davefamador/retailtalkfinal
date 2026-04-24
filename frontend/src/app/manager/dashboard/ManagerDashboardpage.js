'use client';

import { useState, useEffect, useRef } from 'react';
import {
    getStoredUser, logout,
    managerGetDashboard, managerGetStaff, managerRegisterStaff,
    managerGetStaffDetail, managerRemoveStaff, managerGetRestockRequests,
    managerApproveRestock, managerRejectRestock, managerCancelRestock,
    managerGetProducts, managerGetTransactions,
    createProduct, uploadProductImage,
    getManagerDeliveryOrders, managerUpdateDeliveryOrderStatus,
    managerRequestProductRemoval, getSellerWishlistReport,
    managerReassignOrder, getSalaryHistory, getBalance, withdraw,
    managerRestockDirect, managerChangeStaffPassword,
} from '../../../lib/api';
import {
    LayoutDashboard, Users, Package, ShoppingCart, Truck, Tag,
    CreditCard, TrendingUp, LogOut, Trash2, Heart, DollarSign,
    Building2, Coins, RefreshCw, BarChart3, CalendarDays, MapPin,
    UserPlus, ClipboardList,
} from 'lucide-react';
import ReportsContent from '../../components/ReportsContent';
import Toast from '../../components/Toast';

// ── Line Chart Component ─────────────────────────────────
function LineChart({ data, labelKey, valueKey, title, color = '#6366f1', height = 220 }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        if (!canvasRef.current || !data || data.length === 0) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const w = canvas.width = canvas.parentElement.clientWidth;
        const h = canvas.height = height;
        ctx.clearRect(0, 0, w, h);

        const padding = { top: 24, right: 20, bottom: 50, left: 70 };
        const chartW = w - padding.left - padding.right;
        const chartH = h - padding.top - padding.bottom;
        const maxVal = Math.max(...data.map(d => d[valueKey]), 1);

        // Grid lines
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (chartH * i / 4);
            ctx.strokeStyle = 'rgba(136,136,160,0.1)';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(w - padding.right, y); ctx.stroke();
            ctx.fillStyle = 'rgba(136,136,160,0.5)';
            ctx.font = '11px Inter, system-ui';
            ctx.textAlign = 'right';
            ctx.fillText('₱' + (maxVal * (4 - i) / 4).toFixed(0), padding.left - 8, y + 4);
        }

        // Plot line + gradient fill
        const stepX = data.length > 1 ? chartW / (data.length - 1) : chartW;
        const points = data.map((d, i) => ({
            x: padding.left + i * stepX,
            y: padding.top + chartH - (d[valueKey] / maxVal) * chartH,
        }));

        // Gradient fill under line
        const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
        gradient.addColorStop(0, color + '30');
        gradient.addColorStop(1, color + '05');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(points[0].x, padding.top + chartH);
        points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.lineTo(points[points.length - 1].x, padding.top + chartH);
        ctx.closePath();
        ctx.fill();

        // Line
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.stroke();

        // Dots
        points.forEach(p => {
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = color;
            ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
        });

        // X labels
        ctx.fillStyle = 'rgba(136,136,160,0.6)';
        ctx.font = '10px Inter, system-ui';
        ctx.textAlign = 'center';
        data.forEach((d, i) => {
            const x = padding.left + i * stepX;
            const label = d[labelKey].length > 8 ? d[labelKey].slice(-5) : d[labelKey];
            ctx.save();
            ctx.translate(x, h - 5);
            ctx.rotate(-0.4);
            ctx.fillText(label, 0, 0);
            ctx.restore();
        });
    }, [data, labelKey, valueKey, color, height]);

    return (
        <div>
            <h4 style={{ marginBottom: 12, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{title}</h4>
            {(!data || data.length === 0) ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No data yet</p>
            ) : (
                <canvas ref={canvasRef} style={{ width: '100%', height }} />
            )}
        </div>
    );
}

// ── Dual Line Chart Component ────────────────────────────
function DualLineChart({ data, labelKey, valueKey1, valueKey2, color1 = '#10b981', color2 = '#3b82f6', label1 = 'Line 1', label2 = 'Line 2', title, height = 220 }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        if (!canvasRef.current || !data || data.length === 0) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const w = canvas.width = canvas.parentElement.clientWidth;
        const h = canvas.height = height;
        ctx.clearRect(0, 0, w, h);

        const padding = { top: 24, right: 20, bottom: 50, left: 50 };
        const chartW = w - padding.left - padding.right;
        const chartH = h - padding.top - padding.bottom;
        const maxVal = Math.max(
            ...data.map(d => d[valueKey1] || 0),
            ...data.map(d => d[valueKey2] || 0),
            1
        );

        // Grid lines
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (chartH * i / 4);
            ctx.strokeStyle = 'rgba(136,136,160,0.1)';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(w - padding.right, y); ctx.stroke();
            ctx.fillStyle = 'rgba(136,136,160,0.5)';
            ctx.font = '11px Inter, system-ui';
            ctx.textAlign = 'right';
            ctx.fillText((maxVal * (4 - i) / 4).toFixed(0), padding.left - 8, y + 4);
        }

        const stepX = data.length > 1 ? chartW / (data.length - 1) : chartW;

        // Draw line helper
        const drawLine = (key, color) => {
            const points = data.map((d, i) => ({
                x: padding.left + i * stepX,
                y: padding.top + chartH - ((d[key] || 0) / maxVal) * chartH,
            }));
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.5;
            ctx.lineJoin = 'round';
            ctx.beginPath();
            points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
            ctx.stroke();
            // Dots
            points.forEach(p => {
                ctx.fillStyle = '#fff';
                ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = color;
                ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill();
            });
        };

        drawLine(valueKey1, color1);
        drawLine(valueKey2, color2);

        // X labels
        ctx.fillStyle = 'rgba(136,136,160,0.6)';
        ctx.font = '10px Inter, system-ui';
        ctx.textAlign = 'center';
        data.forEach((d, i) => {
            const x = padding.left + i * stepX;
            const label = d[labelKey].length > 8 ? d[labelKey].slice(-5) : d[labelKey];
            ctx.save();
            ctx.translate(x, h - 5);
            ctx.rotate(-0.4);
            ctx.fillText(label, 0, 0);
            ctx.restore();
        });

        // Legend
        const legendY = 8;
        const legendX = w - padding.right - 160;
        [{ color: color1, label: label1 }, { color: color2, label: label2 }].forEach((item, i) => {
            const x = legendX + i * 80;
            ctx.fillStyle = item.color;
            ctx.beginPath(); ctx.arc(x, legendY, 4, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(136,136,160,0.7)';
            ctx.font = '10px Inter, system-ui';
            ctx.textAlign = 'left';
            ctx.fillText(item.label, x + 8, legendY + 3);
        });
    }, [data, labelKey, valueKey1, valueKey2, color1, color2, label1, label2, height]);

    return (
        <div>
            <h4 style={{ marginBottom: 12, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{title}</h4>
            {(!data || data.length === 0) ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No data yet</p>
            ) : (
                <canvas ref={canvasRef} style={{ width: '100%', height }} />
            )}
        </div>
    );
}

// ── Sidebar Item ─────────────────────────────────────────
function SidebarItem({ icon: Icon, label, active, onClick }) {
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
            {label}
        </button>
    );
}

// ── Stat Card ────────────────────────────────────────────
function StatCard({ icon, label, value, color }) {
    return (
        <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
            borderRadius: 16, padding: '24px 20px',
            display: 'flex', flexDirection: 'column', gap: 12,
            transition: 'all 0.3s',
        }}>
            <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: `${color}15`, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: '1.2rem',
            }}>
                {icon}
            </div>
            <div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {label}
                </p>
                <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {value}
                </p>
            </div>
        </div>
    );
}


export default function ManagerDashboard() {
    const [manager, setManager] = useState(null);
    const [authChecked, setAuthChecked] = useState(false);
    const [activeTab, setActiveTab] = useState('dashboard');

    const [dashLoading, setDashLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [staff, setStaff] = useState([]);
    const [staffSearch, setStaffSearch] = useState('');
    const [restockRequests, setRestockRequests] = useState([]);
    const [restockFilter, setRestockFilter] = useState('pending_manager');
    const [message, setMessage] = useState({ type: '', text: '' });

    // Products & Transactions
    const [mgrProducts, setMgrProducts] = useState([]);
    const [mgrProductSearch, setMgrProductSearch] = useState('');
    const [mgrTransactions, setMgrTransactions] = useState([]);
    const [mgrTxnSearch, setMgrTxnSearch] = useState('');
    const [mgrTxnTypeFilter, setMgrTxnTypeFilter] = useState('all');
    const [mgrTxnStatusFilter, setMgrTxnStatusFilter] = useState('all');
    const [mgrTxnDateFrom, setMgrTxnDateFrom] = useState('');
    const [mgrTxnDateTo, setMgrTxnDateTo] = useState('');

    // Transactions sub-tab
    const [txnSubTab, setTxnSubTab] = useState('orders');
    const [restockHistory, setRestockHistory] = useState([]);
    const [restockHistoryLoading, setRestockHistoryLoading] = useState(false);
    const [restockHistoryStatusFilter, setRestockHistoryStatusFilter] = useState('all');
    const [restockHistoryDateFrom, setRestockHistoryDateFrom] = useState('');
    const [restockHistoryDateTo, setRestockHistoryDateTo] = useState('');

    // Direct restock popup
    const [restockPopupProduct, setRestockPopupProduct] = useState(null);
    const [restockDirectQty, setRestockDirectQty] = useState('');
    const [restockDirectNotes, setRestockDirectNotes] = useState('');
    const [restockDirectLoading, setRestockDirectLoading] = useState(false);

    // Create product modal
    const [showCreateProduct, setShowCreateProduct] = useState(false);
    const [productForm, setProductForm] = useState({ title: '', description: '', price: '', stock: '' });
    const [productImages, setProductImages] = useState([]);
    const [productUploading, setProductUploading] = useState(false);
    const [productCreating, setProductCreating] = useState(false);

    // Staff registration modal
    const [showRegisterStaff, setShowRegisterStaff] = useState(false);
    const [staffForm, setStaffForm] = useState({ full_name: '', email: '', password: '', contact_number: '' });
    const [staffFormErrors, setStaffFormErrors] = useState({});

    // Staff detail panel
    const [selectedStaffId, setSelectedStaffId] = useState(null);
    const [staffDetail, setStaffDetail] = useState(null);
    const [staffDetailLoading, setStaffDetailLoading] = useState(false);

    // Change staff password
    const [staffNewPassword, setStaffNewPassword] = useState('');
    const [staffPwLoading, setStaffPwLoading] = useState(false);

    // Delivery orders
    const [mgrDeliveryOrders, setMgrDeliveryOrders] = useState([]);
    const [deliveryOrderLoading, setDeliveryOrderLoading] = useState(false);
    const [deliveryStatusFilter, setDeliveryStatusFilter] = useState('all');
    const [deliverySearch, setDeliverySearch] = useState('');
    const [selectedMgrOrder, setSelectedMgrOrder] = useState(null);



    // Product removal
    const [removalLoading, setRemovalLoading] = useState(false);

    // Staff removal
    const [removeStaffLoading, setRemoveStaffLoading] = useState(false);

    // Wishlist analytics
    const [wishlistReport, setWishlistReport] = useState(null);
    const [wishlistLoading, setWishlistLoading] = useState(false);

    // Reassign order
    const [reassignOrderId, setReassignOrderId] = useState(null);
    const [reassignLoading, setReassignLoading] = useState(false);

    // Restock approve/reject/cancel inline forms
    const [approveId, setApproveId] = useState(null);
    const [approveData, setApproveData] = useState({ approved_quantity: '', manager_notes: '' });
    const [rejectId, setRejectId] = useState(null);
    const [rejectNotes, setRejectNotes] = useState('');
    const [cancelRestockId, setCancelRestockId] = useState(null);
    const [cancelRestockNotes, setCancelRestockNotes] = useState('');
    const [restockActionLoading, setRestockActionLoading] = useState(false);

    // Salary state
    const [salaryInfo, setSalaryInfo] = useState(null);
    const [salaryLoading, setSalaryLoading] = useState(false);
    const [mgrBalance, setMgrBalance] = useState(0);
    const [withdrawAmt, setWithdrawAmt] = useState('');
    const [withdrawing, setWithdrawing] = useState(false);
    const [salaryMsg, setSalaryMsg] = useState({ type: '', text: '' });



    useEffect(() => {
        const stored = getStoredUser();
        if (!stored || stored.role !== 'manager') {
            window.location.href = '/login';
            return;
        }
        setManager(stored);
        setAuthChecked(true);
        loadDashboard();
    }, []);

    const loadDashboard = async () => {
        setDashLoading(true);
        try { setStats(await managerGetDashboard()); } catch (e) { console.error(e); }
        finally { setDashLoading(false); }
    };
    const loadStaff = async (search = '') => {
        try { setStaff(await managerGetStaff(search)); } catch (e) { console.error(e); setMessage({ type: 'error', text: 'Failed to load staff: ' + e.message }); }
    };
    const loadRestockRequests = async (status = 'pending_manager') => {
        try { setRestockRequests(await managerGetRestockRequests(status)); } catch (e) { console.error(e); }
    };
    const loadMgrProducts = async (search = '') => {
        try { setMgrProducts(await managerGetProducts(search)); } catch (e) { console.error(e); }
    };
    const loadMgrTransactions = async (search = '') => {
        try { setMgrTransactions(await managerGetTransactions(search)); } catch (e) { console.error(e); }
    };
    const loadRestockHistory = async () => {
        setRestockHistoryLoading(true);
        try { setRestockHistory(await managerGetRestockRequests('')); } catch (e) { console.error(e); }
        finally { setRestockHistoryLoading(false); }
    };
    const loadMgrDeliveryOrders = async () => {
        try { setMgrDeliveryOrders(await getManagerDeliveryOrders()); } catch (e) { console.error(e); }
    };
    const handleMgrDeliveryStatusUpdate = async (txnId) => {
        setDeliveryOrderLoading(true);
        try {
            await managerUpdateDeliveryOrderStatus(txnId, 'approved');
            setMessage({ type: 'success', text: 'Order marked as ready for delivery pickup' });
            loadMgrDeliveryOrders();
            loadDashboard();
        } catch (e) { setMessage({ type: 'error', text: e.message }); }
        finally { setDeliveryOrderLoading(false); }
    };
    const loadWishlistReport = async () => {
        setWishlistLoading(true);
        try { setWishlistReport(await getSellerWishlistReport()); } catch (e) { console.error(e); }
        finally { setWishlistLoading(false); }
    };
    const loadSalaryInfo = async () => {
        setSalaryLoading(true);
        try {
            const [sal, bal] = await Promise.all([getSalaryHistory(), getBalance()]);
            setSalaryInfo(sal);
            setMgrBalance(parseFloat(bal.balance) || 0);
        } catch (e) { console.error(e); }
        finally { setSalaryLoading(false); }
    };
    const handleSalaryWithdraw = async () => {
        const amt = parseFloat(withdrawAmt);
        if (!amt || amt <= 0) { setSalaryMsg({ type: 'error', text: 'Enter a valid amount' }); return; }
        setWithdrawing(true);
        try {
            const res = await withdraw(amt);
            setMgrBalance(res.balance || 0);
            setWithdrawAmt('');
            setSalaryMsg({ type: 'success', text: `Successfully withdrew PHP ${amt.toFixed(2)}` });
            loadSalaryInfo();
        } catch (e) { setSalaryMsg({ type: 'error', text: e.message }); }
        finally { setWithdrawing(false); }
    };
    const handleReassignOrder = async (orderId, staffId) => {
        setReassignLoading(true);
        try {
            await managerReassignOrder(orderId, staffId);
            setMessage({ type: 'success', text: 'Order reassigned successfully' });
            setReassignOrderId(null);
            loadMgrDeliveryOrders();
        } catch (e) { setMessage({ type: 'error', text: e.message }); }
        finally { setReassignLoading(false); }
    };

    const handleRestockDirect = async () => {
        if (!restockPopupProduct || !restockDirectQty || parseInt(restockDirectQty) < 1) {
            setMessage({ type: 'error', text: 'Please enter a valid quantity.' });
            return;
        }
        setRestockDirectLoading(true);
        try {
            await managerRestockDirect(restockPopupProduct.id, parseInt(restockDirectQty), restockDirectNotes);
            setMessage({ type: 'success', text: `Restock order for "${restockPopupProduct.title}" sent to delivery queue!` });
            setRestockPopupProduct(null);
            setRestockDirectQty('');
            setRestockDirectNotes('');
        } catch (e) {
            setMessage({ type: 'error', text: e.message });
        } finally {
            setRestockDirectLoading(false);
        }
    };

    const handleRequestRemoval = async (productId) => {
        if (!window.confirm('Are you sure you want to request removal of this product?')) return;
        setRemovalLoading(true);
        try {
            await managerRequestProductRemoval(productId);
            setMessage({ type: 'success', text: 'Product removal request submitted successfully!' });
            loadMgrProducts(mgrProductSearch);
        } catch (e) {
            setMessage({ type: 'error', text: e.message });
        } finally {
            setRemovalLoading(false);
        }
    };

    useEffect(() => {
        if (!authChecked) return;
        if (activeTab === 'staff') loadStaff();
        if (activeTab === 'restock') loadRestockRequests(restockFilter);
        if (activeTab === 'products') loadMgrProducts();
        if (activeTab === 'transactions') { loadMgrTransactions(); loadRestockHistory(); }
        if (activeTab === 'delivery_orders') loadMgrDeliveryOrders();
        if (activeTab === 'wishlist') loadWishlistReport();
        if (activeTab === 'salary') loadSalaryInfo();
    }, [activeTab, authChecked]);

    useEffect(() => {
        if (activeTab === 'restock' && authChecked) loadRestockRequests(restockFilter);
    }, [restockFilter]);

    const handleRegisterStaff = async () => {
        const errors = {};
        if (!staffForm.full_name.trim()) errors.full_name = 'Full name is required.';
        else if (staffForm.full_name.trim().length < 2) errors.full_name = 'Name must be at least 2 characters.';

        if (!staffForm.email.trim()) errors.email = 'Email is required.';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(staffForm.email.trim())) errors.email = 'Enter a valid email address.';

        if (!staffForm.password) errors.password = 'Password is required.';
        else if (staffForm.password.length < 6) errors.password = 'Password must be at least 6 characters.';

        if (staffForm.contact_number && !/^\+?[\d\s\-()]{7,15}$/.test(staffForm.contact_number.trim()))
            errors.contact_number = 'Enter a valid contact number.';

        setStaffFormErrors(errors);
        if (Object.keys(errors).length > 0) return;

        try {
            await managerRegisterStaff(staffForm);
            setMessage({ type: 'success', text: 'Staff member registered successfully!' });
            setShowRegisterStaff(false);
            setStaffForm({ full_name: '', email: '', password: '', contact_number: '' });
            setStaffFormErrors({});
            loadStaff(staffSearch);
            loadDashboard();
        } catch (e) { setMessage({ type: 'error', text: e.message }); }
    };

    const handleStaffClick = async (userId) => {
        setSelectedStaffId(userId);
        setStaffDetailLoading(true);
        setStaffDetail(null);
        try {
            const detail = await managerGetStaffDetail(userId);
            setStaffDetail(detail);
        } catch (e) {
            setMessage({ type: 'error', text: 'Failed to load staff details: ' + e.message });
            setSelectedStaffId(null);
        } finally {
            setStaffDetailLoading(false);
        }
    };

    const closeStaffPanel = () => {
        setSelectedStaffId(null);
        setStaffDetail(null);
        setStaffNewPassword('');
    };

    const handleChangeStaffPassword = async (userId) => {
        if (!staffNewPassword || staffNewPassword.length < 6) {
            setMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
            return;
        }
        setStaffPwLoading(true);
        try {
            await managerChangeStaffPassword(userId, staffNewPassword);
            setMessage({ type: 'success', text: 'Password updated successfully.' });
            setStaffNewPassword('');
        } catch (e) {
            setMessage({ type: 'error', text: e.message });
        } finally {
            setStaffPwLoading(false);
        }
    };

    const handleRemoveStaff = async (userId, staffName) => {
        if (!window.confirm(`Permanently delete "${staffName}"? This cannot be undone.`)) return;
        setRemoveStaffLoading(true);
        try {
            await managerRemoveStaff(userId);
            setMessage({ type: 'success', text: `Staff member "${staffName}" has been permanently deleted.` });
            closeStaffPanel();
            loadStaff(staffSearch);
            loadDashboard();
        } catch (e) {
            setMessage({ type: 'error', text: e.message });
        } finally {
            setRemoveStaffLoading(false);
        }
    };

    const handleApproveRestock = async (requestId) => {
        setRestockActionLoading(true);
        try {
            const payload = {};
            if (approveData.approved_quantity) payload.approved_quantity = parseInt(approveData.approved_quantity);
            if (approveData.manager_notes) payload.manager_notes = approveData.manager_notes;
            await managerApproveRestock(requestId, payload);
            setMessage({ type: 'success', text: 'Restock request approved!' });
            setApproveId(null);
            setApproveData({ approved_quantity: '', manager_notes: '' });
            loadRestockRequests(restockFilter);
        } catch (e) { setMessage({ type: 'error', text: e.message }); }
        finally { setRestockActionLoading(false); }
    };

    const handleRejectRestock = async (requestId) => {
        setRestockActionLoading(true);
        try {
            const payload = {};
            if (rejectNotes) payload.manager_notes = rejectNotes;
            await managerRejectRestock(requestId, payload);
            setMessage({ type: 'success', text: 'Restock request rejected.' });
            setRejectId(null);
            setRejectNotes('');
            loadRestockRequests(restockFilter);
        } catch (e) { setMessage({ type: 'error', text: e.message }); }
        finally { setRestockActionLoading(false); }
    };

    const handleCancelRestock = async (requestId) => {
        setRestockActionLoading(true);
        try {
            const payload = {};
            if (cancelRestockNotes) payload.manager_notes = cancelRestockNotes;
            await managerCancelRestock(requestId, payload);
            setMessage({ type: 'success', text: 'Restock request cancelled.' });
            setCancelRestockId(null);
            setCancelRestockNotes('');
            loadRestockRequests(restockFilter);
        } catch (e) { setMessage({ type: 'error', text: e.message }); }
        finally { setRestockActionLoading(false); }
    };

    const handleImageUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (productImages.length + files.length > 5) {
            setMessage({ type: 'error', text: 'Maximum 5 images allowed' });
            return;
        }
        setProductUploading(true);
        try {
            for (const file of files) {
                const result = await uploadProductImage(file);
                setProductImages(prev => [...prev, result.url]);
            }
        } catch (err) { setMessage({ type: 'error', text: err.message }); }
        finally { setProductUploading(false); }
    };

    const handleCreateProduct = async () => {
        if (!productForm.title.trim() || !productForm.price || !productForm.stock) {
            setMessage({ type: 'error', text: 'Title, price, and stock are required' });
            return;
        }
        if (productImages.length === 0) {
            setMessage({ type: 'error', text: 'At least one product image is required' });
            return;
        }
        setProductCreating(true);
        try {
            await createProduct({
                title: productForm.title.trim(),
                description: productForm.description.trim(),
                price: parseFloat(productForm.price),
                stock: parseInt(productForm.stock),
                images: productImages,
            });
            setMessage({ type: 'success', text: 'Product created successfully!' });
            setShowCreateProduct(false);
            setProductForm({ title: '', description: '', price: '', stock: '' });
            setProductImages([]);
            loadMgrProducts(mgrProductSearch);
            loadDashboard();
        } catch (err) { setMessage({ type: 'error', text: err.message }); }
        finally { setProductCreating(false); }
    };

    const handleLogout = () => { logout(); window.location.href = '/login'; };

    if (!authChecked) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner" style={{ width: 40, height: 40 }}></div>
            </div>
        );
    }

    const sidebarItems = [
        { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { id: 'staff', icon: Users, label: 'Staff' },
        { id: 'restock', icon: Package, label: 'Restock' },
        { id: 'delivery_orders', icon: Truck, label: 'Delivery Orders' },
        { id: 'products', icon: Tag, label: 'Products' },
        { id: 'transactions', icon: CreditCard, label: 'Order History' },
        { id: 'wishlist', icon: Heart, label: 'Wishlist' },
        { id: 'salary', icon: DollarSign, label: 'Salary' },
        { id: 'divider' },
        { id: 'reports', icon: TrendingUp, label: 'Reports' },
    ];

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
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Manager</div>
                    </div>
                </div>
                <nav style={{ padding: '16px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {sidebarItems.map(item =>
                        item.id === 'divider' ? (
                            <div key="divider" style={{ height: 1, background: 'var(--border-color)', margin: '8px 0' }} />
                        ) : (
                            <SidebarItem
                                key={item.id}
                                icon={item.icon}
                                label={item.label}
                                active={activeTab === item.id}
                                onClick={() => setActiveTab(item.id)}
                            />
                        )
                    )}
                </nav>

                <div style={{
                    padding: '16px 20px', borderTop: '1px solid var(--border-color)',
                    display: 'flex', alignItems: 'center', gap: 12,
                }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: 'rgba(139,92,246,0.15)', color: '#8b5cf6',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: '0.85rem',
                    }}>
                        {manager?.full_name?.charAt(0)?.toUpperCase() || 'M'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {manager?.full_name}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Manager</div>
                    </div>
                    <button onClick={handleLogout} title="Logout" style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', fontSize: '1.1rem',
                    }}><LogOut size={18} /></button>
                </div>
            </aside>

            {/* ===== MAIN CONTENT ===== */}
            <main style={{ marginLeft: 260, flex: 1, padding: '32px 40px', maxWidth: 1200 }}>
                {/* ===== TOAST NOTIFICATION ===== */}
                <Toast 
                    message={message.text ? message : salaryMsg} 
                    onClose={() => {
                        if (message.text) setMessage({ type: '', text: '' });
                        else setSalaryMsg({ type: '', text: '' });
                    }} 
                />

                {/* ===== REPORTS TAB (embedded) ===== */}
                {activeTab === 'reports' && <ReportsContent />}

                {/* ===== SALARY TAB ===== */}
                {activeTab === 'salary' && (
                    <div style={{ padding: '32px 24px', maxWidth: 800 }}>
                        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 24 }}>My Salary</h2>
                        {salaryLoading ? (
                            <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ width: 32, height: 32, margin: '0 auto' }}></div></div>
                        ) : salaryInfo ? (
                            <>
                                {/* Summary Cards */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
                                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 20 }}>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Fixed Salary</p>
                                        <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#6366f1' }}>PHP {salaryInfo.fixed_salary.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 20 }}>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Paid This Month</p>
                                        <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}>PHP {salaryInfo.paid_this_month.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 20 }}>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Remaining</p>
                                        <p style={{ fontSize: '1.5rem', fontWeight: 800, color: salaryInfo.remaining_this_month > 0 ? '#ef4444' : '#10b981' }}>PHP {salaryInfo.remaining_this_month.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 20 }}>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Your Balance</p>
                                        <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>PHP {mgrBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                </div>
                                {/* Withdraw Section */}
                                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 20, marginBottom: 28 }}>
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
                                                <div key={p.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                            </>
                        ) : (
                            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Failed to load salary data</div>
                        )}
                    </div>
                )}

                {/* ===== DASHBOARD TAB ===== */}
                {activeTab === 'dashboard' && dashLoading && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 16 }}>
                        <div className="spinner" style={{ width: 40, height: 40 }}></div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading dashboard...</p>
                    </div>
                )}
                {activeTab === 'dashboard' && !dashLoading && (
                    <div>
                        <div style={{ marginBottom: 32 }}>
                            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: 4 }}>
                                Welcome back, {manager?.full_name?.split(' ')[0]} 👋
                            </h1>
                            <p style={{ color: 'var(--text-secondary)' }}>
                                Here's your department overview.
                            </p>
                        </div>

                        {stats ? (
                            <>
                                {/* Department name */}
                                {stats.department && (
                                    <div style={{
                                        padding: '16px 20px', borderRadius: 12, marginBottom: 24,
                                        background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                                        display: 'flex', alignItems: 'center', gap: 12,
                                    }}>
                                        <div style={{
                                            width: 40, height: 40, borderRadius: 10,
                                            background: 'rgba(139,92,246,0.15)', display: 'flex',
                                            alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem',
                                        }}><Building2 size={20} /></div>
                                        <div>
                                            <p style={{ fontWeight: 700, fontSize: '1.05rem' }}>{stats.department.name}</p>
                                            {stats.department.description && (
                                                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{stats.department.description}</p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div style={{
                                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                                    gap: 16, marginBottom: 24,
                                }}>
                                    <StatCard icon={<Users size={20} />} label="Total Staff" value={stats.total_staff || 0} color="#6366f1" />
                                    <StatCard icon={<Package size={20} />} label="Total Products" value={stats.total_products || 0} color="#0ea5e9" />
                                    <StatCard icon={<Coins size={20} />} label="Total Revenue" value={`₱${(stats.total_revenue || 0).toFixed(2)}`} color="#10b981" />
                                    <StatCard icon={<RefreshCw size={20} />} label="Pending Restocks" value={stats.pending_restocks || 0} color="#f59e0b" />
                                </div>

                                {/* Main Content Layout */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, marginBottom: 24 }}>
                                    
                                    {/* Hero Chart */}
                                    <div className="card" style={{ padding: 24 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Daily Revenue (14 Days)</h3>
                                            <div style={{ padding: '4px 10px', background: 'rgba(99,102,241,0.1)', color: '#6366f1', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700 }}>
                                                Last 14 Days
                                            </div>
                                        </div>
                                        <LineChart
                                            data={[...(stats.daily_sales || [])].slice(-14)}
                                            labelKey="date" valueKey="amount"
                                            color="#6366f1"
                                        />
                                    </div>

                                    {/* Actionable items */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                        <h4 style={{ fontWeight: 700, margin: 0 }}>Pending Actions</h4>
                                        <div onClick={() => setActiveTab('restock')} className="card-hover-fx" style={{ cursor: 'pointer', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
                                            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <RefreshCw size={22} />
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '1.2rem', fontWeight: 800 }}>{stats.pending_restocks || 0}</p>
                                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Restocks to Review</p>
                                            </div>
                                        </div>
                                        <div onClick={() => setActiveTab('delivery_orders')} className="card-hover-fx" style={{ cursor: 'pointer', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
                                            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Truck size={22} />
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                                                    {(() => {
                                                        const pendingGroups = mgrDeliveryOrders.filter(g => g.status === 'pending');
                                                        return pendingGroups.length;
                                                    })()}
                                                </p>
                                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Box Orders to Assign</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Store User Demographics */}
                                <div>
                                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 16 }}>Store Network Demographics</h3>
                                    <div style={{
                                        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                        gap: 16, marginBottom: 24,
                                    }}>
                                        <StatCard icon={<ShoppingCart size={20} />} label="Store Buyers" value={stats.store_buyers || 0} color="#ec4899" />
                                        <StatCard icon={<Users size={20} />} label="Store Staff" value={stats.store_staff || 0} color="#6366f1" />
                                        <StatCard icon={<Building2 size={20} />} label="Store Managers" value={stats.store_managers || 1} color="#8b5cf6" />
                                        <StatCard icon={<Truck size={20} />} label="Store Delivery" value={stats.store_delivery || 0} color="#f97316" />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="loading-container"><div className="spinner" style={{ width: 40, height: 40 }}></div><p>Loading...</p></div>
                        )}
                    </div>
                )}

                {/* ===== STAFF TAB ===== */}
                {activeTab === 'staff' && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <div>
                                <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Staff Management</h1>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Manage your department staff</p>
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <input
                                    type="text" placeholder="Search staff..."
                                    value={staffSearch} onChange={e => setStaffSearch(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && loadStaff(staffSearch)}
                                    style={{
                                        width: 240, padding: '10px 14px', borderRadius: 10,
                                        background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                                        color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif',
                                    }}
                                />
                                <button className="btn btn-primary btn-sm" onClick={() => loadStaff(staffSearch)}>Search</button>
                            </div>
                        </div>

                        {/* Add Staff Button */}
                        <button
                            onClick={() => setShowRegisterStaff(true)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
                                padding: '10px 20px', borderRadius: 10, border: '1px solid rgba(99,102,241,0.3)',
                                background: 'rgba(99,102,241,0.1)', color: '#6366f1',
                                cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem',
                                fontFamily: 'Inter, sans-serif', transition: 'all 0.2s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.2)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(99,102,241,0.1)'}
                        >
                            <Users size={16} /> + Add Staff
                        </button>

                        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Name</th><th>Email</th><th>Status</th><th style={{ textAlign: 'center' }}>Processed Items Today</th><th style={{ textAlign: 'center' }}>Total Completed</th><th style={{ width: 100, textAlign: 'center' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {staff.map(s => (
                                        <tr key={s.id} style={{ ...(s.is_banned ? { opacity: 0.5 } : {}), cursor: 'pointer', transition: 'background 0.15s' }}
                                            onClick={() => handleStaffClick(s.id)}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(108,99,255,0.06)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <td style={{ fontWeight: 500 }}>{s.full_name}</td>
                                            <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{s.email}</td>
                                            <td>
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                                    padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
                                                    background: s.is_banned ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                                                    color: s.is_banned ? '#ef4444' : '#10b981',
                                                }}>
                                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.is_banned ? '#ef4444' : '#10b981' }}></span>
                                                    {s.is_banned ? 'Banned' : 'Active'}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'center', fontWeight: 600, fontSize: '0.85rem' }}>
                                                <span style={{ color: '#3b82f6', fontWeight: 600 }}>{s.delivery_items_today || 0}</span>
                                            </td>
                                            <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent-primary)' }}>
                                                {s.total_completed_tasks || 0}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleRemoveStaff(s.id, s.full_name); }}
                                                        disabled={removeStaffLoading}
                                                        title="Remove from department"
                                                        style={{
                                                            padding: '5px 12px', borderRadius: 8,
                                                            border: '1px solid rgba(239,68,68,0.3)',
                                                            background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                                                            cursor: removeStaffLoading ? 'not-allowed' : 'pointer',
                                                            fontWeight: 600, fontSize: '0.75rem',
                                                            fontFamily: 'Inter, sans-serif', transition: 'all 0.2s',
                                                            opacity: removeStaffLoading ? 0.5 : 1,
                                                        }}
                                                        onMouseEnter={e => { if (!removeStaffLoading) e.currentTarget.style.background = 'rgba(239,68,68,0.18)'; }}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {staff.length === 0 && <div className="empty-state" style={{ padding: 40 }}><p>No staff found</p></div>}
                        </div>

                        {/* Register Staff Modal */}
                        {showRegisterStaff && (
                            <>
                                <div style={{
                                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                                    zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }} onClick={() => { setShowRegisterStaff(false); setStaffFormErrors({}); }}>
                                    <div style={{
                                        background: 'var(--bg-primary)', borderRadius: 20, padding: 32,
                                        width: 480, maxWidth: '90vw', border: '1px solid var(--border-color)',
                                        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                                    }} onClick={e => e.stopPropagation()}>
                                        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 20 }}>Register Staff</h2>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Full Name *</label>
                                                <input
                                                    type="text" placeholder="Enter full name"
                                                    value={staffForm.full_name} onChange={e => { setStaffForm({ ...staffForm, full_name: e.target.value }); setStaffFormErrors(prev => ({ ...prev, full_name: '' })); }}
                                                    style={{
                                                        width: '100%', padding: '10px 14px', borderRadius: 10,
                                                        background: 'var(--bg-card)', border: `1px solid ${staffFormErrors.full_name ? '#ef4444' : 'var(--border-color)'}`,
                                                        color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem',
                                                    }}
                                                />
                                                {staffFormErrors.full_name && <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: 4 }}>{staffFormErrors.full_name}</p>}
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Email *</label>
                                                <input
                                                    type="email" placeholder="Enter email"
                                                    value={staffForm.email} onChange={e => { setStaffForm({ ...staffForm, email: e.target.value }); setStaffFormErrors(prev => ({ ...prev, email: '' })); }}
                                                    style={{
                                                        width: '100%', padding: '10px 14px', borderRadius: 10,
                                                        background: 'var(--bg-card)', border: `1px solid ${staffFormErrors.email ? '#ef4444' : 'var(--border-color)'}`,
                                                        color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem',
                                                    }}
                                                />
                                                {staffFormErrors.email && <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: 4 }}>{staffFormErrors.email}</p>}
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Password *</label>
                                                <input
                                                    type="password" placeholder="Enter password (min. 6 characters)"
                                                    value={staffForm.password} onChange={e => { setStaffForm({ ...staffForm, password: e.target.value }); setStaffFormErrors(prev => ({ ...prev, password: '' })); }}
                                                    style={{
                                                        width: '100%', padding: '10px 14px', borderRadius: 10,
                                                        background: 'var(--bg-card)', border: `1px solid ${staffFormErrors.password ? '#ef4444' : 'var(--border-color)'}`,
                                                        color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem',
                                                    }}
                                                />
                                                {staffFormErrors.password && <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: 4 }}>{staffFormErrors.password}</p>}
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Contact Number</label>
                                                <input
                                                    type="text" placeholder="Enter contact number"
                                                    value={staffForm.contact_number} onChange={e => { setStaffForm({ ...staffForm, contact_number: e.target.value }); setStaffFormErrors(prev => ({ ...prev, contact_number: '' })); }}
                                                    style={{
                                                        width: '100%', padding: '10px 14px', borderRadius: 10,
                                                        background: 'var(--bg-card)', border: `1px solid ${staffFormErrors.contact_number ? '#ef4444' : 'var(--border-color)'}`,
                                                        color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem',
                                                    }}
                                                />
                                                {staffFormErrors.contact_number && <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: 4 }}>{staffFormErrors.contact_number}</p>}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                                            <button className="btn btn-primary" onClick={handleRegisterStaff}
                                                style={{ flex: 1, padding: '12px 0', fontSize: '0.9rem', fontWeight: 700, borderRadius: 10 }}>
                                                Register Staff
                                            </button>
                                            <button className="btn btn-outline" onClick={() => { setShowRegisterStaff(false); setStaffFormErrors({}); }}
                                                style={{ flex: 1, padding: '12px 0', fontSize: '0.9rem', fontWeight: 700, borderRadius: 10 }}>
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* ===== DELIVERY ORDERS TAB ===== */}
                {activeTab === 'delivery_orders' && (() => {
                    const deliveryColors = {
                        pending: { bg: 'rgba(251,191,36,0.1)', color: '#fbbf24', label: 'Pending' },
                        approved: { bg: 'rgba(16,185,129,0.1)', color: '#10b981', label: 'Ready for Pickup' },
                        ondeliver: { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6', label: 'On Delivery' },
                        delivered: { bg: 'rgba(16,185,129,0.1)', color: '#10b981', label: 'Delivered' },
                        undelivered: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', label: 'Undelivered' },
                        cancelled: { bg: 'rgba(148,163,184,0.1)', color: '#94a3b8', label: 'Cancelled' },
                    };
                    let filteredDelivery = mgrDeliveryOrders;
                    if (deliveryStatusFilter !== 'all') filteredDelivery = filteredDelivery.filter(g => g.status === deliveryStatusFilter);
                    if (deliverySearch.trim()) {
                        const q = deliverySearch.toLowerCase();
                        filteredDelivery = filteredDelivery.filter(g =>
                            (g.buyer_name || '').toLowerCase().includes(q) ||
                            (g.seller_name || '').toLowerCase().includes(q) ||
                            (g.items || []).some(item => (item.product_title || '').toLowerCase().includes(q))
                        );
                    }
                    const approvedOrders = mgrDeliveryOrders.filter(g => g.status === 'approved');
                    const pendingOrders = mgrDeliveryOrders.filter(g => g.status === 'pending');
                    const renderOrderRow = (group, accentColor, borderColor) => {
                        const firstImg = group.items?.[0]?.product_images?.[0] || null;
                        const extraImgs = (group.items || []).slice(1).map(i => i.product_images?.[0]).filter(Boolean);
                        return (
                            <div key={group.group_id} onClick={() => setSelectedMgrOrder(group)} style={{
                                background: 'var(--bg-card)', borderRadius: 10, padding: 12,
                                border: `1px solid ${borderColor}`,
                                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                                cursor: 'pointer',
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
                                    {group.assigned_staff_name && (
                                        <div style={{ fontSize: '0.72rem', color: '#10b981', marginTop: 2, fontWeight: 600 }}>
                                            Approved by: {group.assigned_staff_name}
                                        </div>
                                    )}
                                    {group.delivery_address && (
                                        <div style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', marginTop: 2 }}>📍 {group.delivery_address}</div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                                    {group.status === 'pending' && (
                                        <button
                                            className="btn btn-primary btn-sm"
                                            disabled={deliveryOrderLoading}
                                            onClick={e => { e.stopPropagation(); handleMgrDeliveryStatusUpdate(group.group_id); }}
                                            style={{ fontWeight: 700, fontSize: '0.78rem', padding: '6px 14px' }}
                                        >
                                            {deliveryOrderLoading ? '...' : '✓ Approve'}
                                        </button>
                                    )}
                                    <span style={{
                                        padding: '3px 10px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 600,
                                        background: `${accentColor}22`, color: accentColor,
                                    }}>{group.status === 'approved' ? 'Ready for Pickup' : 'Pending'}</span>
                                </div>
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
                                        value={deliverySearch} onChange={e => setDeliverySearch(e.target.value)}
                                        style={{
                                            width: 180, padding: '8px 12px', borderRadius: 8,
                                            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                                            color: 'var(--text-primary)', fontSize: '0.82rem',
                                        }}
                                    />
                                    <button className="btn btn-outline btn-sm" onClick={loadMgrDeliveryOrders}>Refresh</button>
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
                            {/* Status Filter */}
                            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                                {[{ key: 'all', label: 'All' }, ...Object.entries(deliveryColors).map(([k, v]) => ({ key: k, label: v.label }))].map(f => (
                                    <button key={f.key} onClick={() => setDeliveryStatusFilter(f.key)} style={{
                                        padding: '5px 14px', borderRadius: 8, border: '1px solid',
                                        borderColor: deliveryStatusFilter === f.key ? 'var(--accent-primary)' : 'var(--border-color)',
                                        background: deliveryStatusFilter === f.key ? 'rgba(99,102,241,0.15)' : 'transparent',
                                        color: deliveryStatusFilter === f.key ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                        fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                                        fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
                                    }}>{f.label}</button>
                                ))}
                            </div>
                            {filteredDelivery.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                                    <h3>No delivery orders</h3>
                                    <p>Delivery orders from buyers will appear here</p>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gap: 16 }}>
                                    {filteredDelivery.map(group => {
                                        const sc = deliveryColors[group.status] || { bg: 'var(--bg-secondary)', color: 'var(--text-muted)', label: group.status };
                                        return (
                                            <div key={group.group_id} className="card" onClick={() => setSelectedMgrOrder(group)} style={{ padding: 20, border: group.status === 'pending' ? '1px solid rgba(251,191,36,0.3)' : undefined, cursor: 'pointer' }}>
                                                {/* Group header */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                                    <div>
                                                        <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}><Package size={16} /> Delivery Box</div>
                                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                            Buyer: <strong>{group.buyer_name}</strong>
                                                        </div>
                                                        {group.assigned_staff_name && (
                                                            <div style={{ fontSize: '0.8rem', color: '#10b981', marginTop: 3, fontWeight: 600 }}>
                                                                Approved by: {group.assigned_staff_name}
                                                            </div>
                                                        )}
                                                        {group.delivery_address && (
                                                            <div style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', marginTop: 3, fontWeight: 600 }}>
                                                                <MapPin size={14} /> {group.delivery_address}
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
                                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                                                        {group.status === 'pending' && (
                                                            <button
                                                                className="btn btn-primary btn-sm"
                                                                disabled={deliveryOrderLoading}
                                                                onClick={() => handleMgrDeliveryStatusUpdate(group.group_id)}
                                                                style={{ fontWeight: 600 }}
                                                            >
                                                                ✓ Approve Box
                                                            </button>
                                                        )}
                                                    </div>
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
                {activeTab === 'restock' && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <div>
                                <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Restock Requests</h1>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Review and manage restock requests from staff</p>
                            </div>
                            <span style={{
                                padding: '6px 14px', borderRadius: 20, fontSize: '0.85rem', fontWeight: 700,
                                background: 'rgba(251,191,36,0.15)', color: '#fbbf24',
                            }}>
                                {restockRequests.length} {restockFilter === 'pending_manager' ? 'Pending' : 'Requests'}
                            </span>
                        </div>

                        {/* Status Filter Buttons */}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                            {[
                                { key: 'pending_manager', label: 'Pending' },
                                { key: 'approved_manager', label: 'Approved' },
                                { key: 'rejected_manager', label: 'Rejected' },
                                { key: 'cancelled', label: 'Cancelled' },
                                { key: '', label: 'All' },
                            ].map(f => (
                                <button
                                    key={f.key}
                                    onClick={() => setRestockFilter(f.key)}
                                    style={{
                                        padding: '8px 18px', borderRadius: 10, fontSize: '0.85rem', fontWeight: 600,
                                        border: '1px solid',
                                        borderColor: restockFilter === f.key ? 'var(--accent-primary)' : 'var(--border-color)',
                                        background: restockFilter === f.key ? 'rgba(99,102,241,0.15)' : 'transparent',
                                        color: restockFilter === f.key ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                        cursor: 'pointer', transition: 'all 0.2s',
                                        fontFamily: 'Inter, sans-serif',
                                    }}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>

                        {/* Restock Request Cards */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {restockRequests.map(r => (
                                <div key={r.id} style={{
                                    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                                    borderRadius: 16, padding: 20, transition: 'all 0.2s',
                                }}>
                                    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 12 }}>
                                        {r.product_images && r.product_images.length > 0 && (
                                            <div style={{
                                                width: 64, height: 64, borderRadius: 10, overflow: 'hidden',
                                                background: 'var(--bg-secondary)', flexShrink: 0,
                                            }}>
                                                <img src={r.product_images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    onError={e => e.target.style.display = 'none'} />
                                            </div>
                                        )}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 4 }}>{r.product_title}</h3>
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                                Requested by <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{r.staff_name}</span>
                                            </p>
                                        </div>
                                        <span style={{
                                            padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
                                            background: r.status === 'pending_manager' ? 'rgba(251,191,36,0.15)' :
                                                r.status === 'approved_manager' ? 'rgba(16,185,129,0.1)' :
                                                r.status === 'rejected_manager' ? 'rgba(239,68,68,0.1)' :
                                                r.status === 'cancelled' ? 'rgba(148,163,184,0.15)' : 'rgba(148,163,184,0.1)',
                                            color: r.status === 'pending_manager' ? '#fbbf24' :
                                                r.status === 'approved_manager' ? '#10b981' :
                                                r.status === 'rejected_manager' ? '#ef4444' :
                                                r.status === 'cancelled' ? '#94a3b8' : '#94a3b8',
                                            textTransform: 'capitalize',
                                        }}>
                                            {r.status.replace(/_/g, ' ')}
                                        </span>
                                    </div>

                                    <div style={{
                                        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10,
                                        padding: 12, borderRadius: 10, background: 'var(--bg-secondary)', marginBottom: 12,
                                    }}>
                                        <div>
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.65rem', textTransform: 'uppercase', marginBottom: 2 }}>Price</p>
                                            <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-secondary)' }}>₱{(r.product_price || 0).toFixed(2)}</p>
                                        </div>
                                        <div>
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.65rem', textTransform: 'uppercase', marginBottom: 2 }}>Current Stock</p>
                                            <p style={{ fontSize: '0.85rem', fontWeight: 600, color: r.current_stock <= 0 ? '#ef4444' : '#f59e0b' }}>{r.current_stock}</p>
                                        </div>
                                        <div>
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.65rem', textTransform: 'uppercase', marginBottom: 2 }}>Requested Qty</p>
                                            <p style={{ fontSize: '0.85rem', fontWeight: 700 }}>{r.requested_quantity}</p>
                                        </div>
                                        {r.approved_quantity != null && r.approved_quantity > 0 && (
                                            <div>
                                                <p style={{ color: 'var(--text-muted)', fontSize: '0.65rem', textTransform: 'uppercase', marginBottom: 2 }}>Approved Qty</p>
                                                <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10b981' }}>{r.approved_quantity}</p>
                                            </div>
                                        )}
                                        <div>
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.65rem', textTransform: 'uppercase', marginBottom: 2 }}>Date</p>
                                            <p style={{ fontSize: '0.8rem', fontWeight: 500 }}>{new Date(r.created_at).toLocaleDateString()}</p>
                                        </div>
                                    </div>

                                    {r.notes && (
                                        <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.1)' }}>
                                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Staff Notes</p>
                                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{r.notes}</p>
                                        </div>
                                    )}

                                    {r.manager_notes && (
                                        <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.1)' }}>
                                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Manager Notes</p>
                                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{r.manager_notes}</p>
                                        </div>
                                    )}

                                    {/* Actions for pending/approved requests */}
                                    {(r.status === 'pending_manager' || r.status === 'approved_manager') && (
                                        <div>
                                            {/* Approve inline form */}
                                            {approveId === r.id ? (
                                                <div style={{
                                                    padding: 14, borderRadius: 10, background: 'rgba(16,185,129,0.05)',
                                                    border: '1px solid rgba(16,185,129,0.2)', marginBottom: 8,
                                                }}>
                                                    <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#10b981', marginBottom: 10 }}>Approve Request</p>
                                                    <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                                                        <div style={{ flex: 1 }}>
                                                            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4 }}>Approved Quantity (optional, defaults to requested)</label>
                                                            <input
                                                                type="number" placeholder={r.requested_quantity.toString()}
                                                                value={approveData.approved_quantity}
                                                                onChange={e => setApproveData({ ...approveData, approved_quantity: e.target.value })}
                                                                style={{
                                                                    width: '100%', padding: '8px 12px', borderRadius: 8,
                                                                    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                                                                    color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem',
                                                                }}
                                                            />
                                                        </div>
                                                        <div style={{ flex: 2 }}>
                                                            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4 }}>Manager Notes (optional)</label>
                                                            <input
                                                                type="text" placeholder="Add notes..."
                                                                value={approveData.manager_notes}
                                                                onChange={e => setApproveData({ ...approveData, manager_notes: e.target.value })}
                                                                style={{
                                                                    width: '100%', padding: '8px 12px', borderRadius: 8,
                                                                    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                                                                    color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem',
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 8 }}>
                                                        <button className="btn btn-success btn-sm" disabled={restockActionLoading}
                                                            onClick={() => handleApproveRestock(r.id)}
                                                            style={{ padding: '8px 20px', fontSize: '0.8rem', fontWeight: 700, borderRadius: 8 }}>
                                                            {restockActionLoading ? '...' : 'Confirm Approve'}
                                                        </button>
                                                        <button className="btn btn-outline btn-sm"
                                                            onClick={() => { setApproveId(null); setApproveData({ approved_quantity: '', manager_notes: '' }); }}
                                                            style={{ padding: '8px 16px', fontSize: '0.8rem', borderRadius: 8 }}>
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : rejectId === r.id ? (
                                                /* Reject inline form */
                                                <div style={{
                                                    padding: 14, borderRadius: 10, background: 'rgba(239,68,68,0.05)',
                                                    border: '1px solid rgba(239,68,68,0.2)', marginBottom: 8,
                                                }}>
                                                    <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ef4444', marginBottom: 10 }}>Reject Request</p>
                                                    <div style={{ marginBottom: 10 }}>
                                                        <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4 }}>Reason / Notes (optional)</label>
                                                        <input
                                                            type="text" placeholder="Reason for rejection..."
                                                            value={rejectNotes}
                                                            onChange={e => setRejectNotes(e.target.value)}
                                                            style={{
                                                                width: '100%', padding: '8px 12px', borderRadius: 8,
                                                                background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                                                                color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem',
                                                            }}
                                                        />
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 8 }}>
                                                        <button className="btn btn-danger btn-sm" disabled={restockActionLoading}
                                                            onClick={() => handleRejectRestock(r.id)}
                                                            style={{ padding: '8px 20px', fontSize: '0.8rem', fontWeight: 700, borderRadius: 8 }}>
                                                            {restockActionLoading ? '...' : 'Confirm Reject'}
                                                        </button>
                                                        <button className="btn btn-outline btn-sm"
                                                            onClick={() => { setRejectId(null); setRejectNotes(''); }}
                                                            style={{ padding: '8px 16px', fontSize: '0.8rem', borderRadius: 8 }}>
                                                            Back
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                /* Action buttons */
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    {r.status === 'pending_manager' && <>
                                                        <button
                                                            className="btn btn-success btn-sm"
                                                            onClick={() => { setApproveId(r.id); setRejectId(null); setApproveData({ approved_quantity: '', manager_notes: '' }); }}
                                                            style={{ padding: '8px 20px', fontSize: '0.8rem', fontWeight: 700, borderRadius: 8 }}
                                                        >
                                                            ✓ Approve
                                                        </button>
                                                        <button
                                                            className="btn btn-danger btn-sm"
                                                            onClick={() => { setRejectId(r.id); setApproveId(null); setRejectNotes(''); }}
                                                            style={{ padding: '8px 20px', fontSize: '0.8rem', fontWeight: 700, borderRadius: 8 }}
                                                        >
                                                            ✕ Reject
                                                        </button>
                                                    </>}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        {restockRequests.length === 0 && (
                            <div className="empty-state" style={{ padding: 40, textAlign: 'center' }}>
                                <p style={{ color: 'var(--text-muted)' }}>No restock requests found</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ===== PRODUCTS TAB ===== */}
                {activeTab === 'products' && (() => {
                    return (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                                <div>
                                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Store Products</h1>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{mgrProducts.length} product{mgrProducts.length !== 1 ? 's' : ''}</p>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button onClick={() => setShowCreateProduct(true)} style={{
                                        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10,
                                        border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.1)', color: '#10b981',
                                        cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', fontFamily: 'Inter, sans-serif',
                                    }}>+ Add Product</button>
                                    <input type="text" placeholder="Search products..."
                                        value={mgrProductSearch} onChange={e => setMgrProductSearch(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && loadMgrProducts(mgrProductSearch)}
                                        style={{ width: 220, padding: '10px 14px', borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif' }}
                                    />
                                    <button className="btn btn-primary btn-sm" onClick={() => loadMgrProducts(mgrProductSearch)}>Search</button>
                                </div>
                            </div>

                            {mgrProducts.length === 0 ? (
                                <div className="empty-state" style={{ padding: 40 }}><p style={{ color: 'var(--text-muted)' }}>No products found</p></div>
                            ) : (
                                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Image</th>
                                                <th>Title</th>
                                                <th>Price</th>
                                                <th>Stock</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {mgrProducts.map((p) => (
                                                <tr key={p.id} onClick={() => { setRestockPopupProduct(p); setRestockDirectQty(''); setRestockDirectNotes(''); }}
                                                    style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.06)'}
                                                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                                                    <td>
                                                        {p.images && p.images[0] ? (
                                                            <img
                                                                src={p.images[0]}
                                                                alt={p.title}
                                                                style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }}
                                                                onError={e => { e.target.style.display = 'none'; }}
                                                            />
                                                        ) : (
                                                            <div style={{
                                                                width: 48, height: 48, background: 'var(--bg-secondary)', borderRadius: 6,
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                fontSize: '0.7rem', color: 'var(--text-muted)',
                                                            }}>N/A</div>
                                                        )}
                                                    </td>
                                                    <td style={{ fontWeight: 500 }}>{p.title}</td>
                                                    <td style={{ color: 'var(--accent-secondary)' }}>₱{parseFloat(p.price).toFixed(2)}</td>
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
                                                    <td>
                                                        <span style={{
                                                            fontSize: '0.7rem', fontWeight: 600, padding: '4px 8px', borderRadius: 6,
                                                            background: p.status === 'approved' ? 'rgba(16,185,129,0.12)' : (p.status === 'unapproved' || p.status === 'rejected') ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                                                            color: p.status === 'approved' ? '#10b981' : (p.status === 'unapproved' || p.status === 'rejected') ? '#ef4444' : '#f59e0b',
                                                            textTransform: 'capitalize'
                                                        }}>
                                                            {p.status || 'Pending'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Direct Restock Modal */}
                            {restockPopupProduct && (
                                <div style={{
                                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                                    zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }} onClick={() => setRestockPopupProduct(null)}>
                                    <div style={{
                                        background: 'var(--bg-primary)', borderRadius: 20, padding: 32,
                                        width: 420, maxWidth: '90vw', border: '1px solid var(--border-color)',
                                        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                                    }} onClick={e => e.stopPropagation()}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                                            {restockPopupProduct.images?.[0] && (
                                                <img src={restockPopupProduct.images[0]} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 10 }} />
                                            )}
                                            <div>
                                                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: 2 }}>Restock Order</h2>
                                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{restockPopupProduct.title}</p>
                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Current stock: <strong style={{ color: (restockPopupProduct.stock || 0) === 0 ? '#ef4444' : (restockPopupProduct.stock || 0) <= 5 ? '#f59e0b' : '#10b981' }}>{restockPopupProduct.stock || 0}</strong></p>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Quantity to Restock *</label>
                                                <input type="number" min="1" placeholder="Enter quantity"
                                                    value={restockDirectQty}
                                                    onChange={e => setRestockDirectQty(e.target.value)}
                                                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', boxSizing: 'border-box' }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Notes (optional)</label>
                                                <textarea placeholder="Add notes for the delivery team..." rows={2}
                                                    value={restockDirectNotes}
                                                    onChange={e => setRestockDirectNotes(e.target.value)}
                                                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', resize: 'vertical', boxSizing: 'border-box' }}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                                                <button onClick={handleRestockDirect} disabled={restockDirectLoading}
                                                    style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', background: 'var(--accent-primary)', color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: restockDirectLoading ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}>
                                                    {restockDirectLoading ? 'Sending...' : 'Send to Delivery'}
                                                </button>
                                                <button onClick={() => setRestockPopupProduct(null)}
                                                    style={{ padding: '12px 20px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Create Product Modal */}
                            {showCreateProduct && (
                                <div style={{
                                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                                    zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }} onClick={() => setShowCreateProduct(false)}>
                                    <div style={{
                                        background: 'var(--bg-primary)', borderRadius: 20, padding: 32,
                                        width: 500, maxWidth: '90vw', border: '1px solid var(--border-color)',
                                        boxShadow: '0 20px 60px rgba(0,0,0,0.4)', maxHeight: '90vh', overflowY: 'auto',
                                    }} onClick={e => e.stopPropagation()}>
                                        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 20 }}>Add Product</h2>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Product Name *</label>
                                                <input type="text" placeholder="Enter product name"
                                                    value={productForm.title} onChange={e => setProductForm({ ...productForm, title: e.target.value })}
                                                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem' }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Description</label>
                                                <textarea placeholder="Enter description (optional)" rows={3}
                                                    value={productForm.description} onChange={e => setProductForm({ ...productForm, description: e.target.value })}
                                                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', resize: 'vertical' }}
                                                />
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                                <div>
                                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Price (PHP) *</label>
                                                    <input type="number" placeholder="0.00" step="0.01" min="0"
                                                        value={productForm.price} onChange={e => setProductForm({ ...productForm, price: e.target.value })}
                                                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem' }}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Stock *</label>
                                                    <input type="number" placeholder="0" min="1"
                                                        value={productForm.stock} onChange={e => setProductForm({ ...productForm, stock: e.target.value })}
                                                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem' }}
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Images * (max 5)</label>
                                                <input type="file" accept="image/*" multiple onChange={handleImageUpload} disabled={productUploading || productImages.length >= 5}
                                                    style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}
                                                />
                                                {productUploading && <p style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', marginTop: 4 }}>Uploading...</p>}
                                                {productImages.length > 0 && (
                                                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                                                        {productImages.map((url, i) => (
                                                            <div key={i} style={{ position: 'relative', width: 64, height: 64 }}>
                                                                <img src={url} alt="" style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border-color)' }} />
                                                                <button onClick={() => setProductImages(prev => prev.filter((_, idx) => idx !== i))}
                                                                    style={{
                                                                        position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%',
                                                                        background: '#ef4444', color: 'white', border: 'none', cursor: 'pointer',
                                                                        fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    }}>x</button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                                            <button className="btn btn-primary" onClick={handleCreateProduct} disabled={productCreating}
                                                style={{ flex: 1, padding: '12px 0', fontSize: '0.9rem', fontWeight: 700, borderRadius: 10 }}>
                                                {productCreating ? 'Creating...' : 'Create Product'}
                                            </button>
                                            <button className="btn btn-outline" onClick={() => setShowCreateProduct(false)}
                                                style={{ flex: 1, padding: '12px 0', fontSize: '0.9rem', fontWeight: 700, borderRadius: 10 }}>
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}

                {/* ===== TRANSACTIONS TAB ===== */}
                {/* === WISHLIST ANALYTICS === */}
                {activeTab === 'wishlist' && (
                    <div>
                        <div style={{ marginBottom: 24 }}>
                            <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>❤️ Wishlist Analytics</h1>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Store-wide wishlist insights — shared across all staff in your department</p>
                        </div>

                        {wishlistLoading ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
                                <div className="spinner" style={{ width: 40, height: 40 }} />
                            </div>
                        ) : (
                            <>
                                {/* Metric Cards */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
                                    <StatCard icon={<Heart size={16} />} label="Total Wishlists" value={wishlistReport?.total_wishlists ?? 0} color="#ef4444" />
                                    <StatCard icon={<Users size={16} />} label="Unique Buyers" value={wishlistReport?.unique_buyers ?? 0} color="#8b5cf6" />
                                    <StatCard icon={<Package size={16} />} label="Total Products" value={wishlistReport?.total_products ?? 0} color="#6366f1" />
                                    <StatCard icon={<BarChart3 size={16} />} label="Wishlists / Product" value={wishlistReport?.wishlist_per_product?.toFixed(2) ?? '0.00'} color="#f59e0b" />
                                </div>

                                {/* Wishlist by Product */}
                                <div className="card">
                                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 16 }}>Wishlist by Product</h3>
                                    {(!wishlistReport?.products || wishlistReport.products.length === 0) ? (
                                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>No wishlist data yet</p>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            {wishlistReport.products.map((prod, i) => {
                                                const maxCount = wishlistReport.products[0]?.wishlist_count || 1;
                                                return (
                                                    <div key={prod.product_id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                        <span style={{
                                                            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            fontSize: '0.8rem', fontWeight: 700,
                                                            background: i === 0 ? '#ef4444' : i === 1 ? '#f59e0b' : i === 2 ? '#6366f1' : 'var(--border-color)',
                                                            color: i < 3 ? '#fff' : 'var(--text-secondary)',
                                                        }}>{i + 1}</span>

                                                        <div style={{
                                                            width: 36, height: 36, borderRadius: 8, overflow: 'hidden', flexShrink: 0,
                                                            border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
                                                        }}>
                                                            {prod.image_url ? (
                                                                <img src={prod.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            ) : (
                                                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.7rem' }}><Package size={16} /></div>
                                                            )}
                                                        </div>

                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <p style={{ fontWeight: 600, marginBottom: 4, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, minWidth: 60, flexShrink: 0 }}>
                                                            <span style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 3 }}>
                                                                ❤️ {prod.wishlist_count}
                                                            </span>
                                                            {(() => {
                                                                const s = prod.stock ?? 0;
                                                                const isOut = s === 0;
                                                                const isLow = s > 0 && s <= 5;
                                                                return (
                                                                    <span style={{
                                                                        fontSize: '0.68rem', fontWeight: 600, padding: '2px 7px', borderRadius: 10,
                                                                        background: isOut ? 'rgba(239,68,68,0.1)' : isLow ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
                                                                        color: isOut ? '#ef4444' : isLow ? '#f59e0b' : '#10b981',
                                                                    }}>
                                                                        <Package size={16} /> {s} {isOut ? 'out' : isLow ? 'low' : 'in stock'}
                                                                    </span>
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

                {activeTab === 'transactions' && (() => {
                    const statusClr = {
                        ondeliver: '#3b82f6', delivered: '#10b981', completed: '#10b981',
                        undelivered: '#ef4444', cancelled: '#ef4444',
                        pending: '#f59e0b', approved: '#10b981',
                    };
                    const allStatuses = [...new Set(mgrTransactions.map(t => t.status))].sort();
                    const restockStatusClr = {
                        pending_manager: '#f59e0b', approved_manager: '#3b82f6',
                        rejected_manager: '#ef4444', cancelled: '#94a3b8',
                        accepted_delivery: '#8b5cf6', in_transit: '#06b6d4',
                        delivered: '#10b981',
                    };
                    const restockStatusLabel = {
                        pending_manager: 'Pending Manager', approved_manager: 'Admin Request',
                        rejected_manager: 'Rejected', cancelled: 'Cancelled',
                        accepted_delivery: 'Accepted Delivery', in_transit: 'In Transit',
                        delivered: 'Delivered',
                    };
                    const allRestockStatuses = [...new Set(restockHistory.map(r => r.status))].sort();

                    const filteredTxns = mgrTransactions.filter(t => {
                        if (mgrTxnStatusFilter !== 'all' && t.status !== mgrTxnStatusFilter) return false;
                        if (mgrTxnDateFrom) {
                            const d = new Date(t.created_at); d.setHours(0,0,0,0);
                            if (d < new Date(mgrTxnDateFrom)) return false;
                        }
                        if (mgrTxnDateTo) {
                            const d = new Date(t.created_at); d.setHours(0,0,0,0);
                            if (d > new Date(mgrTxnDateTo)) return false;
                        }
                        return true;
                    });

                    const filteredRestock = restockHistory.filter(r => {
                        if (restockHistoryStatusFilter !== 'all' && r.status !== restockHistoryStatusFilter) return false;
                        if (restockHistoryDateFrom) {
                            const d = new Date(r.created_at); d.setHours(0,0,0,0);
                            if (d < new Date(restockHistoryDateFrom)) return false;
                        }
                        if (restockHistoryDateTo) {
                            const d = new Date(r.created_at); d.setHours(0,0,0,0);
                            if (d > new Date(restockHistoryDateTo)) return false;
                        }
                        return true;
                    });

                    const filterLabelStyle = {
                        fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap',
                    };
                    const filterSelectStyle = {
                        padding: '8px 12px', borderRadius: 8,
                        background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontSize: '0.82rem',
                    };
                    const filterInputStyle = {
                        padding: '8px 10px', borderRadius: 8,
                        background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontSize: '0.82rem',
                    };

                    return (
                        <div>
                            <div style={{ marginBottom: 24 }}>
                                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 4 }}>History</h1>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Store-wide purchase and restock history</p>
                            </div>

                            {/* Sub-tab buttons */}
                            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                                {[
                                    { key: 'orders', label: 'Order History' },
                                    { key: 'restock', label: 'Restock History' },
                                ].map(sub => (
                                    <button key={sub.key} onClick={() => setTxnSubTab(sub.key)} style={{
                                        padding: '9px 20px', borderRadius: 10, cursor: 'pointer', fontWeight: 700,
                                        fontSize: '0.85rem', fontFamily: 'Inter, sans-serif', transition: 'all 0.2s',
                                        border: txnSubTab === sub.key ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                                        background: txnSubTab === sub.key ? 'rgba(99,102,241,0.15)' : 'transparent',
                                        color: txnSubTab === sub.key ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                    }}>{sub.label}</button>
                                ))}
                            </div>

                            {/* ORDER HISTORY sub-tab */}
                            {txnSubTab === 'orders' && (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                                        <select value={mgrTxnStatusFilter} onChange={e => setMgrTxnStatusFilter(e.target.value)} style={filterSelectStyle}>
                                            <option value="all">All Statuses</option>
                                            {allStatuses.map(s => (
                                                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                                            ))}
                                        </select>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span style={filterLabelStyle}>From</span>
                                            <input type="date" value={mgrTxnDateFrom} onChange={e => setMgrTxnDateFrom(e.target.value)} style={filterInputStyle} />
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span style={filterLabelStyle}>To</span>
                                            <input type="date" value={mgrTxnDateTo} onChange={e => setMgrTxnDateTo(e.target.value)} style={filterInputStyle} />
                                        </div>
                                        {(mgrTxnStatusFilter !== 'all' || mgrTxnDateFrom || mgrTxnDateTo) && (
                                            <button onClick={() => { setMgrTxnStatusFilter('all'); setMgrTxnDateFrom(''); setMgrTxnDateTo(''); }} style={{
                                                padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border-color)',
                                                background: 'transparent', color: 'var(--text-secondary)',
                                                fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                                                fontFamily: 'Inter, sans-serif',
                                            }}>Clear</button>
                                        )}
                                    </div>
                                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>Buyer</th><th>Staff</th><th>Product</th><th>Qty</th><th>Amount</th><th>Status</th><th>Date</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredTxns.map(t => (
                                                    <tr key={t.id}>
                                                        <td style={{ fontWeight: 500 }}>{t.buyer_name}</td>
                                                        <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t.assigned_staff_name || 'Unassigned'}</td>
                                                        <td style={{ color: 'var(--text-secondary)' }}>{t.product_title}</td>
                                                        <td>{t.quantity}</td>
                                                        <td style={{ fontWeight: 600 }}>₱{t.amount.toFixed(2)}</td>
                                                        <td>
                                                            <span style={{
                                                                padding: '3px 8px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600,
                                                                background: `${statusClr[t.status] || '#94a3b8'}15`,
                                                                color: statusClr[t.status] || '#94a3b8',
                                                            }}>{t.status.replace(/_/g, ' ')}</span>
                                                        </td>
                                                        <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                                            {new Date(t.created_at).toLocaleDateString()}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {filteredTxns.length === 0 && <div className="empty-state" style={{ padding: 40 }}><p>No transactions found</p></div>}
                                    </div>
                                </>
                            )}

                            {/* RESTOCK HISTORY sub-tab */}
                            {txnSubTab === 'restock' && (
                                restockHistoryLoading ? (
                                    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
                                        <div className="spinner" style={{ width: 36, height: 36 }} />
                                    </div>
                                ) : (
                                    <>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                                            <select value={restockHistoryStatusFilter} onChange={e => setRestockHistoryStatusFilter(e.target.value)} style={filterSelectStyle}>
                                                <option value="all">All Statuses</option>
                                                {allRestockStatuses.map(s => (
                                                    <option key={s} value={s}>{restockStatusLabel[s] || s.replace(/_/g, ' ')}</option>
                                                ))}
                                            </select>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span style={filterLabelStyle}>From</span>
                                                <input type="date" value={restockHistoryDateFrom} onChange={e => setRestockHistoryDateFrom(e.target.value)} style={filterInputStyle} />
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span style={filterLabelStyle}>To</span>
                                                <input type="date" value={restockHistoryDateTo} onChange={e => setRestockHistoryDateTo(e.target.value)} style={filterInputStyle} />
                                            </div>
                                            {(restockHistoryStatusFilter !== 'all' || restockHistoryDateFrom || restockHistoryDateTo) && (
                                                <button onClick={() => { setRestockHistoryStatusFilter('all'); setRestockHistoryDateFrom(''); setRestockHistoryDateTo(''); }} style={{
                                                    padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border-color)',
                                                    background: 'transparent', color: 'var(--text-secondary)',
                                                    fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                                                    fontFamily: 'Inter, sans-serif',
                                                }}>Clear</button>
                                            )}
                                        </div>
                                        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                            <table className="data-table">
                                                <thead>
                                                    <tr>
                                                        <th>Product</th><th>Requested By</th><th>Qty Requested</th><th>Qty Approved</th><th>Status</th><th>Notes</th><th>Date</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredRestock.map(r => (
                                                        <tr key={r.id}>
                                                            <td>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                    {r.product_images?.[0] && (
                                                                        <img src={r.product_images[0]} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} onError={e => e.target.style.display = 'none'} />
                                                                    )}
                                                                    <span style={{ fontWeight: 500 }}>{r.product_title || 'Unknown'}</span>
                                                                </div>
                                                            </td>
                                                            <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{r.staff_name || 'Manager'}</td>
                                                            <td style={{ fontWeight: 600 }}>{r.requested_quantity}</td>
                                                            <td style={{ color: '#10b981', fontWeight: 600 }}>{r.approved_quantity ?? '—'}</td>
                                                            <td>
                                                                <span style={{
                                                                    padding: '3px 8px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600,
                                                                    background: `${restockStatusClr[r.status] || '#94a3b8'}15`,
                                                                    color: restockStatusClr[r.status] || '#94a3b8',
                                                                }}>{restockStatusLabel[r.status] || r.status.replace(/_/g, ' ')}</span>
                                                            </td>
                                                            <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem', maxWidth: 160 }}>
                                                                {r.notes || r.manager_notes || '—'}
                                                            </td>
                                                            <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                                                {new Date(r.created_at).toLocaleDateString()}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            {filteredRestock.length === 0 && <div className="empty-state" style={{ padding: 40 }}><p>No restock history found</p></div>}
                                        </div>
                                    </>
                                )
                            )}
                        </div>
                    );
                })()}
            </main>

            {/* ===== STAFF DETAIL SLIDE PANEL ===== */}
            {selectedStaffId && (
                <>
                    <div style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                        zIndex: 300, transition: 'opacity 0.3s',
                    }} onClick={closeStaffPanel} />
                    <aside style={{
                        position: 'fixed', top: 0, right: 0, bottom: 0,
                        width: 520, maxWidth: '90vw', background: 'var(--bg-primary)',
                        borderLeft: '1px solid var(--border-color)',
                        zIndex: 301, overflowY: 'auto', padding: 32,
                        boxShadow: '-8px 0 30px rgba(0,0,0,0.3)',
                        animation: 'slideInRight 0.25s ease-out',
                    }}>
                        {staffDetailLoading ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                <div className="spinner" style={{ width: 40, height: 40 }} />
                            </div>
                        ) : staffDetail ? (
                            <>
                                {/* Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                                    <div>
                                        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 4 }}>
                                            {staffDetail.user.full_name}
                                        </h2>
                                        <span style={{
                                            padding: '3px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600,
                                            textTransform: 'capitalize',
                                            background: 'rgba(108,99,255,0.1)', color: '#6366f1',
                                        }}>{staffDetail.user.role}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <button
                                            onClick={() => handleRemoveStaff(staffDetail.user.id, staffDetail.user.full_name)}
                                            disabled={removeStaffLoading}
                                            style={{
                                                padding: '8px 16px', borderRadius: 10,
                                                border: '1px solid rgba(239,68,68,0.3)',
                                                background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                                                cursor: removeStaffLoading ? 'not-allowed' : 'pointer',
                                                fontWeight: 700, fontSize: '0.8rem',
                                                fontFamily: 'Inter, sans-serif', transition: 'all 0.2s',
                                                opacity: removeStaffLoading ? 0.5 : 1,
                                                display: 'flex', alignItems: 'center', gap: 6,
                                            }}
                                            onMouseEnter={e => { if (!removeStaffLoading) e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; }}
                                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                                        >
                                            <Trash2 size={16} /> {removeStaffLoading ? 'Removing...' : 'Remove Staff'}
                                        </button>
                                        <button onClick={closeStaffPanel} style={{
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            color: 'var(--text-muted)', fontSize: '1.3rem',
                                        }}>✕</button>
                                    </div>
                                </div>

                                {/* Staff Details */}
                                <div style={{
                                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24,
                                    padding: 16, borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                                }}>
                                    <div>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: 4 }}>Email</p>
                                        <p style={{ fontSize: '0.85rem', fontWeight: 500 }}>{staffDetail.user.email}</p>
                                    </div>
                                    <div>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: 4 }}>Contact</p>
                                        <p style={{ fontSize: '0.85rem', fontWeight: 500 }}>{staffDetail.user.contact_number || '—'}</p>
                                    </div>
                                    <div>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: 4 }}>Joined</p>
                                        <p style={{ fontSize: '0.85rem', fontWeight: 500 }}>{new Date(staffDetail.user.created_at).toLocaleDateString()}</p>
                                    </div>
                                    <div>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: 4 }}>Status</p>
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 6,
                                            padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
                                            background: staffDetail.user.is_banned ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                                            color: staffDetail.user.is_banned ? '#ef4444' : '#10b981',
                                        }}>
                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: staffDetail.user.is_banned ? '#ef4444' : '#10b981' }} />
                                            {staffDetail.user.is_banned ? 'Banned' : 'Active'}
                                        </span>
                                    </div>

                                </div>

                                {/* Change Password */}
                                <div style={{ marginBottom: 24, padding: 16, borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: 10, fontWeight: 600 }}>Change Password</p>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <input
                                            type="password"
                                            placeholder="New password (min 6 chars)"
                                            value={staffNewPassword}
                                            onChange={e => setStaffNewPassword(e.target.value)}
                                            style={{ flex: 1, padding: '9px 12px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem' }}
                                        />
                                        <button
                                            onClick={() => handleChangeStaffPassword(staffDetail.user.id)}
                                            disabled={staffPwLoading}
                                            style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: 'var(--accent-primary)', color: '#fff', fontWeight: 700, fontSize: '0.8rem', cursor: staffPwLoading ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', opacity: staffPwLoading ? 0.6 : 1, whiteSpace: 'nowrap' }}
                                        >
                                            {staffPwLoading ? '...' : 'Update'}
                                        </button>
                                    </div>
                                </div>

                                {/* Report Stats */}
                                <div style={{ textAlign: 'center' }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12 }}><BarChart3 size={16} /> Reports</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                                        <div style={{
                                            padding: 16, borderRadius: 12, background: 'var(--bg-secondary)',
                                            border: '1px solid var(--border-color)', textAlign: 'center',
                                        }}>
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: 6 }}>Total Tasks Completed</p>
                                            <p style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>{staffDetail.report?.total_completed_tasks || 0}</p>
                                        </div>
                                        <div style={{
                                            padding: 16, borderRadius: 12, background: 'var(--bg-secondary)',
                                            border: '1px solid var(--border-color)', textAlign: 'center',
                                        }}>
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: 6 }}>Total Items Processed</p>
                                            <p style={{ fontSize: '1.4rem', fontWeight: 800, color: '#6366f1' }}>{staffDetail.report?.total_items_processed || 0}</p>
                                        </div>
                                    </div>
                                </div>
                                {/* Delivery Items Chart */}
                                <div style={{
                                    padding: 16, borderRadius: 12, background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-color)', marginBottom: 24,
                                }}>
                                    <DualLineChart
                                        data={[...(staffDetail.report?.daily || [])].reverse().slice(0, 14)}
                                        labelKey="date"
                                        valueKey1="delivery_items" color1="#3b82f6" label1="Delivery"
                                        valueKey2="delivery_items" color2="#3b82f6" label2=""
                                        title="Items Processed (Delivery)"
                                        height={200}
                                    />
                                </div>

                                {/* Staff Products */}
                                {staffDetail.products && staffDetail.products.length > 0 && (
                                    <>
                                        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12 }}><Package size={16} /> Products ({staffDetail.products.length})</h3>
                                        <div style={{
                                            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 24,
                                        }}>
                                            {staffDetail.products.map(p => (
                                                <div key={p.id} style={{
                                                    padding: 10, borderRadius: 10,
                                                    background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                                                    display: 'flex', gap: 10, alignItems: 'center',
                                                }}>
                                                    <div style={{
                                                        width: 48, height: 48, borderRadius: 8, overflow: 'hidden',
                                                        background: 'rgba(0,0,0,0.2)', flexShrink: 0,
                                                    }}>
                                                        {p.image_url ? (
                                                            <img src={p.image_url} alt={p.title}
                                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                                onError={e => e.target.style.display = 'none'} />
                                                        ) : (
                                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.6rem' }}>N/A</div>
                                                        )}
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <p style={{
                                                            fontWeight: 600, fontSize: '0.78rem', marginBottom: 3,
                                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                        }}>{p.title}</p>
                                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-secondary)' }}>₱{(p.price || 0).toFixed(2)}</span>
                                                            <span style={{
                                                                fontSize: '0.6rem', padding: '1px 6px', borderRadius: 4,
                                                                background: p.stock > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                                                color: p.stock > 0 ? '#10b981' : '#ef4444', fontWeight: 600,
                                                            }}>{p.stock > 0 ? `${p.stock} stock` : 'No stock'}</span>
                                                            {!p.is_active && <span style={{ fontSize: '0.6rem', padding: '1px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: 600 }}>Inactive</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}

                                {/* Recent Products Handled */}
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12 }}><ShoppingCart size={16} /> Recent Products Handled</h3>
                                {!staffDetail.recent_products_handled || staffDetail.recent_products_handled.length === 0 ? (
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: 20 }}>No products handled yet</p>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                        {staffDetail.recent_products_handled.map(p => (
                                            <div key={p.product_id} style={{
                                                padding: 10, borderRadius: 10,
                                                background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                                                display: 'flex', gap: 10, alignItems: 'center',
                                            }}>
                                                <div style={{
                                                    width: 48, height: 48, borderRadius: 8, overflow: 'hidden',
                                                    background: 'rgba(0,0,0,0.2)', flexShrink: 0,
                                                }}>
                                                    {p.product_image ? (
                                                        <img src={p.product_image} alt={p.product_title}
                                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                            onError={e => e.target.style.display = 'none'} />
                                                    ) : (
                                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.6rem' }}>N/A</div>
                                                    )}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <p style={{
                                                        fontWeight: 600, fontSize: '0.78rem', marginBottom: 3,
                                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                    }}>{p.product_title}</p>
                                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                                        <span style={{
                                                            fontSize: '0.65rem', padding: '1px 6px', borderRadius: 4,
                                                            background: 'rgba(99,102,241,0.1)', color: '#6366f1', fontWeight: 600,
                                                        }}>{p.quantity_processed} processed</span>
                                                        <span style={{
                                                            fontSize: '0.65rem', padding: '1px 6px', borderRadius: 4,
                                                            background: 'rgba(59,130,246,0.1)',
                                                            color: '#3b82f6', fontWeight: 600,
                                                        }}>Delivery</span>
                                                    </div>
                                                    <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                                        Last: {new Date(p.last_handled).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                            <p style={{ color: 'var(--text-muted)' }}>Failed to load staff details</p>
                        )}
                    </aside>

                    {/* Slide animation */}
                    <style>{`
                        @keyframes slideInRight {
                            from { transform: translateX(100%); }
                            to { transform: translateX(0); }
                        }
                    `}</style>
                </>
            )}

            {/* Delivery Order Detail Modal */}
            {selectedMgrOrder && (
                <div
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 600, padding: 20 }}
                    onClick={() => setSelectedMgrOrder(null)}
                >
                    <div style={{ background: 'var(--bg-primary)', borderRadius: 20, padding: 28, maxWidth: 540, width: '100%', maxHeight: '85vh', overflowY: 'auto', border: '1px solid var(--border-color)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                            <div>
                                <div style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: 4 }}>📦 Delivery Box</div>
                                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Buyer: <strong>{selectedMgrOrder.buyer_name}</strong></div>
                                {selectedMgrOrder.assigned_staff_name && (
                                    <div style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 600, marginTop: 2 }}>Approved by: {selectedMgrOrder.assigned_staff_name}</div>
                                )}
                                {selectedMgrOrder.delivery_address && (
                                    <div style={{ fontSize: '0.82rem', color: 'var(--accent-primary)', fontWeight: 600, marginTop: 2 }}>📍 {selectedMgrOrder.delivery_address}</div>
                                )}
                                {selectedMgrOrder.created_at && (
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>{new Date(selectedMgrOrder.created_at).toLocaleString()}</div>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                                {(() => {
                                    const deliveryColors = {
                                        pending: { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', label: 'Pending' },
                                        approved: { bg: 'rgba(16,185,129,0.15)', color: '#10b981', label: 'Ready for Pickup' },
                                        ondeliver: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6', label: 'On Delivery' },
                                        delivered: { bg: 'rgba(0,212,170,0.15)', color: '#00d4aa', label: 'Delivered' },
                                        undelivered: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', label: 'Undelivered' },
                                        cancelled: { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8', label: 'Cancelled' },
                                    };
                                    const sc = deliveryColors[selectedMgrOrder.status] || { bg: 'var(--bg-secondary)', color: 'var(--text-muted)', label: selectedMgrOrder.status };
                                    return <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, background: sc.bg, color: sc.color }}>{sc.label}</span>;
                                })()}
                                <button onClick={() => setSelectedMgrOrder(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.3rem', lineHeight: 1, padding: 4 }}>✕</button>
                            </div>
                        </div>
                        {/* Items with full images */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                            {(selectedMgrOrder.items || []).map((item, idx) => {
                                const img = item.product_images?.[0] || null;
                                return (
                                    <div key={item.id || idx} style={{ display: 'flex', gap: 14, alignItems: 'center', background: 'var(--bg-secondary)', borderRadius: 12, padding: 12 }}>
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
                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 6, marginBottom: selectedMgrOrder.status === 'pending' ? 16 : 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                                <span>Products Total</span><span>PHP {selectedMgrOrder.total_amount?.toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                                <span>Delivery Fee</span><span>PHP {selectedMgrOrder.delivery_fee?.toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 800, marginTop: 4 }}>
                                <span>Grand Total</span><span style={{ color: 'var(--accent-secondary)' }}>PHP {((selectedMgrOrder.total_amount || 0) + (selectedMgrOrder.delivery_fee || 0)).toFixed(2)}</span>
                            </div>
                        </div>
                        {/* Approve action if pending */}
                        {selectedMgrOrder.status === 'pending' && (
                            <button
                                className="btn btn-primary"
                                disabled={deliveryOrderLoading}
                                onClick={() => { handleMgrDeliveryStatusUpdate(selectedMgrOrder.group_id); setSelectedMgrOrder(null); }}
                                style={{ width: '100%', fontWeight: 700, marginTop: 4 }}
                            >
                                {deliveryOrderLoading ? '...' : '✓ Approve Box'}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
