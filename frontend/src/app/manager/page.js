/**
 * page.js — Manager redirect to dashboard (/manager)
 */
'use client';
import { useEffect } from 'react';
export default function ManagerPage() {
    useEffect(() => { window.location.href = '/manager/dashboard'; }, []);
    return null;
}
