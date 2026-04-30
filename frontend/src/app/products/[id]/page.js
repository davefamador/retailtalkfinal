'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getProduct, buyProduct, getStoredUser, getMyContact, setMyContact, checkWishlist, addToWishlist, removeFromWishlist, removeFromCart, uploadProductImage, adminUpdateProduct, managerUpdateProduct } from '../../../lib/api';
import Toast from '../../components/Toast';

export default function ProductDetailPage() {
    const params = useParams();
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [quantity, setQuantity] = useState(1);
    const [buying, setBuying] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [selectedImage, setSelectedImage] = useState(0);
    const [contactNum, setContactNum] = useState('');
    const [deliveryAddr, setDeliveryAddr] = useState('');
    const [wishlisted, setWishlisted] = useState(false);
    const [wishlistLoading, setWishlistLoading] = useState(false);
    const [imageEditMode, setImageEditMode] = useState(false);
    const [imageUploading, setImageUploading] = useState(false);

    useEffect(() => {
        const stored = getStoredUser();
        setUser(stored);
        loadProduct();
        if (stored && stored.role === 'buyer') {
            checkWishlist(params.id).then(r => setWishlisted(r.in_wishlist)).catch(() => {});
            getMyContact().then(c => {
                setContactNum(c.contact_number || '');
                setDeliveryAddr(c.delivery_address || '');
            }).catch(() => {});
        }
    }, []);

    const loadProduct = async () => {
        try {
            const data = await getProduct(params.id);
            setProduct(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleWishlistToggle = async () => {
        if (!user) { window.location.href = '/login'; return; }
        if (user.role !== 'buyer') return;
        setWishlistLoading(true);
        try {
            if (wishlisted) {
                await removeFromWishlist(params.id);
                setWishlisted(false);
            } else {
                await addToWishlist(params.id);
                setWishlisted(true);
            }
        } catch (err) {
            console.error('Wishlist toggle failed:', err);
        } finally {
            setWishlistLoading(false);
        }
    };

    const handleBuy = async () => {
        if (!user) { window.location.href = '/login'; return; }
        if (user.role !== 'buyer') { setError('Only buyer accounts can purchase products.'); return; }
        if (!contactNum.trim()) { setError('Contact number is required.'); return; }
        if (!deliveryAddr.trim()) { setError('Delivery address is required.'); return; }
        setBuying(true);
        setError('');
        setSuccess('');
        try {
            await setMyContact(contactNum.trim(), deliveryAddr.trim());
            await buyProduct(product.id, quantity);
            setSuccess(`Successfully purchased ${quantity}x ${product.title}!`);
            window.dispatchEvent(new Event('balance-updated'));
            removeFromCart(product.id).catch(() => {});
            const updated = await getProduct(params.id);
            setProduct(updated);
            setQuantity(1);
        } catch (err) {
            setError(err.message || 'Failed to complete purchase.');
        } finally {
            setBuying(false);
        }
    };

    const canEditImages = user && (user.role === 'admin' || user.role === 'manager');

    const handleAddImage = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if ((product.images || []).length >= 5) { setError('Maximum 5 images allowed.'); return; }
        setImageUploading(true);
        try {
            const { url } = await uploadProductImage(file);
            const newImages = [...(product.images || []), url];
            if (user.role === 'admin') {
                await adminUpdateProduct(product.id, { images: newImages });
            } else {
                await managerUpdateProduct(product.id, { images: newImages });
            }
            const updated = await getProduct(params.id);
            setProduct(updated);
            setSelectedImage(newImages.length - 1);
            setSuccess('Image added.');
        } catch (err) {
            setError(err.message || 'Failed to upload image.');
        } finally {
            setImageUploading(false);
            e.target.value = '';
        }
    };

    const handleRemoveImage = async (idx) => {
        const newImages = (product.images || []).filter((_, i) => i !== idx);
        setImageUploading(true);
        try {
            if (user.role === 'admin') {
                await adminUpdateProduct(product.id, { images: newImages });
            } else {
                await managerUpdateProduct(product.id, { images: newImages });
            }
            const updated = await getProduct(params.id);
            setProduct(updated);
            setSelectedImage(Math.max(0, idx - 1));
            setSuccess('Image removed.');
        } catch (err) {
            setError(err.message || 'Failed to remove image.');
        } finally {
            setImageUploading(false);
        }
    };

    if (loading) {
        return (
            <div className="page">
                <div className="loading-container">
                    <div className="spinner" style={{ width: 40, height: 40 }}></div>
                    <p>Loading product...</p>
                </div>
            </div>
        );
    }

    if (!product) {
        return (
            <div className="page">
                <div className="empty-state">
                    <h3>Product Not Found</h3>
                    <p>{error || 'This product may have been removed.'}</p>
                    <a href="/products" className="btn btn-primary" style={{ marginTop: 16 }}>Back to Browse</a>
                </div>
            </div>
        );
    }

    const images = product.images || [];
    const productTotal = parseFloat(product.price) * quantity;
    const deliveryFee = 40;
    const grandTotal = (productTotal + deliveryFee).toFixed(2);
    const totalPrice = productTotal.toFixed(2);
    const inStock = (product.stock || 0) > 0;

    return (
        <div className="page" style={{ maxWidth: 1000 }}>
            <a href="/products" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 24 }}>
                ← Back to Browse
            </a>

            {/* ===== TOAST NOTIFICATION ===== */}
            <Toast 
                message={error ? { type: 'error', text: error } : success ? { type: 'success', text: success } : null} 
                onClose={() => { setError(''); setSuccess(''); }} 
            />

            <div style={{ display: 'grid', gridTemplateColumns: images.length > 0 ? '1fr 1fr' : '1fr', gap: 40 }}>
                {/* Left: Images */}
                {(images.length > 0 || canEditImages) && (
                    <div>
                        {/* Main Image */}
                        {images.length > 0 && (
                            <div style={{
                                width: '100%', aspectRatio: '1', borderRadius: 12, overflow: 'hidden',
                                background: 'var(--bg-card)', border: '1px solid var(--border-color)', marginBottom: 12,
                                position: 'relative',
                            }}>
                                <img
                                    src={images[selectedImage]}
                                    alt={product.title}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                                {canEditImages && imageEditMode && (
                                    <button
                                        onClick={() => handleRemoveImage(selectedImage)}
                                        disabled={imageUploading}
                                        style={{
                                            position: 'absolute', top: 10, right: 10,
                                            background: 'rgba(239,68,68,0.9)', color: '#fff',
                                            border: 'none', borderRadius: 8, padding: '6px 12px',
                                            fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                                        }}
                                    >
                                        {imageUploading ? '...' : '✕ Remove'}
                                    </button>
                                )}
                            </div>
                        )}
                        {/* Thumbnails */}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            {images.map((img, i) => (
                                <div
                                    key={i}
                                    onClick={() => setSelectedImage(i)}
                                    style={{
                                        width: 64, height: 64, borderRadius: 8, overflow: 'hidden',
                                        cursor: 'pointer', border: `2px solid ${i === selectedImage ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                                        transition: 'border-color 0.2s', flexShrink: 0,
                                    }}
                                >
                                    <img src={img} alt={`Thumb ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                            ))}
                            {canEditImages && imageEditMode && images.length < 5 && (
                                <label style={{
                                    width: 64, height: 64, borderRadius: 8, flexShrink: 0,
                                    border: '2px dashed var(--border-color)', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '1.4rem', color: 'var(--text-muted)',
                                    opacity: imageUploading ? 0.5 : 1,
                                }}>
                                    {imageUploading ? <span className="spinner" style={{ width: 20, height: 20 }} /> : '+'}
                                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAddImage} disabled={imageUploading} />
                                </label>
                            )}
                        </div>
                        {/* Edit toggle for admin/manager */}
                        {canEditImages && (
                            <button
                                onClick={() => setImageEditMode(m => !m)}
                                style={{
                                    marginTop: 12, padding: '7px 16px', borderRadius: 8,
                                    border: '1px solid var(--border-color)', cursor: 'pointer',
                                    background: imageEditMode ? 'rgba(99,102,241,0.15)' : 'transparent',
                                    color: imageEditMode ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                    fontSize: '0.82rem', fontWeight: 600,
                                    fontFamily: 'Inter, sans-serif',
                                }}
                            >
                                {imageEditMode ? '✓ Done Editing' : '✏️ Edit Images'}
                            </button>
                        )}
                    </div>
                )}

                {/* Right: Product Info */}
                <div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, flex: 1, margin: 0 }}>{product.title}</h1>
                        {user && user.role === 'buyer' && (
                            <button
                                onClick={handleWishlistToggle}
                                disabled={wishlistLoading}
                                title={wishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
                                style={{
                                    background: wishlisted ? 'rgba(239,68,68,0.15)' : 'var(--bg-secondary)',
                                    border: `1.5px solid ${wishlisted ? 'rgba(239,68,68,0.4)' : 'var(--border-color)'}`,
                                    borderRadius: 12, padding: '10px 12px', cursor: 'pointer',
                                    fontSize: '1.3rem', lineHeight: 1, transition: 'all 0.25s ease',
                                    flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transform: wishlisted ? 'scale(1.1)' : 'scale(1)',
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.transform = 'scale(1.2)';
                                    e.currentTarget.style.background = wishlisted ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.1)';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.transform = wishlisted ? 'scale(1.1)' : 'scale(1)';
                                    e.currentTarget.style.background = wishlisted ? 'rgba(239,68,68,0.15)' : 'var(--bg-secondary)';
                                }}
                            >
                                {wishlistLoading ? (
                                    <span className="spinner" style={{ width: 20, height: 20 }}></span>
                                ) : wishlisted ? '❤️' : '🤍'}
                            </button>
                        )}
                    </div>

                    {product.seller_name && (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 16 }}>
                            Sold by <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{product.seller_name}</span>
                        </p>
                    )}

                    <div style={{
                        fontSize: '2.2rem', fontWeight: 800, color: 'var(--accent-secondary)',
                        marginBottom: 20,
                    }}>
                        PHP {parseFloat(product.price).toFixed(2)}
                    </div>

                    {/* Stock Status */}
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '8px 16px', borderRadius: 20, marginBottom: 20,
                        background: inStock ? 'rgba(16,185,129,0.1)' : 'rgba(255,71,87,0.1)',
                        border: `1px solid ${inStock ? 'rgba(16,185,129,0.3)' : 'rgba(255,71,87,0.3)'}`,
                    }}>
                        <span style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: inStock ? 'var(--accent-success)' : 'var(--accent-danger)',
                        }}></span>
                        <span style={{
                            fontWeight: 600, fontSize: '0.85rem',
                            color: inStock ? 'var(--accent-success)' : 'var(--accent-danger)',
                        }}>
                            {inStock ? `${product.stock} in stock` : 'Out of stock'}
                        </span>
                    </div>

                    {/* Description */}
                    <div style={{
                        padding: '16px 0', borderTop: '1px solid var(--border-color)',
                        borderBottom: '1px solid var(--border-color)', marginBottom: 24,
                    }}>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                            Description
                        </h3>
                        <p style={{ color: 'var(--text-primary)', lineHeight: 1.7, fontSize: '0.95rem' }}>
                            {product.description || 'No description provided.'}
                        </p>
                    </div>

                    {/* Buy Section */}
                    {inStock && (
                        <div className="card" style={{ padding: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                                <label style={{ fontWeight: 500, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Quantity:</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                                    <button
                                        type="button"
                                        className="btn btn-outline btn-sm"
                                        style={{ borderRadius: '8px 0 0 8px', padding: '8px 14px' }}
                                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                    >−</button>
                                    <input
                                        type="number"
                                        min="1"
                                        max={product.stock}
                                        value={quantity}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value) || 1;
                                            setQuantity(Math.min(Math.max(1, val), product.stock));
                                        }}
                                        style={{
                                            width: 60, textAlign: 'center', padding: '8px',
                                            border: '1px solid var(--border-color)', borderLeft: 'none', borderRight: 'none',
                                            background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                                            fontFamily: 'Inter, sans-serif', fontWeight: 600,
                                        }}
                                    />
                                    <button
                                        type="button"
                                        className="btn btn-outline btn-sm"
                                        style={{ borderRadius: '0 8px 8px 0', padding: '8px 14px' }}
                                        onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                                    >+</button>
                                </div>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                    (max {product.stock})
                                </span>
                            </div>

                            <div style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '12px 0', borderTop: '1px solid var(--border-color)', marginBottom: 12,
                            }}>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                    {deliveryFee > 0 ? `Subtotal: PHP ${totalPrice} + PHP ${deliveryFee.toFixed(2)} delivery` : 'Total'}
                                </span>
                                <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>
                                    PHP {grandTotal}
                                </span>
                            </div>

                            {user ? (
                                user.role === 'buyer' ? (
                                    <>
                                        <div style={{ marginBottom: 10 }}>
                                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>
                                                Contact Number
                                            </label>
                                            <input
                                                type="tel"
                                                placeholder="e.g. 09171234567"
                                                value={contactNum}
                                                onChange={e => setContactNum(e.target.value)}
                                                style={{
                                                    width: '100%', padding: '9px 12px', borderRadius: 8,
                                                    border: '1px solid var(--border-color)',
                                                    background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                                                    fontFamily: 'Inter, sans-serif', fontSize: '0.88rem',
                                                }}
                                            />
                                        </div>
                                        <div style={{ marginBottom: 14 }}>
                                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>
                                                Delivery Address
                                            </label>
                                            <textarea
                                                placeholder="Enter delivery address"
                                                value={deliveryAddr}
                                                onChange={e => setDeliveryAddr(e.target.value)}
                                                rows={2}
                                                style={{
                                                    width: '100%', padding: '9px 12px', borderRadius: 8,
                                                    border: '1px solid var(--border-color)',
                                                    background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                                                    fontFamily: 'Inter, sans-serif', fontSize: '0.88rem',
                                                    resize: 'vertical',
                                                }}
                                            />
                                        </div>
                                        <button
                                            className="btn btn-success"
                                            onClick={handleBuy}
                                            disabled={buying}
                                            style={{ width: '100%', padding: '14px', fontSize: '1rem' }}
                                        >
                                            {buying ? <><span className="spinner"></span> Processing...</> : `Buy Now — PHP ${grandTotal}`}
                                        </button>
                                    </>
                                ) : (
                                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                        {user.role === 'staff' ? 'Staff cannot purchase products. Switch to a buyer account.' : ''}
                                    </p>
                                )
                            ) : (
                                <a href="/login" className="btn btn-primary" style={{ width: '100%', padding: '14px', fontSize: '1rem', textAlign: 'center' }}>
                                    Login to Buy
                                </a>
                            )}
                        </div>
                    )}
                </div>
            </div>

    </div>
    );
}
