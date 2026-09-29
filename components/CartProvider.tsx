'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { product } from '@/lib/product';
type CartState = { quantity: number; subtotal: number; drawer: boolean; checkout: boolean; add: (n?: number) => void; update: (n: number) => void; remove: () => void; setDrawer: (open: boolean) => void; setCheckout: (open: boolean) => void };
const CartContext = createContext<CartState | null>(null);
export function CartProvider({ children }: { children: ReactNode }) {
  const [quantity, setQuantity] = useState(0);
  const [ready, setReady] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [checkout, setCheckout] = useState(false);
  useEffect(() => { try { const n = Number(localStorage.getItem('amsa-cart-v1')); if (Number.isInteger(n) && n >= 0 && n <= 20) setQuantity(n); } catch {} setReady(true); }, []);
  useEffect(() => { if (ready) try { localStorage.setItem('amsa-cart-v1', String(quantity)); } catch {} }, [quantity, ready]);
  const update = (n: number) => setQuantity(Math.max(0, Math.min(20, Math.floor(Number.isFinite(n) ? n : 0))));
  const add = (n = 1) => { setQuantity(q => Math.min(20, q + Math.max(1, Math.floor(Number.isFinite(n) ? n : 1)))); setDrawer(true); };
  return <CartContext.Provider value={{ quantity, subtotal: quantity * product.price, drawer, checkout, add, update, remove: () => update(0), setDrawer, setCheckout }}>{children}</CartContext.Provider>;
}
export function useCart() { const cart = useContext(CartContext); if (!cart) throw new Error('CartProvider is required'); return cart; }
