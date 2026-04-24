'use client';

import { searchProducts, getStoredUser, getStoredAdmin } from '../../lib/api';
import { useState, useEffect } from 'react';
import ProductDetailModal from '../components/ProductDetailModal';
import Toast from '../components/Toast';

export default function SearchPage() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [user, setUser] = useState(null);
    const [hydrated, setHydrated] = useState(false);

    // Modal state
    const [selectedProduct, setSelectedProduct] = useState(null);

    // Voice-to-text state
    const [isListening, setIsListening] = useState(false);
    const [voiceSupported, setVoiceSupported] = useState(true);
    const [voiceError, setVoiceError] = useState('');

    // Roles that are NOT allowed to use search
    const restrictedRoles = ['manager', 'seller', 'delivery'];

    // Load user on mount
    useEffect(() => {
        const storedUser = getStoredUser();
        const storedAdmin = getStoredAdmin();
        setUser(storedUser || storedAdmin);
        setHydrated(true);
        // Check if any voice input is possible (Speech API or MediaRecorder)
        const hasSpeechAPI = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
        const hasMediaRecorder = !!(window.MediaRecorder && navigator.mediaDevices?.getUserMedia);
        setVoiceSupported(hasSpeechAPI || hasMediaRecorder);
    }, []);

    // Block restricted roles from accessing search
    if (hydrated && user && restrictedRoles.includes(user.role)) {
        return (
            <div className="page" style={{ textAlign: 'center', paddingTop: 120 }}>
                <div style={{ fontSize: '4rem', marginBottom: 20 }}>🔒</div>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 12 }}>Access Restricted</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 28, maxWidth: 400, margin: '0 auto 28px' }}>
                    The search feature is only available for buyers and admins.
                </p>
                <a
                    href="/"
                    className="btn btn-primary"
                    style={{ padding: '12px 32px', borderRadius: 12 }}
                >
                    Go Back Home
                </a>
            </div>
        );
    }

    const handleVoiceSearch = async () => {
        if (isListening) return;
        setVoiceError('');

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        // --- Path 1: Native Speech Recognition API (Chrome, Edge, Safari, Opera) ---
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
                        document.getElementById('search-form')?.requestSubmit();
                    }, 200);
                };

                recognition.start();
            } catch (err) {
                setVoiceError('Could not start voice recognition.');
            }
            return;
        }

        // --- Path 2: MediaRecorder fallback (Firefox and any other browser) ---
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
                            document.getElementById('search-form')?.requestSubmit();
                        }, 200);
                    } else {
                        setVoiceError(data.error || 'Could not transcribe audio.');
                    }
                } catch (err) {
                    setVoiceError('Failed to transcribe audio. Check backend connection.');
                }
            };

            mediaRecorder.start();

            // Auto-stop after 5 seconds
            setTimeout(() => {
                if (mediaRecorder.state === 'recording') {
                    mediaRecorder.stop();
                }
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
            const isAdmin = user?.role === 'admin';
            const data = await searchProducts(query.trim(), isAdmin ? 50 : 20, isAdmin);
            setResults(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const openProduct = (product) => {
        setSelectedProduct(product);
    };

    const closeModal = () => {
        setSelectedProduct(null);
    };

    const getLabelClass = (label) => {
        const map = {
            Exact: 'label-exact',
            Substitute: 'label-substitute',
            Complement: 'label-complement',
        };
        return `label ${map[label] || ''}`;
    };

    return (
        <div className="page">
            <div className="page-header">
                <h1>AI-Powered Search</h1>
                <p>Find products with BERT-powered intelligent matching</p>
            </div>

            {/* Search Bar */}
            <form id="search-form" onSubmit={handleSearch} className="search-container" style={{ marginBottom: 32, position: 'relative' }}>
                <input
                    type="text"
                    className="search-input"
                    placeholder="Search for products... (e.g. wireless headphones)"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    style={{ paddingLeft: 16, paddingRight: 52 }}
                />
                <button
                    type="button"
                    onClick={handleVoiceSearch}
                    title={isListening ? 'Listening...' : 'Voice search'}
                    style={{
                        position: 'absolute',
                        right: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 38,
                        height: 38,
                        borderRadius: '50%',
                        border: 'none',
                        background: isListening ? 'rgba(239, 68, 68, 0.2)' : 'var(--theme-toggle-bg)',
                        color: isListening ? '#ef4444' : 'var(--text-muted)',
                        cursor: voiceSupported ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.1rem',
                        transition: 'all 0.2s ease',
                        animation: isListening ? 'voicePulse 1.2s ease-in-out infinite' : 'none',
                        opacity: voiceSupported ? 1 : 0.4,
                    }}
                    onMouseEnter={(e) => { if (!isListening && voiceSupported) e.currentTarget.style.background = 'rgba(108,99,255,0.12)'; }}
                    onMouseLeave={(e) => { if (!isListening && voiceSupported) e.currentTarget.style.background = 'var(--theme-toggle-bg)'; }}
                >
                    🎤
                </button>
            </form>

            {/* Voice feedback messages */}
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
                <div style={{
                    marginBottom: 16, padding: '10px 16px', borderRadius: 10,
                    background: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.25)',
                    color: '#fbbf24', fontSize: '0.85rem',
                }}>
                    ⚠️ {voiceError}
                </div>
            )}

            {/* ===== TOAST NOTIFICATION ===== */}
            <Toast 
                message={error ? { type: 'error', text: error } : null} 
                onClose={() => setError('')} 
            />

            {loading && (
                <div className="loading-container">
                    <div className="spinner" style={{ width: 40, height: 40 }}></div>
                    <p>AI is analyzing products...</p>
                </div>
            )}

            {results && !loading && (
                <div>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
                        Found {results.total_results} relevant products for "{results.query}"
                    </p>

                    {results.total_results === 0 ? (
                        <div className="empty-state">
                            <h3>{results.message || 'No products found'}</h3>
                            <p>Try a different search term</p>
                        </div>
                    ) : (
                        <div className="product-grid">
                            {results.results.filter(p => p.stock === undefined || p.stock === null || p.stock > 0).map((product) => (
                                <div
                                    key={product.id}
                                    className="card product-card"
                                    onClick={() => openProduct(product)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    {product.image_url && (
                                        <div style={{ marginBottom: 12, borderRadius: 8, overflow: 'hidden' }}>
                                            <img
                                                src={product.image_url}
                                                alt={product.title}
                                                style={{
                                                    width: '100%', height: 160, objectFit: 'cover', display: 'block',
                                                }}
                                                onError={(e) => { e.target.style.display = 'none'; }}
                                            />
                                        </div>
                                    )}
                                    {user?.role === 'admin' && (
                                    <div style={{ marginBottom: 12 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                            <span className={getLabelClass(product.relevance_label)}>
                                                {product.relevance_label}
                                            </span>
                                            <span style={{
                                                fontSize: '0.7rem', padding: '2px 8px', borderRadius: 4,
                                                background: 'var(--bg-secondary)',
                                                color: 'var(--text-secondary)', fontWeight: 600,
                                            }}>
                                                Score: {(product.relevance_score * 100).toFixed(1)}%
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(76, 175, 80, 0.15)', color: '#4caf50' }}>
                                                E: {(product.exact_prob * 100).toFixed(1)}%
                                            </span>
                                            <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(255, 193, 7, 0.15)', color: '#ffc107' }}>
                                                S: {(product.substitute_prob * 100).toFixed(1)}%
                                            </span>
                                            <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(33, 150, 243, 0.15)', color: '#2196f3' }}>
                                                C: {(product.complement_prob * 100).toFixed(1)}%
                                            </span>
                                            <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(244, 67, 54, 0.15)', color: '#f44336' }}>
                                                I: {(product.irrelevant_prob * 100).toFixed(1)}%
                                            </span>
                                        </div>
                                    </div>
                                    )}
                                    <h3 className="product-title">{product.title}</h3>
                                    {product.description && (
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 12 }}>
                                            {product.description.slice(0, 120)}
                                            {product.description.length > 120 ? '...' : ''}
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

            {/* ===== PRODUCT DETAIL MODAL ===== */}
            <ProductDetailModal
                product={selectedProduct}
                user={user}
                onClose={closeModal}
            />

            {/* Voice pulse animation */}
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
