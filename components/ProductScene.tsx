'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';
import {
  Scene, Group, Mesh, OrthographicCamera, WebGLRenderer, HemisphereLight,
  DirectionalLight, MeshBasicMaterial, PlaneGeometry, PMREMGenerator, Color,
  ACESFilmicToneMapping, SRGBColorSpace, Box3, Vector3,
  type Object3D, type Texture, type WebGLRenderTarget,
} from 'three';
import { loadBottleScene } from '@/lib/model-assets';
import { createStudioEnvironment, disposeSceneResources } from '@/lib/scene-resources';
import type { ProductModelState } from './ProductModel';

type Props = { onState: (state: ProductModelState) => void };
type Controls = { rotate: (direction: number) => void; reset: () => void };

export default function ProductScene({ onState }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const controls = useRef<Controls | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let renderer: WebGLRenderer;
    try { renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'default' }); }
    catch { onState('fallback'); return; }

    let disposed = false, loaded = false, inView = false, contextHealthy = true, frame = 0;
    let angle = 0, tiltX = 0, tiltY = 0;
    let drag: { id: number; x: number; y: number; angle: number; active: boolean; touch: boolean } | null = null;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const lowData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    const scene = new Scene();
    const bottle = new Group();
    scene.add(bottle);
    const camera = new OrthographicCamera(-2, 2, 2.2, -2.2, .1, 40);
    camera.position.set(0, .7, 11);
    camera.lookAt(0, 0, 0);
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.transmissionResolutionScale = window.innerWidth <= 700 ? .8 : 1;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.setAttribute('aria-hidden', 'true');
    element.appendChild(renderer.domElement);

    scene.add(new HemisphereLight(0xfff8ef, 0x60644b, .75));
    const key = new DirectionalLight(0xfff9ef, 2.2);
    key.position.set(-4, 5, 6);
    scene.add(key);
    const rim = new DirectionalLight(0xfff8e6, 1.1);
    rim.position.set(4, 2, -3);
    scene.add(rim);
    let studio: Scene | undefined;
    let pmrem: PMREMGenerator | undefined;
    let environment: WebGLRenderTarget | undefined;
    try {
      studio = createStudioEnvironment();
      pmrem = new PMREMGenerator(renderer);
      environment = pmrem.fromScene(studio, .012, .1, 40, { size: lowData || window.innerWidth <= 700 ? 256 : 512 });
      scene.environment = environment.texture;
      scene.environmentIntensity = .85;
    } catch {
      environment?.dispose();
      disposeSceneResources([scene]);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      setReady(false);
      onState('fallback');
      return;
    } finally {
      if (studio) disposeSceneResources([studio]);
      pmrem?.dispose();
    }

    // Physical amber glass needs an opaque surface behind it for refraction.
    const backdrop = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ color: new Color('#eee9dc'), toneMapped: false }));
    backdrop.position.copy(camera.position).addScaledVector(camera.getWorldDirection(new Vector3()), 17);
    backdrop.quaternion.copy(camera.quaternion);
    scene.add(backdrop);
    const ownedAssets: Object3D[] = [];

    const draw = () => {
      frame = 0;
      if (disposed || !loaded || !inView || !contextHealthy || document.hidden) return;
      bottle.rotation.set(tiltY, angle + tiltX, 0);
      renderer.render(scene, camera);
    };
    const invalidate = () => {
      if (!frame && loaded && inView && contextHealthy && !document.hidden) frame = window.requestAnimationFrame(draw);
    };
    const resize = () => {
      const { width, height } = element.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setPixelRatio(lowData ? 1 : Math.min(window.devicePixelRatio || 1, window.innerWidth <= 700 ? 1.5 : 2));
      renderer.setSize(width, height, false);
      const halfHeight = Math.max(2.2, 1.1 * height / width);
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      camera.left = -halfHeight * width / height;
      camera.right = -camera.left;
      camera.updateProjectionMatrix();
      backdrop.scale.set((camera.right - camera.left) * 1.02, halfHeight * 2.02, 1);
      const rect = element.getBoundingClientRect();
      inView = rect.bottom > 0 && rect.top < window.innerHeight;
      invalidate();
    };
    const resetHover = () => { tiltX = tiltY = 0; invalidate(); };
    const rotate = (direction: number) => { angle += direction * Math.PI / 8; resetHover(); };
    const reset = () => { angle = 0; resetHover(); };
    controls.current = { rotate, reset };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        rotate(event.key === 'ArrowLeft' ? -1 : 1);
      } else if (event.key === 'Home') { event.preventDefault(); reset(); }
    };
    const pointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || !loaded) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, angle, active: false, touch: event.pointerType === 'touch' };
      resetHover();
      if (event.pointerType === 'mouse') element.setPointerCapture(event.pointerId);
    };
    const pointerMove = (event: PointerEvent) => {
      if (drag && event.pointerId === drag.id) {
        const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
        // Let vertical touch gestures scroll the page without rotating the model.
        if (!drag.active && drag.touch && Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { drag = null; return; }
        if (!drag.active && Math.abs(dx) > 8 && (!drag.touch || Math.abs(dx) > Math.abs(dy))) {
          drag.active = true;
          element.setPointerCapture(event.pointerId);
          element.dataset.dragging = 'true';
        }
        if (drag.active) { angle = drag.angle + dx * .012; invalidate(); }
      } else if (event.pointerType === 'mouse' && !reduceMotion.matches) {
        const rect = element.getBoundingClientRect();
        tiltX = ((event.clientX - rect.left) / rect.width - .5) * .12;
        tiltY = ((event.clientY - rect.top) / rect.height - .5) * .04;
        invalidate();
      }
    };
    const pointerUp = (event: PointerEvent) => {
      if (drag?.id === event.pointerId) drag = null;
      delete element.dataset.dragging;
      if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
    };
    const pointerLeave = () => { if (!drag?.active) { drag = null; resetHover(); } };
    const visibilityChange = () => {
      if (document.hidden) { window.cancelAnimationFrame(frame); frame = 0; }
      else invalidate();
    };
    const motionChange = () => { if (reduceMotion.matches) resetHover(); };
    const contextLost = (event: Event) => {
      event.preventDefault();
      contextHealthy = false;
      window.cancelAnimationFrame(frame);
      frame = 0;
      setReady(false);
      onState('fallback');
    };
    const contextRestored = () => {
      if (disposed) return;
      // Restored targets no longer contain the baked studio reflections.
      // The retry action remounts the viewer and rebuilds the environment.
      contextHealthy = false;
      setReady(false);
      onState('fallback');
    };
    const sizeObserver = new ResizeObserver(resize);
    sizeObserver.observe(element);
    const visibilityObserver = new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      if (inView) invalidate();
      else { window.cancelAnimationFrame(frame); frame = 0; }
    });
    visibilityObserver.observe(element);
    document.addEventListener('visibilitychange', visibilityChange);
    reduceMotion.addEventListener('change', motionChange);
    element.addEventListener('keydown', keyboard);
    element.addEventListener('pointerdown', pointerDown);
    element.addEventListener('pointermove', pointerMove);
    element.addEventListener('pointerup', pointerUp);
    element.addEventListener('pointercancel', pointerUp);
    element.addEventListener('lostpointercapture', pointerUp);
    element.addEventListener('pointerleave', pointerLeave);
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    renderer.domElement.addEventListener('webglcontextrestored', contextRestored);
    resize();

    loadBottleScene().then(async asset => {
      if (disposed) { disposeSceneResources([asset]); return; }
      ownedAssets.push(asset);
      if (!asset.getObjectByName('KeshyaBottle')) throw new Error('Bottle model is incomplete');
      bottle.add(asset);
      const bounds = new Box3().setFromObject(asset);
      const center = bounds.getCenter(new Vector3());
      const height = bounds.getSize(new Vector3()).y;
      asset.position.sub(center);
      if (height > 0) bottle.scale.setScalar(3.6 / height);
      const textures = new Set<Texture>();
      asset.traverse(object => {
        if (!(object instanceof Mesh)) return;
        (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => {
          Object.values(material).forEach(value => {
            if (value && typeof value === 'object' && 'isTexture' in value) textures.add(value as Texture);
          });
        });
      });
      textures.forEach(texture => {
        texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
        texture.needsUpdate = true;
        if (contextHealthy) renderer.initTexture(texture);
      });
      if (contextHealthy) await renderer.compileAsync(scene, camera);
      if (disposed) return;
      loaded = true;
      if (contextHealthy) { draw(); setReady(true); onState('ready'); invalidate(); }
    }).catch(() => { if (!disposed) { setReady(false); onState('fallback'); } });

    return () => {
      disposed = true;
      controls.current = null;
      window.cancelAnimationFrame(frame);
      sizeObserver.disconnect();
      visibilityObserver.disconnect();
      document.removeEventListener('visibilitychange', visibilityChange);
      reduceMotion.removeEventListener('change', motionChange);
      element.removeEventListener('keydown', keyboard);
      element.removeEventListener('pointerdown', pointerDown);
      element.removeEventListener('pointermove', pointerMove);
      element.removeEventListener('pointerup', pointerUp);
      element.removeEventListener('pointercancel', pointerUp);
      element.removeEventListener('lostpointercapture', pointerUp);
      element.removeEventListener('pointerleave', pointerLeave);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', contextRestored);
      // Cached source bitmaps belong to the shared asset loader, not this viewer.
      disposeSceneResources([scene, ...ownedAssets]);
      environment?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [onState]);

  return <>
    <div className="product-model-canvas" ref={host} tabIndex={ready ? 0 : -1} role="img" aria-label="Interactive AMSA Keshya Hair Oil bottle. Use left or right arrow keys to turn. Press Home to reset."/>
    <div className="product-model-controls" hidden={!ready}>
      <span>Drag sideways to explore</span>
      <div>
        <button type="button" aria-label="Turn bottle left" onClick={() => controls.current?.rotate(-1)}><ArrowLeft size={15}/></button>
        <button type="button" aria-label="Return bottle to front view" onClick={() => controls.current?.reset()}><RotateCcw size={15}/></button>
        <button type="button" aria-label="Turn bottle right" onClick={() => controls.current?.rotate(1)}><ArrowRight size={15}/></button>
      </div>
    </div>
  </>;
}
