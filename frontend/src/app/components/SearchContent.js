'use client';

import { searchProducts, getStoredUser, getStoredAdmin, buyProduct } from '../../lib/api';
import { useState, useEffect } from 'react';
import Toast from './Toast';

export default function SearchContent() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [user, setUser] = useState(null);

    const [selectedProduct, setSelectedProduct] = useState(null);
    const [quantity, setQuantity] = useState(1);
    const [purchased, setPurchased] = useState(false);
    const [purchaseError, setPurchaseError] = useState('');
    const [purchaseType, setPurchaseType] = useState('delivery');
    const [purchaseLoading, setPurchaseLoading] = useState(false);

    const [isListening, setIsListening] = useState(false);
    const [voiceSupported, setVoiceSupported] = useState(true);
    const [voiceError, setVoiceError] = useState('');

    useEffect(() => {
        setUser(getStoredUser() || getStoredAdmin());
        const hasSpeechAPI = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
        const hasMediaRecorder = !!(window.MediaRecorder && navigator.mediaDevices?.getUserMedia);
        setVoiceSupported(hasSpeechAPI || hasMediaRecorder);
    }, []);

    const handleVoiceSearch = async () => {
        if (isListening) return;
        setVoiceError('');

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (SpeechRecognition) {
            try {
                const recognition = new SpeechRecognition();
                recognition.lang = 'en-US';
                recognition.interimResults = false;
                recognition.continuous = false;
                recognition.maxAlternatives = 1;

                recognition.onstart = () => setIsListening(true);
                recognition.onend = () => setIsListening(false);
                recognition.onerror = (event) => {
                    setIsListening(false);
                    if (event.error === 'not-allowed') {
                        setVoiceError('Microphone access denied. Please allow microphone in browser settings.');
                    } else if (event.error === 'no-speech') {
                        setVoiceError('No speech detected. Please try again.');
                    } else {
                        setVoiceError('Voice recognition error. Please try again.');
                    }
                };

                recognition.onresult = (event) => {
                    const transcript = event.results[0][0].transcript;
                    setQuery(transcript);
                    setTimeout(() => {
                        document.getElementById('search-form-embedded')?.requestSubmit();
                    }, 200);
                };

                recognition.start();
            } catch (err) {
                setVoiceError('Could not start voice recognition.');
            }
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setIsListening(true);

            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            const audioChunks = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                stream.getTracks().forEach(track => track.stop());
                setIsListening(false);

                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const formData = new FormData();
                formData.append('audio', audioBlob, 'recording.webm');

                try {
                    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
                    const res = await fetch(`${API_URL}/search/transcribe`, {
                        method: 'POST',
                        body: formData,
                    });
                    const data = await res.json();
                    if (data.transcript) {
                        setQuery(data.transcript);
                        setTimeout(() => {
                            document.getElementById('search-form-embedded')?.requestSubmit();
                        }, 200);
                    } else {
                        setVoiceError(data.error || 'Could not transcribe audio.');
                    }
                } catch (err) {
                    setVoiceError('Failed to transcribe audio. Check backend connection.');
                }
            };

            mediaRecorder.start();
            setTimeout(() => {
                if (mediaRecorder.state === 'recording') mediaRecorder.stop();
            }, 5000);
        } catch (err) {
            setIsListening(false);
            if (err.name === 'NotAllowedError') {
                setVoiceError('Microphone access denied. Allow it in browser settings.');
            } else {
                setVoiceError('Microphone not available.');
            }
        }
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;
        setLoading(true);
        setError('');
        try {
            const data = await searchProducts(query.trim());
            setResults(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const openProduct = (product) => {
        setSelectedProduct(product);
        setQuantity(1);
        setPurchased(false);
        setPurchaseError('');
    };

    const closeModal = () => { setSelectedProduct(null); setPurchased(false); };

    const handlePurchase = async () => {
        if (!user) { setPurchaseError('Please log in to purchase items.'); return; }
        if (purchaseLoading) return;
        setPurchaseError('');
        setPurchaseLoading(true);
        try {
            await buyProduct(selectedProduct.id, quantity, purchaseType);
            setPurchased(true);
            window.dispatchEvent(new Event('balance-updated'));
        } catch (err) {
            setPurchaseError(err.message || 'Failed to complete purchase.');
        } finally {
            setPurchaseLoading(false);
        }
    };

    const getLabelClass = (label) => {
        const map = { Exact: 'label-exact', Substitute: 'label-substitute', Complement: 'label-complement' };
        return `label ${map[label] || ''}`;
    };

    return (
        <div>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>AI-Powered Search</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Find products with BERT-powered intelligent matching</p>
            </div>

            <form id="search-form-embedded" onSubmit={handleSearch} className="search-container" style={{ marginBottom: 32, position: 'relative' }}>
                <input
                    type="text" className="search-input"
                    placeholder="Search for products... (e.g. wireless headphones)"
                    value={query} onChange={(e) => setQuery(e.target.value)}
                    style={{ paddingLeft: 16, paddingRight: 52 }}
                />
                <button type="button" onClick={handleVoiceSearch} title={isListening ? 'Listening...' : 'Voice search'}
                    style={{
                        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                        width: 38, height: 38, borderRadius: '50%', border: 'none',
                        background: isListening ? 'rgba(239, 68, 68, 0.2)' : 'var(--theme-toggle-bg)',
                        color: isListening ? '#ef4444' : 'var(--text-muted)',
                        cursor: voiceSupported ? 'pointer' : 'not-allowed',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.1rem', transition: 'all 0.2s ease',
                        animation: isListening ? 'voicePulse 1.2s ease-in-out infinite' : 'none',
                        opacity: voiceSupported ? 1 : 0.4,
                    }}
                >🎤</button>
            </form>

            {isListening && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
                    padding: '10px 16px', borderRadius: 10,
                    background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)',
                    color: '#ef4444', fontSize: '0.85rem', fontWeight: 600,
                    animation: 'voicePulse 1.2s ease-in-out infinite',
                }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'blink 1s infinite' }}></span>
                    Listening... Speak now
                </div>
            )}

            {voiceError && (
                <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 10, background: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.25)', color: '#fbbf24', fontSize: '0.85rem' }}>
                    ⚠️ {voiceError}
                </div>
            )}

            {/* ===== TOAST NOTIFICATION ===== */}
            <Toast 
                message={error ? { type: 'error', text: error } : purchaseError ? { type: 'error', text: purchaseError } : null} 
                onClose={() => { setError(''); setPurchaseError(''); }} 
            />

            {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 12 }}>
                    <div className="spinner" style={{ width: 40, height: 40 }}></div>
                    <p style={{ color: 'var(--text-muted)' }}>AI is analyzing products...</p>
                </div>
            )}

            {results && !loading && (
                <div>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
                        Found {results.total_results} relevant products for "{results.query}"
                    </p>
                    {results.total_results === 0 ? (
                        <div className="empty-state"><h3>{results.message || 'No products found'}</h3><p>Try a different search term</p></div>
                    ) : (
                        <div className="product-grid">
                            {results.results.filter(p => !p.stock || p.stock > 0).map((product) => (
                                <div key={product.id} className="card product-card" onClick={() => openProduct(product)} style={{ cursor: 'pointer' }}>
                                    <div style={{ marginBottom: 12, borderRadius: 8, overflow: 'hidden', background: 'var(--bg-secondary)', height: 160 }}>
                                        {product.image_url ? (
                                            <img src={product.image_url} alt={product.title}
                                                style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }}
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                    e.target.parentElement.style.display = 'flex';
                                                    e.target.parentElement.style.alignItems = 'center';
                                                    e.target.parentElement.style.justifyContent = 'center';
                                                    e.target.parentElement.innerHTML = '<span style="color:var(--text-muted);font-size:0.8rem">No Image</span>';
                                                }} />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No Image</span>
                                            </div>
                                        )}
                                    </div>
                                    {user?.role === 'admin' && (
                                        <div style={{ marginBottom: 12 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                                <span className={getLabelClass(product.relevance_label)}>{product.relevance_label}</span>
                                                <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 4, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                                    Score: {(product.relevance_score * 100).toFixed(1)}%
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(76,175,80,0.15)', color: '#4caf50' }}>E: {(product.exact_prob * 100).toFixed(1)}%</span>
                                                <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(255,193,7,0.15)', color: '#ffc107' }}>S: {(product.substitute_prob * 100).toFixed(1)}%</span>
                                                <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(33,150,243,0.15)', color: '#2196f3' }}>C: {(product.complement_prob * 100).toFixed(1)}%</span>
                                                <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(244,67,54,0.15)', color: '#f44336' }}>I: {(product.irrelevant_prob * 100).toFixed(1)}%</span>
                                            </div>
                                        </div>
                                    )}
                                    <h3 className="product-title">{product.title}</h3>
                                    {product.description && (
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 12 }}>
                                            {product.description.slice(0, 120)}{product.description.length > 120 ? '...' : ''}
                                        </p>
                                    )}
                                    <div className="product-meta">
                                        <span className="product-price">PHP {product.price.toFixed(2)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Product Detail Modal */}
            {selectedProduct && (
                <div onClick={closeModal} style={{
                    position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
                }}>
                    <div onClick={(e) => e.stopPropagation()} style={{
                        background: 'var(--bg-card)', backdropFilter: 'blur(20px)',
                        border: '1px solid var(--border-color)', borderRadius: 20,
                        maxWidth: 500, width: '100%', boxShadow: '0 24px 80px rgba(0,0,0,0.5)', position: 'relative',
                    }}>
                        <button onClick={closeModal} style={{
                            position: 'absolute', top: 16, right: 16, zIndex: 10,
                            width: 32, height: 32, borderRadius: '50%',
                            background: 'var(--bg-secondary)', border: 'none',
                            color: 'var(--text-secondary)', cursor: 'pointer',
                        }}>✕</button>

                        {purchased ? (
                            <div style={{ padding: 40, textAlign: 'center' }}>
                                <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
                                <h2>Purchase Confirmed!</h2>
                                <p style={{ color: 'var(--text-secondary)' }}>You bought {quantity}x {selectedProduct.title}</p>
                            </div>
                        ) : (
                            <div style={{ padding: 32 }}>
                                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 16, paddingRight: 32 }}>{selectedProduct.title}</h2>
                                <div style={{ marginBottom: 24 }}>
                                    {selectedProduct.image_url && (
                                        <div style={{ height: 200, borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
                                            <img src={selectedProduct.image_url} alt={selectedProduct.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                onError={(e) => { e.target.style.display = 'none'; }} />
                                        </div>
                                    )}
                                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>PHP {parseFloat(selectedProduct.price).toFixed(2)}</div>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 12 }}>{selectedProduct.description}</p>
                                </div>
                                <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 16 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Quantity:</span>
                                        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: 8 }}>
                                            <button onClick={() => setQuantity(Math.max(1, quantity - 1))} style={{ width: 36, height: 36, background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>−</button>
                                            <span style={{ width: 44, textAlign: 'center', fontWeight: 'bold' }}>{quantity}</span>
                                            <button onClick={() => setQuantity(quantity + 1)} style={{ width: 36, height: 36, background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>+</button>
                                        </div>
                                    </div>

                                    {user && user.role === 'buyer' && (
                                        <>
                                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 14 }}>+ PHP 40.00 delivery fee per department store</p>
                                            <button className="btn btn-success" onClick={handlePurchase} disabled={purchaseLoading}
                                                style={{ width: '100%', padding: '12px', fontSize: '1rem', opacity: purchaseLoading ? 0.6 : 1, cursor: purchaseLoading ? 'not-allowed' : 'pointer' }}>
                                                {purchaseLoading ? 'Processing...' : `Buy for PHP ${(parseFloat(selectedProduct.price) * quantity).toFixed(2)}`}
                                            </button>
                                        </>
                                    )}
                                    {!user && <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Please log in to purchase items.</p>}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <style jsx>{`
                @keyframes voicePulse {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
                    50% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
                }
                @keyframes blink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.3; }
                }
            `}</style>
        </div>
    );
}
