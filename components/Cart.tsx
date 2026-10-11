'use client';
import { Minus, Plus, ShoppingBag } from 'lucide-react';
import { useCart } from './CartProvider';
import Dialog from './Dialog';
import { product, money } from '@/lib/product';
export function Quantity({ value, onChange }: { value: number; onChange: (n: number) => void }) { return <div className="quantity"><button aria-label="Decrease quantity" disabled={value <= 1} onClick={() => onChange(value - 1)}><Minus size={14}/></button><span aria-live="polite">{value}</span><button aria-label="Increase quantity" disabled={value >= 20} onClick={() => onChange(value + 1)}><Plus size={14}/></button></div>; }
export default function Cart() {
 const cart = useCart();
 return <Dialog open={cart.drawer} onClose={() => cart.setDrawer(false)} title="Shopping bag" drawer><h2 className="dialog-title">Your bag <em>({cart.quantity})</em></h2>{cart.quantity ? <><div className="cart-product"><img src={product.image} alt="AMSA Keshya Hair Oil" width="110" height="140"/><div><p className="eyebrow">AYURVEDIC HAIR CARE</p><h3>{product.name}</h3><p className="muted">{product.size} · {money(product.price)}</p><Quantity value={cart.quantity} onChange={cart.update}/><button className="text-button" onClick={cart.remove}>Remove</button></div></div><div className="cart-bottom"><p className="cart-note">A little time for yourself. A ritual to return to.</p><div className="total-row"><span>Subtotal</span><strong>{money(cart.subtotal)}</strong></div><p className="muted small">Complimentary delivery · Taxes included</p><button className="button full" onClick={() => { cart.setDrawer(false); cart.setCheckout(true); }}>Proceed to checkout</button><button className="text-button full" onClick={() => cart.setDrawer(false)}>Continue exploring</button></div></> : <div className="empty-cart"><ShoppingBag size={40} strokeWidth={1}/><h3>Your ritual begins here.</h3><p>Your bag is waiting for something thoughtful.</p><button className="button" onClick={() => { cart.setDrawer(false); const shop = document.getElementById('shop'); if (shop) shop.scrollIntoView({ behavior: 'smooth' }); else window.location.assign('/#shop'); }}>Explore Keshya</button></div>}</Dialog>;
}

