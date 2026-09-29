'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
export default function Dialog({ open, onClose, title, children, drawer = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; drawer?: boolean }) {
 const ref = useRef<HTMLDialogElement>(null);
 const closeRef = useRef(onClose); closeRef.current = onClose;
 useEffect(() => { const dialog = ref.current; if (!dialog) return; if (!open) { if (dialog.open) dialog.close(); return; } const previous = document.activeElement as HTMLElement | null; dialog.showModal(); const old = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { dialog.close(); document.body.style.overflow = old; previous?.focus(); }; }, [open]);
 return <dialog ref={ref} aria-label={title} className={drawer ? 'cart-dialog' : 'checkout-dialog'} onCancel={e => { e.preventDefault(); closeRef.current(); }} onClick={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeRef.current(); } }}><div className="dialog-head"><span className="eyebrow">AMSA · YOUR RITUAL</span><button className="icon-button" onClick={onClose} aria-label={`Close ${title}`}><X size={22}/></button></div>{children}</dialog>;
}
