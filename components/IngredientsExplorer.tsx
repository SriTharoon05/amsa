'use client';
import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Search, X, LayoutGrid, List, ShoppingBag, Flower2, Leaf, Droplets } from 'lucide-react';
import { ingredientCount, ingredientRanges as ranges, filterIngredients, type IngredientRange } from '@/lib/ingredients';
import { CartProvider, useCart } from './CartProvider';
import Cart from './Cart';
import Checkout from './Checkout';

gsap.registerPlugin(useGSAP);

function IngredientDirectory() {
  const root = useRef<HTMLDivElement>(null);
  const index = useRef<HTMLElement>(null);
  const cart = useCart();
  const [query, setQuery] = useState('');
  const [range, setRange] = useState<IngredientRange>('All ingredients');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [sort, setSort] = useState<'original' | 'alphabetical'>('original');
  const filtered = useMemo(() => filterIngredients(query, range, sort), [query, range, sort]);

  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('.directory-enter', { y: 28, autoAlpha: 0, stagger: .1, duration: .8, ease: 'power3.out' });
      gsap.from('.formulation-orbit', { rotation: -12, scale: .92, duration: 1.2, ease: 'power3.out' });
      gsap.to('.formulation-orbit', { rotation: 360, duration: 120, repeat: -1, ease: 'none' });
    });
    return () => media.revert();
  }, { scope: root });

  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('.botanical-card', { y: 18, autoAlpha: 0, duration: .4,
        stagger: { each: .025, amount: .5 }, ease: 'power2.out', clearProps: 'transform,opacity,visibility' });
    });
    return () => media.revert();
  }, { scope: index, dependencies: [query, range, sort, view], revertOnUpdate: true });

  const reset = () => { setQuery(''); setRange('All ingredients'); };
  return <div ref={root} className="ingredients-page">
    <a className="skip-link" href="#ingredient-index">Skip to ingredient list</a>
    <header className="directory-header">
      <Link href="/#ingredients" className="directory-back">Back to the ritual</Link>
      <Link href="/" className="wordmark" aria-label="AMSA home">AMSA<span>AYURVEDIC</span></Link>
      <button className="cart-toggle" onClick={() => cart.setDrawer(true)} aria-label={`Open shopping bag, ${cart.quantity} items`}>
        <ShoppingBag size={19} strokeWidth={1.3}/><span className="cart-label">Bag</span><span className="cart-badge" aria-live="polite">{cart.quantity}</span>
      </button>
    </header>
    <main>
      <section className="directory-intro" aria-labelledby="formulation-title">
        <div className="directory-intro-copy">
          <p className="directory-kicker directory-enter"><span/>THE KESHYA FORMULATION</p>
          <h1 id="formulation-title" className="directory-enter">Nature has<br/><em>many names.</em></h1>
          <p className="directory-intro-text directory-enter">{ingredientCount} thoughtfully chosen ingredients.<br/>One ritual, rooted in nature.</p>
          <a href="#ingredient-index" className="directory-explore directory-enter">Explore the complete formulation <span>{ingredientCount}</span></a>
        </div>
        <div className="formulation-seal directory-enter" aria-hidden="true">
          <div className="formulation-orbit"/>
          <span className="seal-top">THE ESSENCE OF NATURE</span>
          <span className="seal-number">{ingredientCount}<span>✦</span></span>
          <span className="seal-bottom">INGREDIENTS · ONE RITUAL</span>
        </div>
        <div className="directory-intro-bottom"><span>THE COMPLETE INGREDIENT INDEX</span><span>AMSA AYURVEDIC / KESHYA</span></div>
      </section>

      <section ref={index} id="ingredient-index" className="ingredient-index" aria-labelledby="index-title">
        <div className="index-heading"><div><p className="eyebrow">EVERY NAME. EVERY INGREDIENT.</p><h2 id="index-title">A closer look<br/><em>at what goes in.</em></h2></div><p>Discover the complete list.<br/>Search a name, or simply take your time.</p></div>
        <div className="directory-controls">
          <div className="ingredient-search"><Search size={19} strokeWidth={1.4} aria-hidden="true"/><label className="sr-only" htmlFor="ingredient-search">Search ingredients</label><input id="ingredient-search" type="search" autoComplete="off" placeholder="Search ingredients by name…" value={query} onChange={e => setQuery(e.target.value)}/>{query && <button onClick={() => setQuery('')} aria-label="Clear ingredient search"><X size={18}/></button>}</div>
          <div className="directory-sort"><label htmlFor="ingredient-sort" className="sr-only">Sort ingredients</label><select id="ingredient-sort" value={sort} onChange={e => setSort(e.target.value as typeof sort)}><option value="original">Formulation order</option><option value="alphabetical">Alphabetical A–Z</option></select></div>
          <div className="directory-view" role="group" aria-label="Ingredient display"><button aria-label="Card view" aria-pressed={view === 'grid'} onClick={() => setView('grid')}><LayoutGrid size={18}/></button><button aria-label="List view" aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={19}/></button></div>
        </div>
        <div className="directory-filter-row"><div className="directory-ranges" role="group" aria-label="Filter by first letter">{ranges.map(item => <button key={item} aria-pressed={range === item} onClick={() => setRange(item)}>{item}</button>)}</div><p className="directory-result-count" role="status" aria-live="polite">{filtered.length} of {ingredientCount} ingredients</p></div>

        {filtered.length ? <ol className={`botanical-results ${view === 'list' ? 'is-list' : ''}`} aria-label="Keshya ingredients">{filtered.map(item => <li className="botanical-card" key={item.id}>
          <div className="botanical-card-top"><span className="botanical-number">{String(item.id).padStart(2, '0')}</span><span className="botanical-symbol" aria-hidden="true">{item.id % 3 === 0 ? <Flower2 size={24} strokeWidth={1}/> : item.id % 3 === 1 ? <Leaf size={24} strokeWidth={1}/> : <Droplets size={24} strokeWidth={1}/>}</span></div>
          <div className="botanical-name"><h3 aria-label={item.name}><span>{item.genus}</span>{item.detail && <em>{item.detail}</em>}</h3></div>
          <div className="botanical-card-foot"><span>AMSA · KESHYA</span><span className="botanical-letter" aria-hidden="true">{item.initial}</span></div>
        </li>)}</ol> : <div className="directory-empty"><Search size={30} strokeWidth={1}/><h3>No ingredients found.</h3><p>Try a different name or reset the filters.</p><button className="button" onClick={reset}>Show all ingredients</button></div>}

        <div className="formulation-note"><span className="note-flower" aria-hidden="true">✦</span><p>All {ingredientCount} ingredient names, thoughtfully brought together in Keshya Hair Oil.</p></div>
      </section>
      <section className="directory-return"><p className="eyebrow">FROM NATURE, TO YOUR EVERYDAY.</p><h2>A little care.<br/><em>A beautiful ritual.</em></h2><Link className="button" href="/#shop">Discover Keshya Hair Oil</Link></section>
    </main>
    <footer className="directory-footer"><Link href="/" className="footer-logo">AMSA</Link><p>Rooted in nature. Made for you.</p><Link href="/#shop">Return to the oil</Link></footer>
    <Cart/><Checkout/>
  </div>;
}

export default function IngredientsExplorer() { return <CartProvider><IngredientDirectory/></CartProvider>; }
