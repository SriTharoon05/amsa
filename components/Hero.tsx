'use client';
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowDown, ArrowUpRight, Leaf } from 'lucide-react';
import { ingredientCount } from '@/lib/ingredients';
import { getJourneyProgress, getJourneyChapter, smoothRange } from '@/lib/journey';
const JourneyScene = dynamic(() => import('./JourneyScene'), { ssr: false });
const chapters = ['The roots', 'The botanicals', 'The blend', 'The transformation', 'Your ritual'];
function BotanicalFallback() {
 return <div className="journey-fallback" aria-hidden="true"><div className="fallback-orbit"/>
 <svg className="fallback-botanical" viewBox="0 0 460 540" fill="none"><path d="M226 455C278 337 167 192 266 75" stroke="#677047" strokeWidth="3"/>{[0,1,2,3,4].map(i => <g key={i} transform={`translate(${226 + Math.sin(i)*22} ${390-i*60}) rotate(${i%2 ? -45 : 40})`}><path d="M0 0C-95-8-112-66-104-108C-41-86 3-47 0 0Z" fill={i%2 ? '#76825b' : '#a0aa7f'}/><path d="M0 0L-89-92" stroke="#455535" strokeWidth="1"/></g>)}<circle cx="328" cy="353" r="33" fill="#a26d46"/><circle cx="328" cy="353" r="26" fill="#faf4e6"/><g transform="translate(115 195)">{[0,1,2,3,4].map(i => <ellipse key={i} rx="15" ry="40" cy="-25" fill="#9a4947" transform={`rotate(${i*72})`}/>)}<circle r="9" fill="#d8b66c"/></g></svg>
 <div className="fallback-bottle"><div className="fallback-cap"/><div className="fallback-body"><div className="fallback-label"><Leaf size={28} strokeWidth={1}/><b>AMSA</b><span>AYURVEDIC</span><i>Keshya<br/>Hair Oil</i><small>100 ml</small></div></div></div></div>;
}
export default function Hero() {
 const root=useRef<HTMLElement>(null), stage=useRef<HTMLDivElement>(null), progress=useRef(0);
 const [chapter,setChapter]=useState(0), [sceneState,setSceneState]=useState<'loading'|'ready'|'fallback'>('loading'), [loadScene,setLoadScene]=useState(false);
 useEffect(() => {
  const schedule=window.setTimeout(()=>setLoadScene(true),80);
  let frame=0, top=0, height=0, viewport=0;
  const update=()=>{progress.current=getJourneyProgress(window.scrollY,top,height,viewport);setChapter(previous=>{const next=getJourneyChapter(progress.current);return previous===next?previous:next;});stage.current?.style.setProperty('--journey-progress',String(progress.current));stage.current?.style.setProperty('--bottle-reveal',String(Math.min(1,1-smoothRange(progress.current,.04,.20)+smoothRange(progress.current,.64,.78))));window.dispatchEvent(new Event('amsa:journey'));frame=0;};
  const measure=()=>{if(!root.current||!stage.current)return;const rect=root.current.getBoundingClientRect();top=rect.top+window.scrollY;height=rect.height;viewport=stage.current.getBoundingClientRect().height+parseFloat(getComputedStyle(stage.current).top);update();};
  const onScroll=()=>{if(!frame)frame=window.requestAnimationFrame(update);};
  const resize=new ResizeObserver(measure);if(root.current)resize.observe(root.current);if(stage.current)resize.observe(stage.current);
  window.addEventListener('scroll',onScroll,{passive:true});window.addEventListener('resize',measure,{passive:true});window.visualViewport?.addEventListener('resize',measure);measure();
  return()=>{clearTimeout(schedule);cancelAnimationFrame(frame);resize.disconnect();window.removeEventListener('scroll',onScroll);window.removeEventListener('resize',measure);window.visualViewport?.removeEventListener('resize',measure);};
 },[]);
 const jumpToChapter=(event:React.MouseEvent<HTMLAnchorElement>,index:number)=>{event.preventDefault();if(!root.current||!stage.current)return;const top=root.current.getBoundingClientRect().top+window.scrollY;const viewport=stage.current.getBoundingClientRect().height+parseFloat(getComputedStyle(stage.current).top);window.scrollTo({top:top+(root.current.offsetHeight-viewport)*index/4,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};
 const articleProps=(index:number)=>({'aria-hidden':chapter!==index,inert:chapter!==index,'data-active':chapter===index});
 return <section className="journey" id="home" ref={root} aria-label="From nature to Keshya: an illustrated journey">
 <div className="journey-markers" aria-hidden="true">{chapters.map((name,i)=><span key={name} id={`journey-${i+1}`} style={{top:`calc((100% - var(--journey-viewport)) * ${i/4})`}}/>)}</div>
 <div ref={stage} className="journey-stage" data-scene-state={sceneState} data-chapter={chapter}><div className="journey-aura"/>
 <div className="journey-chapters">
 <article className="journey-chapter journey-opening" {...articleProps(0)}><div className="journey-copy"><p className="eyebrow"><span/>THE ESSENCE OF NATURE</p><h1>Good things<br/>begin at the<br/><em>roots.</em></h1><p className="journey-description">The Keshya hair oil journey.<br/>A world of botanicals. A moment for you.</p><a className="journey-text-link" href="#journey-2" onClick={event=>jumpToChapter(event,1)}>Follow the journey <ArrowDown size={15}/></a></div></article>
 <article className="journey-chapter" {...articleProps(1)}><div className="journey-copy"><p className="eyebrow">01 / THE BOTANICALS</p><h2>Many origins.<br/><em>One intention.</em></h2><p className="journey-description">Leaves, flowers, roots and seeds.<br/>{ingredientCount} ingredients, each with a place in the Keshya formulation.</p><div className="journey-stat"><strong>{ingredientCount}</strong><span>INGREDIENTS<br/>OPENLY SHARED</span></div><Link className="journey-text-link" href="/ingredients">Meet every ingredient <ArrowUpRight size={16}/></Link></div></article>
 <article className="journey-chapter" {...articleProps(2)}><div className="journey-copy"><p className="eyebrow">02 / THE BLEND</p><h2>Nature finds<br/>its <em>flow.</em></h2><p className="journey-description">Coconut and a constellation of botanicals.<br/>A golden composition, imagined in motion.</p><div className="journey-formula"><span>{ingredientCount} ingredients</span><span>+</span><span>One daily ritual</span></div><p className="journey-small-note">An artistic interpretation of the formulation.</p></div></article>
 <article className="journey-chapter" {...articleProps(3)}><div className="journey-copy"><p className="eyebrow">03 / THE TRANSFORMATION</p><h2>A little nature.<br/><em>Beautifully held.</em></h2><p className="journey-description">Meet Keshya — AMSA’s Ayurvedic hair oil.<br/>Made for the quiet moments of everyday care.</p><span className="journey-product-mark">AMSA <span>AYURVEDIC</span></span></div></article>
 <article className="journey-chapter journey-finale" {...articleProps(4)}><div className="journey-copy"><p className="eyebrow">04 / YOUR RITUAL</p><h2>Back to nature.<br/><em>Back to you.</em></h2><p className="journey-description">Warm a little oil. Slow your breath.<br/>A simple massage. A moment of connection.</p><a className="button" href="#shop">Discover Keshya <ArrowUpRight size={17}/></a><span className="journey-finale-note">KESHYA HAIR OIL · 100 ML</span></div></article>
 </div>
 <div className="journey-art" aria-hidden="true"><BotanicalFallback/>{loadScene&&<JourneyScene progress={progress} onState={setSceneState}/>}<div className="journey-art-caption"><span className="journey-dot"/>A BOTANICAL COMPOSITION<span>AMSA · 01—52</span></div></div>
 <nav className="journey-rail" aria-label="Journey chapters">{chapters.map((name,i)=><a key={name} href={`#journey-${i+1}`} onClick={event=>jumpToChapter(event,i)} className={chapter===i?'active':''} aria-current={chapter===i?'step':undefined}><span>0{i+1}</span><span>{name}</span></a>)}</nav><div className="journey-scroll-note"><ArrowDown size={14}/> SCROLL TO DISCOVER<span>{String(chapter+1).padStart(2,'0')} / 05</span></div>
 </div></section>;
}
