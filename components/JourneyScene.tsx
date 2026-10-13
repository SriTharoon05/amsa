'use client';

import { useEffect, useRef, type RefObject } from 'react';
import {
  Scene, Group, Mesh, Object3D, OrthographicCamera, WebGLRenderer,
  HemisphereLight, DirectionalLight, MeshStandardMaterial, MeshBasicMaterial,
  SphereGeometry, TorusGeometry, PlaneGeometry, CanvasTexture,
  PMREMGenerator, ACESFilmicToneMapping, SRGBColorSpace, Box3, Vector3,
  type Material, type Texture, type BufferGeometry,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ingredientCount } from '@/lib/ingredients';
import { clamp01, smoothRange } from '@/lib/journey';

type Props = { progress: RefObject<number>; onState: (state: 'loading' | 'ready' | 'fallback') => void };
type Botanical = { object: Object3D; angle: number; radius: number; y: number; z: number; scale: number; index: number };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export default function JourneyScene({ progress, onState }: Props) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let renderer: WebGLRenderer;
    try { renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' }); }
    catch { onState('fallback'); return; }
    let disposed = false, loaded = false, inView = true, contextHealthy = true, frame = 0;
    let current = progress.current, pointerX = 0, pointerY = 0, x = 0, y = 0;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const lowData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    const scene = new Scene();
    const world = new Group(); scene.add(world);
    const camera = new OrthographicCamera(-3, 3, 3, -3, .1, 50);
    camera.position.set(0, 2.5, 11); camera.lookAt(0, 0, 0);
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setClearColor(0x000000, 0);
    element.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-hidden', 'true');
    scene.add(new HemisphereLight(0xfff5dc, 0x757958, 2.3));
    const key = new DirectionalLight(0xfff2d6, 3.1); key.position.set(-4, 6, 7); scene.add(key);
    const rim = new DirectionalLight(0xf9ffea, 2.0); rim.position.set(4, 2, -2); scene.add(rim);
    const environment = new RoomEnvironment();
    const pmrem = new PMREMGenerator(renderer);
    const envTarget = pmrem.fromScene(environment, .04);
    scene.environment = envTarget.texture;
    environment.dispose(); pmrem.dispose();

    const botanicals = new Group(); world.add(botanicals);
    const bottle = new Group(); world.add(bottle);
    const blending = new Group(); world.add(blending);
    const items: Botanical[] = [];
    let cap: Object3D | undefined, oil: Object3D | undefined;
    const loadedScenes: Object3D[] = [];

    const dropMaterial = new MeshStandardMaterial({ color: 0xdba035, metalness: .45, roughness: .16 });
    const drop = new Mesh(new SphereGeometry(.49, 32, 24), dropMaterial);
    drop.scale.set(.7, 1.22, .7); world.add(drop);
    const ringMaterial = new MeshBasicMaterial({ color: 0xa0a582, transparent: true, opacity: .25, depthWrite: false });
    const halo = new Mesh(new TorusGeometry(2.23, .007, 4, 128), ringMaterial);
    halo.rotation.set(.18, .4, -.33); world.add(halo);
    const rippleMaterial = new MeshStandardMaterial({ color: 0xebc478, metalness: .6, roughness: .18, transparent: true, opacity: .65 });
    const ripples = [0, 1, 2].map(i => {
      const ring = new Mesh(new TorusGeometry(.45 + i * .3, .012, 5, 64), rippleMaterial);
      ring.rotation.x = -Math.PI / 2; ring.position.y = .25; blending.add(ring); return ring;
    });

    // A tiny procedural contact shadow avoids costly real-time shadow passes.
    const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 128;
    const ctx = shadowCanvas.getContext('2d');
    if (ctx) { const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64); gradient.addColorStop(0, 'rgba(75,60,24,.28)'); gradient.addColorStop(1, 'rgba(75,60,24,0)'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128); }
    const shadowTexture = new CanvasTexture(shadowCanvas);
    const shadow = new Mesh(new PlaneGeometry(3.5, 2.0), new MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = -1.85; world.add(shadow);

    const updateScene = (value: number) => {
      const p = reduceMotion.matches ? Math.round(value * 4) / 4 : value;
      const gather = smoothRange(p, .18, .46);
      const dissolve = smoothRange(p, .40, .57);
      const bottleReveal = smoothRange(p, .64, .82);
      const capClose = smoothRange(p, .77, .92);
      botanicals.rotation.y = p * 1.1 + x * .08;
      botanicals.rotation.z = mix(-.17, .12, gather);
      items.forEach(item => {
        const angle = item.angle + p * 2.1 + gather * 4.5;
        const radius = item.radius * (1 - gather * .89);
        item.object.position.set(Math.cos(angle) * radius, mix(item.y, -.84 + Math.sin(angle) * .17, gather), Math.sin(angle) * radius * .48 + item.z * (1 - gather));
        item.object.rotation.set(item.index * .63 + p * 2, angle + p, item.index * .31 + gather * 1.8);
        const scale = item.scale * (1 - dissolve);
        item.object.scale.setScalar(Math.max(.001, scale));
        item.object.visible = dissolve < .999;
      });
      blending.visible = p > .13 && p < .75;
      const vesselShow = smoothRange(p, .13, .31) * (1 - smoothRange(p, .61, .75));
      blending.scale.setScalar(Math.max(.001, vesselShow));
      blending.position.set(0, mix(-1.3, -.43, smoothRange(p, .3, .55)), 0);
      blending.rotation.y = p * 1.5;
      if (oil) oil.scale.setScalar(.6 + smoothRange(p, .28, .52) * .4);
      ripples.forEach((ring, i) => { ring.scale.setScalar(.9 + Math.sin(p * 36 + i * 2) * .08); });
      drop.visible = p > .47 && p < .76;
      const droplet = smoothRange(p, .47, .59) * (1 - smoothRange(p, .66, .76));
      drop.scale.set(.66 * droplet, 1.32 * droplet, .66 * droplet);
      drop.position.y = mix(.15, .9, smoothRange(p, .49, .66));
      drop.rotation.z = -.1 + p * .15;
      bottle.visible = bottleReveal > 0;
      bottle.scale.setScalar(Math.max(.001, bottleReveal * (1 + smoothRange(p, .84, 1) * .18)));
      bottle.position.set(0, mix(-.7, .03, bottleReveal), 0);
      bottle.rotation.set(.03 + y * .07, mix(-.75, -.08, bottleReveal) + x * .11, mix(-.13, -.045, capClose));
      if (cap) cap.position.y = (1 - capClose) * .72;
      halo.rotation.z = -.33 + p * .8;
      ringMaterial.opacity = .24 * (1 - smoothRange(p, .25, .56)) + .12 * smoothRange(p, .86, 1);
      shadow.scale.setScalar(bottleReveal > .5 ? .72 : vesselShow);
      world.rotation.y = x * .045; world.rotation.x = y * .025;
      renderer.render(scene, camera);
    };
    const draw = () => {
      frame = 0;
      if (disposed || !loaded || !inView || !contextHealthy || document.hidden) return;
      const target = clamp01(progress.current);
      current = reduceMotion.matches ? target : mix(current, target, .18);
      const targetX = reduceMotion.matches ? 0 : pointerX, targetY = reduceMotion.matches ? 0 : pointerY;
      x = mix(x, targetX, .13);
      y = mix(y, targetY, .13);
      updateScene(current);
      if (Math.abs(current - target) > .00015 || Math.abs(x - targetX) > .001 || Math.abs(y - targetY) > .001) frame = requestAnimationFrame(draw);
    };
    const invalidate = () => { if (!frame && loaded && inView && contextHealthy && !document.hidden) frame = requestAnimationFrame(draw); };
    const resize = () => {
      const { width, height } = element.getBoundingClientRect();
      if (!width || !height) return;
      const mobile = window.innerWidth <= 700;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowData ? 1 : mobile ? 1.25 : 1.5));
      renderer.setSize(width, height);
      // Fit both dimensions, including tall tablets with a narrow art column.
      const halfHeight = Math.max(mobile ? 2.55 : 3.0, 2.85 * height / width);
      camera.left = -halfHeight * width / height; camera.right = -camera.left;
      camera.top = halfHeight; camera.bottom = -halfHeight; camera.updateProjectionMatrix();
      invalidate();
    };
    const pointer = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || reduceMotion.matches) return;
      const rect = element.getBoundingClientRect();
      pointerX = clamp01((event.clientX - rect.left) / rect.width) - .5;
      pointerY = clamp01((event.clientY - rect.top) / rect.height) - .5;
      invalidate();
    };
    const resetPointer = () => { pointerX = pointerY = 0; invalidate(); };
    const contextLost = (event: Event) => { event.preventDefault(); contextHealthy = false; cancelAnimationFrame(frame); frame = 0; onState('fallback'); };
    const contextRestored = () => { if (!disposed) { contextHealthy = true; if (loaded) onState('ready'); invalidate(); } };
    const observer = new ResizeObserver(resize); observer.observe(element);
    const visibility = new IntersectionObserver(entries => { inView = entries[0].isIntersecting; if (inView) invalidate(); else { cancelAnimationFrame(frame); frame = 0; } }); visibility.observe(element);
    window.addEventListener('amsa:journey', invalidate);
    document.addEventListener('visibilitychange', invalidate);
    reduceMotion.addEventListener('change', invalidate);
    element.addEventListener('pointermove', pointer); element.addEventListener('pointerleave', resetPointer);
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    renderer.domElement.addEventListener('webglcontextrestored', contextRestored);
    resize();

    const loader = new GLTFLoader();
    const loadAsset = (url: string) => loader.loadAsync(url).then(asset => {
      if (disposed) { disposeResources([asset.scene]); throw new Error('Scene disposed'); }
      loadedScenes.push(asset.scene); return asset;
    });
    Promise.all([loadAsset('/models/botanicals.glb'), loadAsset('/models/keshya.glb')]).then(([nature, product]) => {
      if (disposed) { disposeResources(loadedScenes); return; }
      for (let i = 1; i <= ingredientCount; i++) {
        const object = nature.scene.getObjectByName(`Ingredient_${String(i).padStart(2, '0')}`);
        if (!object) throw new Error(`Missing botanical ${i}`);
        botanicals.add(object);
        const hero = [1, 26, 52].includes(i);
        const angle = i * 2.399963;
        items.push({ object, angle, radius: hero ? 1.1 : 1.0 + (i % 7) * .18, y: Math.sin(angle) * (hero ? 1.25 : 2.15), z: hero ? .9 : Math.cos(i * .93) * .35, scale: hero ? 1.65 : .63 + (i % 5) * .10, index: i });
      }
      const vessel = nature.scene.getObjectByName('Vessel'); oil = nature.scene.getObjectByName('Oil');
      const productRoot = product.scene.getObjectByName('KeshyaBottle');
      if (!vessel || !oil || !productRoot) throw new Error('Incomplete journey assets');
      blending.add(vessel, oil); oil.position.y = .235;
      bottle.add(productRoot); cap = productRoot.getObjectByName('BottleCap');
      // Center the complete silhouette without cropping or hiding label/cap parts.
      const center = new Box3().setFromObject(productRoot).getCenter(new Vector3()); productRoot.position.sub(center);
      loaded = true; current = progress.current;
      if (contextHealthy) { updateScene(current); onState('ready'); invalidate(); }
    }).catch(() => { if (!disposed) onState('fallback'); });

    return () => {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); visibility.disconnect();
      window.removeEventListener('amsa:journey', invalidate); document.removeEventListener('visibilitychange', invalidate); reduceMotion.removeEventListener('change', invalidate);
      element.removeEventListener('pointermove', pointer); element.removeEventListener('pointerleave', resetPointer);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost); renderer.domElement.removeEventListener('webglcontextrestored', contextRestored);
      disposeResources([scene, ...loadedScenes]); envTarget.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    };
  }, [progress, onState]);
  return <div className="journey-canvas" ref={host}/>;
}

function disposeResources(objects: Object3D[]) {
  const geometries = new Set<BufferGeometry>(), materials = new Set<Material>(), textures = new Set<Texture>();
  objects.forEach(object => object.traverse(child => {
    if (!(child instanceof Mesh)) return;
    geometries.add(child.geometry);
    (Array.isArray(child.material) ? child.material : [child.material]).forEach(material => {
      materials.add(material);
      Object.values(material).forEach(value => { if (value && typeof value === 'object' && 'isTexture' in value) textures.add(value as Texture); });
    });
  }));
  textures.forEach(texture => { const source = texture.source?.data as { close?: () => void } | undefined; if (typeof source?.close === 'function') source.close(); texture.dispose(); });
  materials.forEach(material => material.dispose()); geometries.forEach(geometry => geometry.dispose());
}
