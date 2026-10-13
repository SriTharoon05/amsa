'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Leaf, RotateCcw } from 'lucide-react';

const ProductScene = dynamic(() => import('./ProductScene'), { ssr: false });

export type ProductModelState = 'loading' | 'ready' | 'fallback';

export default function ProductModel() {
  const host = useRef<HTMLDivElement>(null);
  const [load, setLoad] = useState(false);
  const [state, setState] = useState<ProductModelState>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    if (!('IntersectionObserver' in window)) {
      setLoad(true);
      return;
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setLoad(true);
        observer.disconnect();
      }
    }, { rootMargin: '200px 0px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <div className="product-model" ref={host} data-state={state} role="group" aria-label="Explore the Keshya Hair Oil bottle">
    <div className="product-model-heading"><span>THE DAILY RITUAL</span><span>100 ML / KESHYA</span></div>
    <div className="product-model-shadow" aria-hidden="true"/>
    <div className="product-model-placeholder" aria-hidden="true">
      <div className="product-model-placeholder-cap"/>
      <div className="product-model-placeholder-body">
        <div className="product-model-placeholder-label"><Leaf size={24} strokeWidth={1}/><b>AMSA</b><span>AYURVEDIC</span><i>Keshya<br/>Hair Oil</i><small>100 ml</small></div>
      </div>
    </div>
    {load && <ProductScene key={attempt} onState={setState}/>}
    {state === 'fallback' && <div className="product-model-unavailable" role="status">
      <p>The 3D view is unavailable on this device.</p>
      <button type="button" onClick={() => { setState('loading'); setAttempt(value => value + 1); }}><RotateCcw size={13}/> Try again</button>
    </div>}
    <p className="product-model-loading" role="status">{state === 'loading' ? 'Preparing your bottle…' : ''}</p>
    <span className="sr-only">{state === 'ready' ? '3D bottle ready. Drag sideways, or focus the bottle and use the left and right arrow keys to rotate it. Press Home to return to the front.' : ''}</span>
  </div>;
}
