'use client';

import { useEffect } from 'react';

/**
 * Toast Notification Component
 * Displays a floating notification that automatically dismisses after a set duration.
 */
export default function Toast({ message, onClose, duration = 5000 }) {
    useEffect(() => {
        if (!message?.text) return;
        
        const tick = setTimeout(() => {
            if (onClose) onClose();
        }, duration);
        
        return () => clearTimeout(tick);
    }, [message, onClose, duration]);

    if (!message?.text) return null;
    
    const isSuccess = message.type === 'success';

    return (
        <div style={{
            position: 'fixed', bottom: 28, left: 28, zIndex: 9999,
            display: 'flex', alignItems: 'flex-start', gap: 12,
            padding: '14px 18px',
            background: isSuccess ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
            border: `1px solid ${isSuccess ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}`,
            borderRadius: 12, maxWidth: 360, minWidth: 260,
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            backdropFilter: 'blur(12px)',
            animation: 'toastSlideIn 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards',
            fontFamily: 'Inter, sans-serif',
        }}>
            <span style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: 1 }}>{isSuccess ? '✅' : '❌'}</span>
            <span style={{ flex: 1, fontSize: '0.88rem', fontWeight: 500, color: isSuccess ? '#10b981' : '#ef4444', lineHeight: 1.4 }}>
                {message.text}
            </span>
            <button onClick={onClose} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: isSuccess ? '#10b981' : '#ef4444', padding: '0 0 0 4px', flexShrink: 0,
                fontSize: '1rem', fontWeight: 700, lineHeight: 1,
            }}>✕</button>
        </div>
    );
}
