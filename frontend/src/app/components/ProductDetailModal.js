'use client';

import { useState, useEffect } from 'react';
import { buyProduct, addToCart, getMyContact, setMyContact, addToWishlist, removeFromWishlist, checkWishlist } from '../../lib/api';

/**
 * Shared Product Detail Modal used by both Browse and Search pages.
 *
 * Props:
 *  - product: the product object to display (null to hide modal)
 *  - user: current logged-in user object (or null)
 *  - onClose: callback when modal is closed
 *  - onPurchased(product, quantity): optional callback after successful purchase
 *  - isDemo: whether the product is a demo product (disables cart/purchase)
 */
export default function ProductDetailModal({ product, user, onClose, onPurchased, isDemo = false }) {
    const [quantity, setQuantity] = useState(1);
    const [purchased, setPurchased] = useState(false);
    const [selectedImage, setSelectedImage] = useState(0);
    const [purchaseError, setPurchaseError] = useState('');
    const [cartMessage, setCartMessage] = useState({ type: '', text: '' });
    const [purchaseType, setPurchaseType] = useState('delivery');
    const [addressModal, setAddressModal] = useState(false);
    const [contactNum, setContactNum] = useState('');
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [inWishlist, setInWishlist] = useState(false);
    const [wishlistLoading, setWishlistLoading] = useState(false);
    const [purchaseLoading, setPurchaseLoading] = useState(false);

    // Reset state when product changes
    useEffect(() => {
        if (!product) return;
        setQuantity(1);
        setPurchased(false);
        setSelectedImage(0);
        setPurchaseError('');
        setCartMessage({ type: '', text: '' });
        setPurchaseType('delivery');
        setInWishlist(false);
        // Check wishlist status
        if (user && user.role === 'buyer' && !isDemo) {
            checkWishlist(product.id)
                .then(res => setInWishlist(res.in_wishlist))
                .catch(() => {});
        }
    }, [product, user, isDemo]);

    if (!product) return null;

    // Normalize images — browse page uses `images[]`, search page uses `image_url`
    const images = product.images && product.images.length > 0
        ? product.images
        : product.image_url
            ? [product.image_url]
            : [];

    const stock = product.stock || 0;
    const productTotal = parseFloat(product.price) * quantity;
    const deliveryFee = purchaseType === 'delivery' ? 40 : 0;
    const grandTotal = (productTotal + deliveryFee).toFixed(2);
    const totalPrice = productTotal.toFixed(2);

    const handleWishlistToggle = async () => {
        if (!product || wishlistLoading) return;
        setWishlistLoading(true);
        try {
            if (inWishlist) {
                await removeFromWishlist(product.id);
                setInWishlist(false);
            } else {
                await addToWishlist(product.id);
                setInWishlist(true);
            }
        } catch (err) {
            console.error('Wishlist error:', err);
        } finally {
            setWishlistLoading(false);
        }
    };

    const handlePurchase = async () => {
        if (!user) { setPurchaseError('Please log in to purchase items.'); return; }
        if (purchaseLoading) return;
        setPurchaseError('');
        setPurchaseLoading(true);
        try {
            await buyProduct(product.id, quantity, purchaseType);
            setPurchased(true);
            window.dispatchEvent(new Event('balance-updated'));
            if (onPurchased) onPurchased(product, quantity);
        } catch (err) {
            const msg = err.message || '';
            if (msg.includes('delivery address') || msg.includes('contact number')) {
                try {
                    const c = await getMyContact();
                    setContactNum(c.contact_number || '');
                    setDeliveryAddress(c.delivery_address || '');
                } catch (_) {}
                setAddressModal(true);
            } else {
                setPurchaseError(msg || 'Failed to complete purchase. Check balance or stock.');
            }
        } finally {
            setPurchaseLoading(false);
        }
    };

    const handleSaveAddressAndBuy = async () => {
        if (!contactNum.trim()) { setPurchaseError('Contact number is required.'); return; }
        if (purchaseType === 'delivery' && !deliveryAddress.trim()) { setPurchaseError('Delivery address is required.'); return; }
        setPurchaseLoading(true);
        try {
            await setMyContact(contactNum.trim(), deliveryAddress.trim());
            setAddressModal(false);
            await buyProduct(product.id, quantity, purchaseType);
            setPurchased(true);
            window.dispatchEvent(new Event('balance-updated'));
            if (onPurchased) onPurchased(product, quantity);
        } catch (err) {
            setPurchaseError(err.message || 'Failed to complete purchase.');
        } finally {
            setPurchaseLoading(false);
        }
    };

    const handleAddToCart = async () => {
        if (isDemo) { setCartMessage({ type: 'error', text: 'This is a demo product' }); return; }
        try {
            setCartMessage({ type: '', text: '' });
            await addToCart(product.id, quantity);
            setCartMessage({ type: 'success', text: `Added ${quantity}x to cart!` });
        } catch (err) {
            setCartMessage({ type: 'error', text: err.message });
        }
    };

    const closeAll = () => {
        setAddressModal(false);
        setPurchased(false);
        onClose();
    };

    return (
        <>
            {/* ===== PRODUCT DETAIL MODAL ===== */}
            <div
                onClick={closeAll}
                style={{
                    position: 'fixed', inset: 0, zIndex: 1000,
                    background: 'rgba(0, 0, 0, 0.6)',
                    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 24,
                    animation: 'fadeIn 0.2s ease',
                }}
            >
                <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        background: 'var(--bg-card)',
                        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 20,
                        maxWidth: 720, width: '100%', maxHeight: '90vh',
                        overflow: 'auto',
                        boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
                        animation: 'slideUp 0.3s ease',
                        position: 'relative',
                    }}
                >
                    {/* Purchased Confirmation */}
                    {purchased ? (
                        <div style={{
                            padding: 60, textAlign: 'center',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
                        }}>
                            <div style={{
                                width: 80, height: 80, borderRadius: '50%',
                                background: 'rgba(16,185,129,0.15)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '2.5rem',
                                animation: 'scaleIn 0.4s ease',
                            }}>✓</div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Purchase Confirmed!</h2>
                            <p style={{ color: 'var(--text-secondary)', maxWidth: 360, lineHeight: 1.6 }}>
                                You bought <strong>{quantity}x {product.title}</strong> for a total of
                                <strong style={{ color: 'var(--accent-secondary)' }}> PHP {grandTotal}</strong>.
                            </p>
                            <button
                                className="btn btn-primary"
                                onClick={closeAll}
                                style={{ marginTop: 12, padding: '12px 40px' }}
                            >
                                Continue Shopping
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Close Button */}
                            <button
                                onClick={closeAll}
                                style={{
                                    position: 'absolute', top: 16, right: 16, zIndex: 10,
                                    width: 36, height: 36, borderRadius: '50%',
                                    background: 'var(--bg-secondary)', border: 'none',
                                    color: 'var(--text-secondary)', cursor: 'pointer',
                                    fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'background 0.2s',
                                }}
                                onMouseEnter={(e) => e.target.style.background = 'rgba(108,99,255,0.15)'}
                                onMouseLeave={(e) => e.target.style.background = 'var(--bg-secondary)'}
                            >✕</button>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', position: 'relative' }}>
                                {/* Left — Image */}
                                <div style={{ padding: 24 }}>
                                    <div style={{
                                        width: '100%', aspectRatio: '1', borderRadius: 14, overflow: 'hidden',
                                        background: 'rgba(0,0,0,0.3)',
                                    }}>
                                        {images.length > 0 ? (
                                            <img
                                                src={images[selectedImage] || images[0]}
                                                alt={product.title}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                onError={(e) => { e.target.style.display = 'none'; }}
                                            />
                                        ) : (
                                            <div style={{
                                                width: '100%', height: '100%', display: 'flex',
                                                alignItems: 'center', justifyContent: 'center',
                                                color: 'var(--text-muted)',
                                            }}>No Image</div>
                                        )}
                                    </div>
                                    {/* Thumbnails */}
                                    {images.length > 1 && (
                                        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                                            {images.map((img, i) => (
                                                <div key={i} onClick={() => setSelectedImage(i)} style={{
                                                    width: 52, height: 52, borderRadius: 8, overflow: 'hidden',
                                                    cursor: 'pointer',
                                                    border: `2px solid ${i === selectedImage ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                                                }}>
                                                    <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Right — Details */}
                                <div style={{ padding: '28px 24px 28px 0', display: 'flex', flexDirection: 'column' }}>
                                    <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 8, lineHeight: 1.3 }}>
                                        {product.title}
                                    </h2>

                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 16 }}>
                                        Sold by <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                                            {product.seller_name || 'Seller'}
                                        </span>
                                    </p>

                                    <div style={{
                                        fontSize: '1.8rem', fontWeight: 800,
                                        color: 'var(--accent-secondary)', marginBottom: 16,
                                    }}>
                                        PHP {parseFloat(product.price).toFixed(2)}
                                    </div>

                                    {/* Stock Badge + Wishlist */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                                        <div style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 8, width: 'fit-content',
                                            padding: '6px 14px', borderRadius: 20,
                                            background: stock > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                            border: `1px solid ${stock > 0 ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                                        }}>
                                            <span style={{
                                                width: 7, height: 7, borderRadius: '50%',
                                                background: stock > 0 ? 'var(--accent-success)' : 'var(--accent-danger)',
                                            }}></span>
                                            <span style={{
                                                fontSize: '0.8rem', fontWeight: 600,
                                                color: stock > 0 ? 'var(--accent-success)' : 'var(--accent-danger)',
                                            }}>
                                                {stock > 0 ? `${stock} in stock` : 'Out of stock'}
                                            </span>
                                        </div>
                                        {user && user.role === 'buyer' && !isDemo && (
                                            <button
                                                onClick={handleWishlistToggle}
                                                disabled={wishlistLoading}
                                                title={inWishlist ? 'Remove from Wishlist' : 'Add to Wishlist'}
                                                style={{
                                                    width: 38, height: 38, borderRadius: '50%', border: 'none',
                                                    cursor: wishlistLoading ? 'not-allowed' : 'pointer',
                                                    background: inWishlist ? 'rgba(239,68,68,0.15)' : 'var(--bg-secondary)',
                                                    color: inWishlist ? '#ef4444' : 'var(--text-muted)',
                                                    fontSize: '1.15rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    transition: 'all 0.25s ease',
                                                    transform: wishlistLoading ? 'scale(0.9)' : 'scale(1)',
                                                }}
                                                onMouseEnter={e => { if (!wishlistLoading) e.currentTarget.style.transform = 'scale(1.15)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                                            >
                                                {inWishlist ? '❤️' : '🤍'}
                                            </button>
                                        )}
                                    </div>

                                    {/* Description */}
                                    <div style={{
                                        padding: '14px 0', borderTop: '1px solid var(--border-color)',
                                        borderBottom: '1px solid var(--border-color)',
                                        marginBottom: 20, flex: 1,
                                    }}>
                                        <p style={{
                                            fontSize: '0.85rem', color: 'var(--text-secondary)',
                                            fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px',
                                        }}>Description</p>
                                        <p style={{
                                            color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '0.9rem',
                                        }}>
                                            {product.description || 'No description available'}
                                        </p>
                                    </div>

                                    {/* Quantity & Buy */}
                                    <div style={{
                                        background: 'var(--bg-secondary)', borderRadius: 14,
                                        padding: 16,
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Qty:</span>
                                            <div style={{ display: 'flex', alignItems: 'center', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                                                <button
                                                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                                    style={{
                                                        width: 36, height: 36, border: 'none', cursor: 'pointer',
                                                        background: 'var(--bg-primary)', color: 'var(--text-primary)',
                                                        fontSize: '1rem', fontWeight: 700,
                                                    }}
                                                >−</button>
                                                <span style={{
                                                    width: 44, textAlign: 'center', fontWeight: 700,
                                                    fontSize: '0.95rem', background: 'transparent',
                                                    height: 36, lineHeight: '36px',
                                                }}>
                                                    {quantity}
                                                </span>
                                                <button
                                                    onClick={() => setQuantity(Math.min(stock || 999, quantity + 1))}
                                                    style={{
                                                        width: 36, height: 36, border: 'none', cursor: 'pointer',
                                                        background: 'var(--bg-primary)', color: 'var(--text-primary)',
                                                        fontSize: '1rem', fontWeight: 700,
                                                    }}
                                                >+</button>
                                            </div>
                                            {stock > 0 && (
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                    max {stock}
                                                </span>
                                            )}
                                        </div>

                                        <div style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            marginBottom: 14, paddingBottom: 14,
                                            borderBottom: '1px solid var(--border-color)',
                                        }}>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                                {deliveryFee > 0 ? `Subtotal: PHP ${totalPrice} + PHP ${deliveryFee.toFixed(2)} delivery` : 'Total'}
                                            </span>
                                            <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>
                                                PHP {grandTotal}
                                            </span>
                                        </div>

                                        {purchaseError && (
                                            <div style={{
                                                background: 'rgba(239, 68, 68, 0.1)',
                                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                                color: '#ef4444',
                                                padding: '10px 14px',
                                                borderRadius: 8,
                                                marginBottom: 14,
                                                fontSize: '0.85rem'
                                            }}>
                                                {purchaseError}
                                            </div>
                                        )}

                                        {user && user.role === 'buyer' && (
                                            <>
                                                {/* Delivery info */}
                                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 10 }}>
                                                    + PHP 40.00 delivery fee per department store
                                                </p>
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <button
                                                        className="btn"
                                                        onClick={handleAddToCart}
                                                        style={{
                                                            flex: 1, padding: '14px', fontSize: '0.95rem',
                                                            fontWeight: 700, borderRadius: 12,
                                                            background: 'rgba(108,99,255,0.15)', border: '1px solid rgba(108,99,255,0.4)',
                                                            color: '#818cf8', cursor: 'pointer',
                                                        }}
                                                    >
                                                        Add to Cart
                                                    </button>
                                                    <button
                                                        className="btn btn-success"
                                                        onClick={handlePurchase}
                                                        disabled={purchaseLoading}
                                                        style={{
                                                            flex: 1, padding: '14px', fontSize: '0.95rem',
                                                            fontWeight: 700, borderRadius: 12,
                                                            opacity: purchaseLoading ? 0.6 : 1,
                                                            cursor: purchaseLoading ? 'not-allowed' : 'pointer',
                                                        }}
                                                    >
                                                        {purchaseLoading ? 'Processing...' : `Buy — PHP ${grandTotal}`}
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                        {!user && (
                                            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                                Please log in to purchase items.
                                            </p>
                                        )}

                                        {cartMessage.text && (
                                            <div style={{
                                                marginTop: 8, padding: '8px 14px', borderRadius: 8, fontSize: '0.82rem',
                                                fontWeight: 600, textAlign: 'center',
                                                background: cartMessage.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                                border: `1px solid ${cartMessage.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                                color: cartMessage.type === 'success' ? '#10b981' : '#ef4444',
                                            }}>
                                                {cartMessage.text}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ===== DELIVERY ADDRESS MODAL ===== */}
            {addressModal && (
                <div
                    onClick={() => setAddressModal(false)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 1100,
                        background: 'rgba(0,0,0,0.7)',
                        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 24,
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: 'var(--bg-primary)', borderRadius: 20, padding: 32,
                            width: 440, maxWidth: '90vw', border: '1px solid var(--border-color)',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                        }}
                    >
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 8 }}>📍 Delivery Address Required</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 20 }}>
                            Please provide your contact number and delivery address to place a delivery order.
                        </p>

                        {purchaseError && (
                            <div style={{
                                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                                color: '#ef4444', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: '0.85rem',
                            }}>{purchaseError}</div>
                        )}

                        <div style={{ marginBottom: 14 }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Contact Number *</label>
                            <input
                                type="tel" placeholder="e.g. 09171234567"
                                value={contactNum} onChange={(e) => setContactNum(e.target.value)}
                                style={{
                                    width: '100%', padding: '10px 14px', borderRadius: 10,
                                    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                                    color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem',
                                }}
                            />
                        </div>
                        <div style={{ marginBottom: 20 }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Delivery Address *</label>
                            <textarea
                                placeholder="Enter your full delivery address"
                                value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)}
                                rows={3}
                                style={{
                                    width: '100%', padding: '10px 14px', borderRadius: 10,
                                    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                                    color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem',
                                    resize: 'vertical',
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: 12 }}>
                            <button className="btn btn-primary" onClick={handleSaveAddressAndBuy}
                                style={{ flex: 1, padding: '12px 0', fontSize: '0.9rem', fontWeight: 700, borderRadius: 10 }}>Save & Buy</button>
                            <button className="btn btn-outline" onClick={() => setAddressModal(false)}
                                style={{ flex: 1, padding: '12px 0', fontSize: '0.9rem', fontWeight: 700, borderRadius: 10 }}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Inline keyframe animations */}
            <style jsx>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(30px) scale(0.97); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes scaleIn {
                    from { transform: scale(0); }
                    to { transform: scale(1); }
                }
            `}</style>
        </>
    );
}
