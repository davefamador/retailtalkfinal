'use client';

import { useEffect, useState } from 'react';
import { getStoredUser, getStoredAdmin } from '../lib/api';
import {
    Search, ArrowRight, ExternalLink,
    Brain, Database, Layers, Sparkles, Target,
    Shield, Mic, BarChart3, Zap, User,
} from 'lucide-react';

export default function HomePage() {
    const [user, setUser] = useState(null);
    const [hydrated, setHydrated] = useState(false);
    const [demoQuery, setDemoQuery] = useState('');
    const [demoIndex, setDemoIndex] = useState(0);

    const demoQueries = [
        'affordable blue Nike shoes under 2000',
        'wireless headphones for studying',
        'comfortable leather wallet for men',
        'organic skincare products under 500',
    ];

    const demoAnnotations = [
        [
            { label: 'Intent', value: 'filtered_search', color: '#6c63ff' },
            { label: 'Product', value: 'shoes', color: '#10b981' },
            { label: 'Color', value: 'blue', color: '#3b82f6' },
            { label: 'Brand', value: 'Nike', color: '#d97706' },
            { label: 'Max Price', value: '₱2,000', color: '#ef4444' },
        ],
        [
            { label: 'Intent', value: 'single_search', color: '#6c63ff' },
            { label: 'Product', value: 'headphones', color: '#10b981' },
            { label: 'Feature', value: 'wireless', color: '#3b82f6' },
            { label: 'Context', value: 'studying', color: '#d97706' },
        ],
        [
            { label: 'Intent', value: 'single_search', color: '#6c63ff' },
            { label: 'Product', value: 'wallet', color: '#10b981' },
            { label: 'Material', value: 'leather', color: '#3b82f6' },
            { label: 'Target', value: 'men', color: '#d97706' },
        ],
        [
            { label: 'Intent', value: 'filtered_search', color: '#6c63ff' },
            { label: 'Product', value: 'skincare', color: '#10b981' },
            { label: 'Feature', value: 'organic', color: '#3b82f6' },
            { label: 'Max Price', value: '₱500', color: '#ef4444' },
        ],
    ];

    useEffect(() => {
        const storedUser = getStoredUser();
        const storedAdmin = getStoredAdmin();
        // Redirect staff roles away from landing page to their dashboards
        if (storedAdmin && storedAdmin.role === 'admin') {
            window.location.href = '/admin/dashboard';
            return;
        }
        if (storedUser) {
            if (storedUser.role === 'staff') { window.location.href = '/sell'; return; }
            if (storedUser.role === 'manager') { window.location.href = '/manager/dashboard'; return; }
            if (storedUser.role === 'delivery') { window.location.href = '/delivery'; return; }
        }
        setUser(storedUser);
        setHydrated(true);
    }, []);

    // Typewriter effect for demo search
    useEffect(() => {
        const query = demoQueries[demoIndex];
        let charIndex = 0;
        let timeoutId;
        setDemoQuery('');

        const typeInterval = setInterval(() => {
            if (charIndex < query.length) {
                setDemoQuery(query.slice(0, charIndex + 1));
                charIndex++;
            } else {
                clearInterval(typeInterval);
                timeoutId = setTimeout(() => {
                    setDemoIndex((prev) => (prev + 1) % demoQueries.length);
                }, 2500);
            }
        }, 50);

        return () => {
            clearInterval(typeInterval);
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [demoIndex]);

    const techStack = [
        'Python 3.11', 'FastAPI', 'Next.js 14', 'React 18',
        'BERT', 'PyTorch', 'Supabase', 'PostgreSQL',
        'pgvector', 'Hugging Face', 'scikit-learn', 'JWT Auth',
    ];

    const pipelineSteps = [
        {
            num: '01', color: '#6c63ff', icon: Brain,
            title: 'Query Understanding',
            desc: 'Intent classification detects search type (filtered, multi-product, free-form). Slot extraction identifies entities like product, brand, color, and price range using BIO-tagged NER.',
            details: ['Intent Classification (4 types)', 'Slot Extraction (NER)', 'Query Rewriting'],
        },
        {
            num: '02', color: '#10b981', icon: Database,
            title: 'Semantic Search',
            desc: 'BERT embeddings encode your query into a 768-dimensional vector. pgvector finds the 50 most similar products using IVFFlat indexing in milliseconds.',
            details: ['768-dim BERT Embeddings', 'pgvector Similarity', 'Top-50 Candidates'],
        },
        {
            num: '03', color: '#d97706', icon: Layers,
            title: 'Smart Ranking',
            desc: 'CrossEncoder re-ranks candidates by pairwise relevance. ESCI classifier labels each result as Exact, Substitute, Complement, or Irrelevant with confidence scores.',
            details: ['CrossEncoder Re-Ranking', 'ESCI Classification', 'Score Blending'],
        },
    ];

    const features = [
        { icon: Sparkles, color: '#6c63ff', title: 'Natural Language Search', desc: 'Type what you need in plain language. "Comfortable running shoes under 1500" just works.' },
        { icon: Mic, color: '#10b981', title: 'Voice Search', desc: 'Speak your query using Web Speech API with MediaRecorder fallback for universal browser support.' },
        { icon: Target, color: '#d97706', title: 'ESCI Labels', desc: 'Every result shows Exact, Substitute, Complement, or Irrelevant classification with confidence scores.' },
        { icon: Shield, color: '#3b82f6', title: 'Secure Wallets', desc: 'Digital wallet system with deposits, purchases, and full transaction history. Role-based access control.' },
        { icon: BarChart3, color: '#8b5cf6', title: 'Smart Analytics', desc: 'Seller dashboards, admin controls, delivery tracking, and wishlist analytics built in.' },
        { icon: Zap, color: '#ec4899', title: 'Real-Time Results', desc: 'Sub-second search with semantic understanding, not just keyword matching. Find what you mean.' },
    ];

    return (
        <div style={{ minHeight: '100vh' }}>

            {/* ========== HERO ========== */}
            <section style={{
                padding: '100px 20px 60px',
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden',
            }}>
                {/* Background orbs */}
                <div style={{
                    position: 'absolute', top: '5%', left: '10%', width: 400, height: 400,
                    borderRadius: '50%', background: 'rgba(108,99,255,0.08)', filter: 'blur(100px)',
                    animation: 'float 8s ease-in-out infinite', pointerEvents: 'none',
                }} />
                <div style={{
                    position: 'absolute', bottom: '10%', right: '10%', width: 350, height: 350,
                    borderRadius: '50%', background: 'rgba(16,185,129,0.06)', filter: 'blur(100px)',
                    animation: 'float 10s ease-in-out infinite reverse', pointerEvents: 'none',
                }} />

                <div style={{ position: 'relative', zIndex: 1, maxWidth: 820, margin: '0 auto' }}>
                    {/* Badge */}
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '8px 20px', borderRadius: 24,
                        background: 'rgba(108,99,255,0.1)',
                        border: '1px solid rgba(108,99,255,0.2)',
                        color: '#6c63ff', fontSize: '0.85rem', fontWeight: 600,
                        marginBottom: 32, letterSpacing: '0.3px',
                    }}>
                        <Sparkles size={14} />
                        NLP-Powered Product Search Engine
                    </div>

                    {/* Heading */}
                    <h1 style={{
                        fontSize: 'clamp(2.5rem, 5.5vw, 4rem)',
                        fontWeight: 800, lineHeight: 1.1,
                        marginBottom: 20, letterSpacing: '-0.03em',
                    }}>
                        Search Smarter.{' '}
                        <span style={{
                            background: 'linear-gradient(135deg, #6c63ff, #8b5cf6)',
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                        }}>Find Better.</span>
                    </h1>

                    <p style={{
                        fontSize: 'clamp(1rem, 2vw, 1.2rem)',
                        color: 'var(--text-secondary)',
                        maxWidth: 580, margin: '0 auto 40px', lineHeight: 1.7,
                    }}>
                        RetailTalk uses BERT embeddings, intent classification, and ESCI ranking
                        to deliver precise product search results through natural language.
                    </p>

                    {/* Search Demo */}
                    <div
                        onClick={() => { window.location.href = '/search'; }}
                        style={{
                            maxWidth: 620, margin: '0 auto 20px',
                            cursor: 'pointer',
                        }}
                    >
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '18px 24px',
                            background: 'var(--bg-card)',
                            border: '2px solid var(--border-color)',
                            borderRadius: 16,
                            boxShadow: '0 0 40px rgba(108,99,255,0.1)',
                            transition: 'border-color 0.3s',
                        }}>
                            <Search size={20} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                            <span style={{
                                fontSize: '1.05rem', color: 'var(--text-primary)',
                                minHeight: '1.4em', textAlign: 'left',
                            }}>
                                {demoQuery}
                                <span style={{
                                    display: 'inline-block', width: 2, height: '1.1em',
                                    background: 'var(--accent-primary)', marginLeft: 2,
                                    verticalAlign: 'text-bottom',
                                    animation: 'blink 1s step-end infinite',
                                }} />
                            </span>
                        </div>
                    </div>

                    {/* NLP Annotations */}
                    <div style={{
                        display: 'flex', flexWrap: 'wrap', gap: 8,
                        justifyContent: 'center',
                        maxWidth: 620, margin: '0 auto 40px',
                        minHeight: 36,
                    }}>
                        {demoAnnotations[demoIndex].map((a, i) => (
                            <span key={`${demoIndex}-${i}`} style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                padding: '5px 12px', borderRadius: 8,
                                background: `${a.color}12`,
                                border: `1px solid ${a.color}30`,
                                fontSize: '0.78rem', fontWeight: 600,
                                animation: 'fadeIn 0.3s ease-out',
                            }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{a.label}</span>
                                <span style={{ color: a.color }}>{a.value}</span>
                            </span>
                        ))}
                    </div>

                    {/* CTA Buttons */}
                    <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                        {(!hydrated || !user || user.role === 'buyer' || user.role === 'admin') && (
                            <a href="/search" className="btn btn-primary" style={{
                                padding: '14px 32px', fontSize: '1rem', borderRadius: 12,
                                display: 'inline-flex', alignItems: 'center', gap: 8,
                            }}>
                                Try AI Search <ArrowRight size={16} />
                            </a>
                        )}
                        <a href="/products" className="btn btn-outline" style={{
                            padding: '14px 32px', fontSize: '1rem', borderRadius: 12,
                        }}>
                            Browse Products
                        </a>
                    </div>
                </div>
            </section>

            {/* ========== TECH STACK MARQUEE ========== */}
            <section style={{ padding: '48px 0', overflow: 'hidden' }}>
                <p style={{
                    textAlign: 'center', fontSize: '0.75rem', fontWeight: 700,
                    letterSpacing: '2px', color: 'var(--text-muted)',
                    marginBottom: 24, textTransform: 'uppercase',
                }}>
                    Built With Cutting-Edge Technology
                </p>
                <div style={{ overflow: 'hidden', position: 'relative' }}>
                    {/* Fade edges */}
                    <div style={{
                        position: 'absolute', left: 0, top: 0, bottom: 0, width: 100,
                        background: 'linear-gradient(to right, var(--bg-primary), transparent)',
                        zIndex: 2, pointerEvents: 'none',
                    }} />
                    <div style={{
                        position: 'absolute', right: 0, top: 0, bottom: 0, width: 100,
                        background: 'linear-gradient(to left, var(--bg-primary), transparent)',
                        zIndex: 2, pointerEvents: 'none',
                    }} />
                    <div style={{
                        display: 'flex', gap: 16,
                        animation: 'marquee 25s linear infinite',
                        width: 'max-content',
                    }}>
                        {[...techStack, ...techStack].map((tech, i) => (
                            <span key={i} style={{
                                padding: '8px 20px', borderRadius: 10,
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-color)',
                                fontSize: '0.85rem', fontWeight: 600,
                                color: 'var(--text-secondary)',
                                whiteSpace: 'nowrap',
                            }}>
                                {tech}
                            </span>
                        ))}
                    </div>
                </div>
            </section>

            {/* ========== HOW IT WORKS (Pipeline) ========== */}
            <section style={{ padding: '80px 20px', maxWidth: 1100, margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: 56 }}>
                    <h2 style={{
                        fontSize: 'clamp(1.8rem, 4vw, 2.2rem)', fontWeight: 800,
                        marginBottom: 12, letterSpacing: '-0.01em',
                    }}>
                        How RetailTalk Searches
                    </h2>
                    <p style={{
                        color: 'var(--text-muted)', maxWidth: 500,
                        margin: '0 auto', lineHeight: 1.6, fontSize: '1rem',
                    }}>
                        A multi-stage NLP pipeline that understands intent, not just keywords
                    </p>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: 24,
                }}>
                    {pipelineSteps.map((step) => {
                        const Icon = step.icon;
                        return (
                            <div key={step.num} className="card" style={{
                                padding: 32, position: 'relative', overflow: 'hidden',
                            }}>
                                <div style={{
                                    position: 'absolute', top: -10, right: -5,
                                    fontSize: '5rem', fontWeight: 900, color: `${step.color}08`,
                                    lineHeight: 1, letterSpacing: '-0.05em',
                                }}>{step.num}</div>
                                <div style={{
                                    width: 48, height: 48, borderRadius: 12, marginBottom: 20,
                                    background: `${step.color}15`,
                                    border: `1px solid ${step.color}25`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: step.color,
                                }}>
                                    <Icon size={22} strokeWidth={1.8} />
                                </div>
                                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 12 }}>
                                    {step.title}
                                </h3>
                                <p style={{
                                    color: 'var(--text-secondary)', fontSize: '0.9rem',
                                    lineHeight: 1.65, marginBottom: 16,
                                }}>
                                    {step.desc}
                                </p>
                                <ul style={{ listStyle: 'none', padding: 0 }}>
                                    {step.details.map((d, i) => (
                                        <li key={i} style={{
                                            padding: '5px 0', fontSize: '0.82rem',
                                            color: 'var(--text-muted)',
                                            display: 'flex', alignItems: 'center', gap: 8,
                                        }}>
                                            <span style={{
                                                width: 6, height: 6, borderRadius: '50%',
                                                background: step.color, flexShrink: 0, opacity: 0.6,
                                            }} />
                                            {d}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* ========== FEATURES ========== */}
            <section style={{
                padding: '80px 20px',
                background: 'linear-gradient(180deg, transparent, rgba(108,99,255,0.03) 50%, transparent)',
            }}>
                <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: 56 }}>
                        <h2 style={{
                            fontSize: 'clamp(1.8rem, 4vw, 2.2rem)', fontWeight: 800, marginBottom: 12,
                        }}>
                            Everything You Need
                        </h2>
                        <p style={{
                            color: 'var(--text-muted)', maxWidth: 500,
                            margin: '0 auto', lineHeight: 1.6,
                        }}>
                            A complete e-commerce platform powered by artificial intelligence
                        </p>
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                        gap: 20,
                    }}>
                        {features.map((f, i) => {
                            const Icon = f.icon;
                            return (
                                <div key={i} className="homepage-feature-card" style={{
                                    padding: 28, borderRadius: 14,
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-color)',
                                    transition: 'all 0.2s',
                                }}>
                                    <div style={{
                                        width: 44, height: 44, borderRadius: 10,
                                        background: `${f.color}12`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: f.color, marginBottom: 16,
                                    }}>
                                        <Icon size={20} strokeWidth={1.8} />
                                    </div>
                                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 8 }}>
                                        {f.title}
                                    </h3>
                                    <p style={{
                                        color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6,
                                    }}>
                                        {f.desc}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ========== PERSUASIVE CTA ========== */}
            <section style={{
                padding: '80px 20px', textAlign: 'center',
                position: 'relative', overflow: 'hidden',
            }}>
                <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 500, height: 500, borderRadius: '50%',
                    background: 'rgba(108,99,255,0.08)', filter: 'blur(120px)',
                    pointerEvents: 'none',
                }} />
                <div style={{ position: 'relative', zIndex: 1, maxWidth: 600, margin: '0 auto' }}>
                    <h2 style={{
                        fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', fontWeight: 800,
                        marginBottom: 16, letterSpacing: '-0.02em',
                    }}>
                        Ready to Search{' '}
                        <span style={{
                            background: 'linear-gradient(135deg, #6c63ff, #8b5cf6)',
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                        }}>Intelligently</span>?
                    </h2>
                    <p style={{
                        color: 'var(--text-secondary)', marginBottom: 36,
                        fontSize: '1.05rem', lineHeight: 1.7,
                    }}>
                        Experience AI-powered product discovery. Search in natural language,
                        get ranked results with ESCI labels, and shop with confidence.
                    </p>
                    <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                        {hydrated && !user ? (
                            <>
                                <a href="/register" className="btn btn-primary" style={{
                                    padding: '14px 32px', fontSize: '1rem', borderRadius: 12,
                                    display: 'inline-flex', alignItems: 'center', gap: 8,
                                }}>
                                    Create Account <ArrowRight size={16} />
                                </a>
                                <a href="/login" className="btn btn-outline" style={{
                                    padding: '14px 32px', fontSize: '1rem', borderRadius: 12,
                                }}>Sign In</a>
                            </>
                        ) : hydrated && user ? (
                            (user.role === 'buyer' || user.role === 'admin') ? (
                                <a href="/search" className="btn btn-primary" style={{
                                    padding: '14px 32px', fontSize: '1rem', borderRadius: 12,
                                    display: 'inline-flex', alignItems: 'center', gap: 8,
                                }}>
                                    Go to Search <ArrowRight size={16} />
                                </a>
                            ) : (
                                <a href="/products" className="btn btn-primary" style={{
                                    padding: '14px 32px', fontSize: '1rem', borderRadius: 12,
                                }}>Browse Products</a>
                            )
                        ) : null}
                    </div>
                </div>
            </section>

            {/* ========== DEVELOPER ========== */}
            <section style={{
                padding: '80px 20px',
                background: 'linear-gradient(180deg, transparent, rgba(108,99,255,0.03) 50%, transparent)',
            }}>
                <div style={{ maxWidth: 700, margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: 40 }}>
                        <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: 8 }}>
                            About the Developer
                        </h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                            Built as a thesis research project
                        </p>
                    </div>

                    <div style={{
                        padding: 36, borderRadius: 20,
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        textAlign: 'center',
                    }}>
                        {/* Avatar */}
                        <div style={{
                            width: 80, height: 80, borderRadius: '50%', margin: '0 auto 20px',
                            background: 'linear-gradient(135deg, #6c63ff, #8b5cf6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.8rem', fontWeight: 800, color: '#fff',
                            boxShadow: '0 8px 30px rgba(108,99,255,0.3)',
                        }}>
                            <User size={36} />
                        </div>

                        <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 6 }}>
                            Dave Moissan Famador
                        </h3>
                        <p style={{
                            color: 'var(--accent-primary)', fontWeight: 600,
                            fontSize: '0.9rem', marginBottom: 16,
                        }}>
                            Computer Science Researcher
                        </p>
                        <p style={{
                            color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.7,
                            maxWidth: 500, margin: '0 auto 24px',
                        }}>
                            This project explores the application of Natural Language Processing
                            in e-commerce product search, combining BERT embeddings, intent classification,
                            slot extraction, and ESCI relevance scoring into a unified search pipeline.
                        </p>

                        {/* Research Focus Tags */}
                        <div style={{
                            display: 'flex', flexWrap: 'wrap', gap: 8,
                            justifyContent: 'center', marginBottom: 28,
                        }}>
                            {['NLP', 'BERT', 'E-Commerce', 'Information Retrieval', 'Machine Learning'].map(tag => (
                                <span key={tag} style={{
                                    padding: '5px 14px', borderRadius: 8,
                                    background: 'rgba(108,99,255,0.1)',
                                    border: '1px solid rgba(108,99,255,0.15)',
                                    fontSize: '0.78rem', fontWeight: 600,
                                    color: 'var(--text-secondary)',
                                }}>{tag}</span>
                            ))}
                        </div>

                        {/* Social Links */}
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                            <a
                                href="https://www.linkedin.com/in/dave-moissan-famador-4246412a1/"
                                target="_blank" rel="noopener noreferrer"
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 8,
                                    padding: '10px 20px', borderRadius: 10,
                                    background: 'rgba(0,119,181,0.1)',
                                    border: '1px solid rgba(0,119,181,0.2)',
                                    color: '#0077b5', fontSize: '0.85rem', fontWeight: 600,
                                    textDecoration: 'none', transition: 'all 0.2s',
                                }}
                            >
                                <ExternalLink size={16} /> LinkedIn
                            </a>
                            <a
                                href="https://github.com/davefamador"
                                target="_blank" rel="noopener noreferrer"
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 8,
                                    padding: '10px 20px', borderRadius: 10,
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600,
                                    textDecoration: 'none', transition: 'all 0.2s',
                                }}
                            >
                                <ExternalLink size={16} /> GitHub
                            </a>
                        </div>
                    </div>
                </div>
            </section>

            {/* ========== FOOTER ========== */}
            <footer style={{
                padding: '40px 20px 32px', textAlign: 'center',
                borderTop: '1px solid var(--border-color)',
            }}>
                <div style={{ marginBottom: 16 }}>
                    <span style={{
                        fontWeight: 800, fontSize: '1.2rem',
                        background: 'linear-gradient(135deg, #6c63ff, #3b82f6)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    }}>RetailTalk</span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 16 }}>
                    An NLP-powered e-commerce product search engine
                </p>
                <div style={{
                    display: 'flex', gap: 20, justifyContent: 'center', marginBottom: 16,
                }}>
                    <a href="/products" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Products</a>
                    {(!user || user.role === 'buyer' || user.role === 'admin') && (
                        <a href="/search" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Search</a>
                    )}
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', opacity: 0.5 }}>
                    &copy; 2026 RetailTalk — For Educational Purpose Only
                </p>
            </footer>

            {/* ========== ANIMATIONS ========== */}
            <style>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-20px); }
                }
                @keyframes blink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0; }
                }
                @keyframes marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(4px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .homepage-feature-card:hover {
                    border-color: rgba(108,99,255,0.3) !important;
                    transform: translateY(-2px);
                    box-shadow: 0 8px 24px rgba(108,99,255,0.08);
                }
            `}</style>
        </div>
    );
}
