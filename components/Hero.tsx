'use client';
import { useRef, useState, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { MoveDown } from 'lucide-react';
gsap.registerPlugin(useGSAP, ScrollTrigger);
const layers = ['/isolated_background.png', '/isolated_bottle.png', '/foreground-complete.png'];
export default function Hero() {
 const root = useRef<HTMLElement>(null);
 const [layered, setLayered] = useState(false);
 useEffect(() => {
  let active = true;
  Promise.all(layers.map(src => new Promise<void>((resolve, reject) => {
   const image = new Image(); image.onload = () => resolve(); image.onerror = reject; image.src = src;
  }))).then(() => { if (active) setLayered(true); }).catch(() => {});
  return () => { active = false; };
 }, []);
 useGSAP(() => {
  const media = gsap.matchMedia();
  media.add({ motion: '(prefers-reduced-motion: no-preference)', mobile: '(max-width: 700px)' }, context => {
   const { motion, mobile } = context.conditions!;
   if (!motion) return;
   const timeline = gsap.timeline({ defaults: { ease: 'none', duration: 1 }, scrollTrigger: {
    id: 'amsa-hero', trigger: root.current, start: 'top top', end: () => `+=${window.innerHeight * 1.6}`,
    pin: true, scrub: true, anticipatePin: 1, invalidateOnRefresh: true,
   } });
   // Bounded local layers keep the bottle's full silhouette visible throughout the scroll.
   if (layered) {
    timeline.fromTo('.hero-backdrop', { y: 0, scale: 1 }, { y: -12, scale: 1.025 }, 0)
     .fromTo('.product-float', { y: mobile ? 12 : 24, scale: .88, rotation: -4 }, { y: mobile ? -12 : -30, scale: 1, rotation: 2 }, 0)
     .fromTo('.foreground-float', { y: 0, scale: .96 }, { y: mobile ? 28 : 65, scale: 1.04 }, 0);
   } else timeline.fromTo('.hero-source', { scale: 1 }, { scale: 1.035 }, 0);
   timeline.to('.hero-opening', { autoAlpha: 0, y: -28, duration: .23 }, .12)
    .fromTo('.hero-reveal', { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: .3 }, .42)
    .fromTo('.hero-reveal .herb-line', { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: .2 }, .66)
    .fromTo('.scroll-line', { scaleY: 0 }, { scaleY: 1 }, 0);
  });
  return () => media.revert();
 }, { scope: root, dependencies: [layered], revertOnUpdate: true });
 return <section ref={root} className="hero" id="home" aria-label="Discover Keshya Hair Oil">
  <div className={`hero-art ${layered ? 'ready' : ''}`} aria-hidden="true">
   <img className="hero-source" src="/image_1.png" alt="" fetchPriority="high" width="1086" height="1448"/>
   {layered && <><div className="hero-backdrop"/><div className="product-stage">
    <div className="product-float"><img src="/isolated_bottle.png" alt="" width="1086" height="1448"/></div>
    <div className="foreground-float"><img src="/foreground-complete.png" alt=""/></div>
   </div></>}
  </div>
  <div className="hero-shade"/>
  <div className="hero-copy">
   <div className="hero-opening">
    <p className="eyebrow hero-eyebrow"><span className="tiny-rule"/>WISDOM, ROOTED IN NATURE</p>
    <h1>A return to<br/>your <em>roots.</em></h1>
    <p className="hero-description">Ancient wisdom. Everyday care.<br/>Meet a hair ritual that brings you back to yourself.</p>
    <a className="button" href="#shop">Discover Keshya</a>
    <span className="hero-caption">18 Ayurvedic herbs. One thoughtful ritual.</span>
   </div>
   <div className="hero-reveal">
    <p className="eyebrow">AMSA Ayurvedic.</p><h2>Keshya<br/><em>Hair Oil.</em></h2>
    <p className="herb-line">Infused with 18 Ayurvedic Herbs<br/>& Fresh Coconut Oil.</p>
    <a className="text-link" href="#shop">Find your daily ritual</a>
   </div>
  </div>
  <div className="hero-bottom"><span className="scroll-cue"><MoveDown size={16} strokeWidth={1}/>SCROLL TO UNWIND</span><span>THE ESSENCE OF NATURE · 100 ML</span></div>
  <div className="scene-progress"><span className="scroll-line"/></div>
 </section>;
}
