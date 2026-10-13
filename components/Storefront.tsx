'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Check, Droplets, Flower2, Leaf, Menu, Plus, ShoppingBag, X } from 'lucide-react';
import { CartProvider, useCart } from './CartProvider';
import Cart, { Quantity } from './Cart';
import Checkout from './Checkout';
import Hero from './Hero';
import { ingredientCount } from '@/lib/ingredients';
import { money, product } from '@/lib/product';

function Header() {
  const cart = useCart();
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    if (!menu) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [menu]);

  return <>
    <header className="header storefront-header">
      <nav className="desktop-nav" aria-label="Main navigation">
        <a href="#shop">The oil</a>
        <Link href="/ingredients">The ingredients</Link>
      </nav>
      <button className="mobile-menu icon-button" aria-label={menu ? 'Close navigation' : 'Open navigation'} aria-expanded={menu} aria-controls="storefront-mobile-nav" onClick={() => setMenu(!menu)}>
        {menu ? <X size={19} strokeWidth={1.4}/> : <Menu size={19} strokeWidth={1.4}/>}
      </button>
      <a className="wordmark" href="#home" aria-label="AMSA Ayurvedic home">AMSA<span>AYURVEDIC</span></a>
      <div className="header-right">
        <a href="#ritual" className="ritual-link">The ritual</a>
        <button className="cart-toggle" onClick={() => { setMenu(false); cart.setDrawer(true); }} aria-label={`Open shopping bag, ${cart.quantity} items`}>
          <ShoppingBag size={18} strokeWidth={1.4}/>
          <span className="cart-label">Bag</span>
          <span className="cart-badge" aria-live="polite">{cart.quantity}</span>
        </button>
      </div>
    </header>
    {menu && <nav id="storefront-mobile-nav" className="mobile-nav" aria-label="Mobile navigation">
      <a href="#shop" onClick={() => setMenu(false)}>The oil <ArrowUpRight size={18}/></a>
      <Link href="/ingredients" onClick={() => setMenu(false)}>The ingredients <ArrowUpRight size={18}/></Link>
      <a href="#ritual" onClick={() => setMenu(false)}>The ritual <ArrowUpRight size={18}/></a>
      <span>THE ESSENCE OF NATURE</span>
    </nav>}
  </>;
}

function Product() {
  const cart = useCart();
  const [quantity, setQuantity] = useState(1);

  return <section className="product-section section-pad" id="shop" aria-labelledby="product-title">
    <div className="product-portrait section-reveal">
      <div className="portrait-topline"><span>THE DAILY RITUAL</span><span>01 / KESHYA</span></div>
      <img src={product.image} alt="AMSA Keshya Hair Oil in an amber glass bottle, with a bowl of botanicals" loading="lazy" decoding="async" width={1086} height={1448}/>
      <div className="portrait-bottomline"><span>NATURE, IN YOUR HANDS.</span><span>{product.size}</span></div>
    </div>
    <div className="product-details section-reveal">
      <p className="eyebrow"><span className="editorial-dot"/> THE JOURNEY BECOMES A RITUAL</p>
      <h2 id="product-title">A little oil.<br/><em>A little you.</em></h2>
      <p className="product-intro">Leave a little space in your day. For slow fingertips, a gentle massage, and a moment that belongs to you.</p>
      <div className="product-name"><h3>Keshya Hair Oil</h3><span>{product.size} / 3.38 fl oz</span></div>
      <p className="muted">{ingredientCount} ingredients. One considered hair-care ritual.</p>
      <div className="price-row"><strong>{money(product.price)}</strong><span>Inclusive of all taxes</span></div>
      <div className="buy-row">
        <Quantity value={quantity} onChange={setQuantity}/>
        <button className="button" onClick={() => cart.add(quantity)}>Add to bag <ArrowUpRight size={18} strokeWidth={1.4}/></button>
      </div>
      <p className="delivery-note"><Check size={14}/> Complimentary delivery across India</p>
      <div className="product-accordions">
        <details><summary>Every ingredient, by name <Plus size={16}/></summary><p>Explore the complete list of {ingredientCount} ingredients supplied for Keshya.<br/><Link className="text-link" href="/ingredients">See all ingredients <ArrowUpRight size={14}/></Link></p></details>
        <details><summary>Your moment of care <Plus size={16}/></summary><p>Warm a small amount between your palms and gently massage into your scalp and hair. Follow the product label for application and rinsing. Patch test before first use and avoid contact with eyes.</p></details>
        <details><summary>Delivery & storage <Plus size={16}/></summary><p>Complimentary standard delivery is included in this demo. Store upright in a cool, dry place, away from direct sunlight. Shipping times and return terms will be confirmed when the store launches.</p></details>
      </div>
    </div>
  </section>;
}

const botanicalPreview = [
  { number: '01', title: 'Sesamum indicum', common: 'Sesame', copy: 'A small seed. A familiar botanical name. Discover sesame in the complete Keshya ingredient list.', icon: Leaf, className: 'sesamum' },
  { number: '26', title: 'Hibiscus rosa-sinensis', common: 'Hibiscus', copy: 'A flower with unmistakable character. One of the many botanical names in the Keshya collection.', icon: Flower2, className: 'hibiscus' },
  { number: '52', title: 'Cocos nucifera', common: 'Coconut', copy: 'The familiar coconut, with a place in the formulation. Explore its name alongside every other ingredient.', icon: Droplets, className: 'coconut' },
] as const;

function Ingredients() {
  return <section id="ingredients" className="ingredients section-pad" aria-labelledby="botanical-title">
    <div className="section-heading section-reveal">
      <div><p className="eyebrow">A BOTANICAL INDEX</p><h2 id="botanical-title">Many beginnings.<br/><em>One Keshya.</em></h2></div>
      <div className="ingredients-heading-note"><span>{ingredientCount}</span><p>Individual ingredients.<br/>Every name, openly shared.</p></div>
    </div>
    <div className="ingredient-grid">
      {botanicalPreview.map(({ number, title, common, copy, icon: Icon, className }) => <article className={`ingredient-card ${className} section-reveal`} key={number}>
        <div className="ingredient-top"><span>INDEX / {number}</span><Icon size={22} strokeWidth={1}/></div>
        <div className="botanical-art" aria-hidden="true"><Icon strokeWidth={0.55}/><span>{number}</span></div>
        <p className="eyebrow">{common}</p>
        <h3>{title}</h3>
        <p>{copy}</p>
      </article>)}
    </div>
    <div className="ingredient-preview-action section-reveal">
      <p>A closer look at everything that goes in.</p>
      <Link className="text-link" href="/ingredients">See all ingredients <span className="ingredient-cta-count">{ingredientCount}</span><ArrowUpRight size={19}/></Link>
    </div>
  </section>;
}

const ritualSteps = [
  ['01', 'Make a little space.', 'Find a comfortable moment. Pour a small amount of oil into your palms and gently rub them together.'],
  ['02', 'Slow your fingertips.', 'Massage your scalp with gentle, circular movements. Work through your hair, taking your time.'],
  ['03', 'Return to your day.', 'Follow the product label for how long to leave the oil and how to rinse. Make care a moment you can return to.'],
] as const;

function Ritual() {
  return <section id="ritual" className="ritual section-pad" aria-labelledby="ritual-title">
    <div className="ritual-intro section-reveal">
      <p className="eyebrow">THE ART OF TAKING YOUR TIME</p>
      <h2 id="ritual-title">Care is<br/><em>a quiet thing.</em></h2>
      <p>No grand gestures. Just a few thoughtful minutes, and a little room to breathe.</p>
      <div className="ritual-signature"><Leaf size={22} strokeWidth={0.8}/><span>A MOMENT, JUST FOR YOU</span></div>
    </div>
    <div className="ritual-steps">
      {ritualSteps.map(([number, title, copy]) => <div className="ritual-step section-reveal" key={number}><span>{number}</span><div><h3>{title}</h3><p>{copy}</p></div></div>)}
      <p className="ritual-note">Patch test before first use. Avoid contact with eyes.</p>
    </div>
  </section>;
}

function Footer() {
  const [subscribed, setSubscribed] = useState(false);

  return <footer className="footer">
    <div className="footer-top section-reveal">
      <div><p className="eyebrow">FROM OUR WORLD, TO YOURS</p><h2>Stay a little<br/><em>closer to nature.</em></h2></div>
      <div className="newsletter">
        <p>Notes on botanicals, small rituals,<br/>and making a little time for yourself.</p>
        {subscribed ? <p className="newsletter-success" role="status"><Check size={18}/> Thank you. Your demo signup is complete.</p> : <form onSubmit={event => { event.preventDefault(); setSubscribed(true); }}>
          <label className="sr-only" htmlFor="newsletter-email">Email address</label>
          <input id="newsletter-email" type="email" autoComplete="email" required placeholder="Your email address"/>
          <button type="submit">Join the circle <ArrowUpRight size={18}/></button>
        </form>}
        <small>Demo signup only. Your email is not sent or stored.</small>
      </div>
    </div>
    <div className="footer-brandline" aria-hidden="true"><span>AMSA</span><Leaf strokeWidth={0.6}/></div>
    <div className="footer-bottom">
      <span>© {new Date().getFullYear()} AMSA Ayurvedic</span>
      <Link href="/ingredients">Ingredient index <ArrowUpRight size={12}/></Link>
      <a href="#shop">Discover Keshya <ArrowUpRight size={12}/></a>
      <a className="footer-return" href="#home">Back to the beginning <ArrowRight size={13}/></a>
    </div>
  </footer>;
}

function FloatingCTA() {
  const cart = useCart();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      const journey = document.getElementById('home');
      if (journey) setVisible(journey.getBoundingClientRect().bottom < 0);
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(check); };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    check();
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const open = visible && !cart.drawer && !cart.checkout;
  return <div className={`floating-cta ${open ? 'visible' : ''}`} inert={!open}>
    <div><span>Keshya Hair Oil</span><small>{product.size} · {ingredientCount} ingredients</small></div>
    <button className="button" onClick={() => cart.add()}>Add to bag — {money(product.price)} <ArrowUpRight size={16}/></button>
  </div>;
}

function PageContent() {
  const page = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = page.current;
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    const elements = root.querySelectorAll('.section-reveal');
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    root.classList.add('storefront-motion-ready');
    elements.forEach(element => observer.observe(element));
    return () => {
      observer.disconnect();
      root.classList.remove('storefront-motion-ready');
    };
  }, []);

  return <div className="storefront" ref={page}>
    <a href="#shop" className="skip-link">Skip to product</a>
    <Header/>
    <main>
      <Hero/>
      <div className="values-strip"><span><Leaf size={16} strokeWidth={1}/>{ingredientCount} ingredients</span><span><Droplets size={16} strokeWidth={1}/>Coconut oil</span><span><Flower2 size={16} strokeWidth={1}/>A botanical ritual</span><span>{product.size} of considered care</span></div>
      <Product/>
      <Ingredients/>
      <Ritual/>
    </main>
    <Footer/>
    <FloatingCTA/>
    <Cart/>
    <Checkout/>
  </div>;
}

export default function Storefront() {
  return <CartProvider><PageContent/></CartProvider>;
}
