'use client';
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowUpRight, Menu, X, ShoppingBag, Leaf, Check } from 'lucide-react';
import { useCart } from './CartProvider';
const Cart = dynamic(() => import('./Cart'));
const Checkout = dynamic(() => import('./Checkout'));

export function Mark({ light=false }: {light?:boolean}) {
 return <Link href="/" className={`wordmark ${light?'wordmark-light':''}`} aria-label="AMSA Ayurvedic home">AMSA<span>AYURVEDIC</span></Link>;
}
export function SiteHeader() {
 const cart=useCart(); const [menu,setMenu]=useState(false);
 useEffect(()=>{if(!menu)return;const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setMenu(false);};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[menu]);
 return <><div className="announcement"><Leaf size={12}/><span>A little nature. A little time for you.</span><span className="announcement-right">KESHYA · 100 ML</span></div><header className="site-header"><div className="header-inner"><Mark/><nav className="desktop-nav" aria-label="Main navigation"><Link href="/#shop">The hair oil</Link><Link href="/ingredients">Our ingredients</Link><Link href="/#ritual">Your ritual</Link><Link href="/#story">Our philosophy</Link></nav><div className="header-actions"><button className="bag-button" onClick={()=>{setMenu(false);cart.setDrawer(true);}} aria-label={`Open shopping bag, ${cart.quantity} items`}><ShoppingBag size={19} strokeWidth={1.5}/><span className="bag-word">Bag</span><span className="cart-badge" aria-live="polite">{cart.quantity}</span></button><button className="menu-button icon-button" aria-label={menu?'Close navigation':'Open navigation'} aria-expanded={menu} aria-controls="mobile-navigation" onClick={()=>setMenu(!menu)}>{menu?<X size={22}/>:<Menu size={22}/>}</button></div></div>{menu&&<nav id="mobile-navigation" className="mobile-nav" aria-label="Mobile navigation">{[['The hair oil','/#shop'],['Our ingredients','/ingredients'],['Your ritual','/#ritual'],['Our philosophy','/#story']].map(([text,href])=><Link key={href} href={href} onClick={()=>setMenu(false)}>{text}<ArrowUpRight size={18}/></Link>)}</nav>}</header></>;
}
export function ShopDialogs() {
 const cart=useCart();
 // The checkout and drawer bundles are requested only when opened.
 return <>{cart.drawer&&<Cart/>}{cart.checkout&&<Checkout/>}</>;
}
export function SiteFooter() {
 const [subscribed,setSubscribed]=useState(false);
 return <footer className="site-footer"><div className="footer-top"><div><p className="eyebrow">LET GOOD THINGS TAKE ROOT</p><h2>A little closer<br/>to <em>nature.</em></h2></div><div className="newsletter">{subscribed?<div className="newsletter-confirmation" role="status"><Check size={23}/><div><strong>You’re on the list.</strong><p>Demo signup complete. Your email hasn’t been stored.</p></div></div>:<><p>Notes on nature, thoughtful rituals<br/>and making a little time for yourself.</p><form onSubmit={e=>{e.preventDefault();setSubscribed(true);}}><label className="sr-only" htmlFor="newsletter-email">Email address</label><input id="newsletter-email" type="email" required placeholder="Your email address" autoComplete="email"/><button aria-label="Join the newsletter" type="submit">Join us <ArrowUpRight size={18}/></button></form><small>A preview signup. No emails are sent.</small></>}</div></div><div className="footer-links"><Link href="/#shop">Shop Keshya <ArrowUpRight size={13}/></Link><Link href="/ingredients">The ingredient index <ArrowUpRight size={13}/></Link><Link href="/#ritual">The daily ritual <ArrowUpRight size={13}/></Link><a href="#top">Back to top ↑</a></div><div className="footer-bigmark" aria-hidden="true">AMSA<span>✳</span></div><div className="footer-bottom"><span>© {new Date().getFullYear()} AMSA Ayurvedic</span><span>The essence of nature.</span><span>Frontend store preview · No real orders</span></div></footer>;
}
export function PageShell({children}:{children:ReactNode}) {return <><a className="skip-link" href="#main-content">Skip to content</a><div id="top"/><SiteHeader/>{children}<SiteFooter/><ShopDialogs/></>;}

