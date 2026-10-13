'use client';

import { useEffect, useRef, type RefObject } from 'react';
import {
  Scene, Group, Mesh, Object3D, OrthographicCamera, WebGLRenderer,
  HemisphereLight, DirectionalLight, MeshStandardMaterial, MeshPhysicalMaterial, MeshBasicMaterial,
  LatheGeometry, Vector2, TorusGeometry, PlaneGeometry, CanvasTexture, Color,
  PMREMGenerator, ACESFilmicToneMapping, SRGBColorSpace, Box3, Vector3,
  type Material, type Texture, type BufferGeometry,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
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
    try { renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' }); }
    catch { onState('fallback'); return; }
    let disposed = false, loaded = false, inView = true, contextHealthy = true, frame = 0;
    let current = progress.current, pointerX = 0, pointerY = 0, x = 0, y = 0;
    let fullPixelRatio = 1, activePixelRatio = 1, slowFrames = 0, lastFrameTime = 0;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const lowData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    const scene = new Scene();
    const world = new Group(); scene.add(world);
    const camera = new OrthographicCamera(-3, 3, 3, -3, .1, 50);
    camera.position.set(0, 3.6, 11); camera.lookAt(0, 0, 0);
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.setClearColor(0x000000, 0);
    element.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-hidden', 'true');
    scene.add(new HemisphereLight(0xfff8ed, 0x555d42, .85));
    const key = new DirectionalLight(0xfff8eb, 2.4); key.position.set(-4, 6, 7); scene.add(key);
    const rim = new DirectionalLight(0xfffdf3, 1.6); rim.position.set(4, 2, -2); scene.add(rim);
    const environment = createStudioEnvironment();
    const pmrem = new PMREMGenerator(renderer);
    const envTarget = pmrem.fromScene(environment, .008, .1, 100, { size: lowData ? 256 : 512 });
    scene.environment = envTarget.texture;
    scene.environmentIntensity = .9;
    disposeResources([environment]); pmrem.dispose();

    // An opaque studio backdrop gives clear glass a real surface to refract.
    // Its edge color matches the page, preserving the continuous cream canvas.
    const backdropCanvas = document.createElement('canvas'); backdropCanvas.width = backdropCanvas.height = 256;
    const backdropCtx = backdropCanvas.getContext('2d');
    if (backdropCtx) {
      const gradient = backdropCtx.createRadialGradient(128, 128, 5, 128, 128, 125);
      gradient.addColorStop(0, '#e3e1d1'); gradient.addColorStop(1, '#f4f0e6');
      backdropCtx.fillStyle = gradient; backdropCtx.fillRect(0, 0, 256, 256);
    }
    const backdropTexture = new CanvasTexture(backdropCanvas); backdropTexture.colorSpace = SRGBColorSpace;
    const backdrop = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: backdropTexture, toneMapped: false }));
    const cameraDirection = new Vector3(); scene.add(backdrop);

    const botanicals = new Group(); world.add(botanicals);
    const bottle = new Group(); world.add(bottle);
    const blending = new Group(); world.add(blending);
    const items: Botanical[] = [];
    let cap: Object3D | undefined, oil: Object3D | undefined;
    const loadedScenes: Object3D[] = [];

    const dropMaterial = new MeshPhysicalMaterial({ color: 0xf5b83f, metalness: 0, roughness: .075, transmission: .4, thickness: .35, ior: 1.46, clearcoat: 1, clearcoatRoughness: .035 });
    const drop = new Mesh(new LatheGeometry([[0,-.6],[.26,-.56],[.44,-.32],[.48,-.1],[.43,.14],[.3,.43],[.1,.8],[0,1.1]].map(([radius,height]) => new Vector2(radius,height)), 48), dropMaterial);
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
      camera.position.y = mix(3.6, .8, bottleReveal); camera.lookAt(0, 0, 0);
      backdrop.position.copy(camera.position).addScaledVector(camera.getWorldDirection(cameraDirection), 20);
      backdrop.quaternion.copy(camera.quaternion);
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
      shadow.position.y = bottleReveal > .5 ? bottle.position.y - 1.8 * bottle.scale.x - .04 : -1.85;
      world.rotation.y = x * .045; world.rotation.x = y * .025;
      renderer.render(scene, camera);
    };
    const draw = (time = performance.now()) => {
      frame = 0;
      if (disposed || !loaded || !inView || !contextHealthy || document.hidden) return;
      const target = clamp01(progress.current);
      current = reduceMotion.matches ? target : mix(current, target, .18);
      const targetX = reduceMotion.matches ? 0 : pointerX, targetY = reduceMotion.matches ? 0 : pointerY;
      x = mix(x, targetX, .13);
      y = mix(y, targetY, .13);
      updateScene(current);
      const moving = Math.abs(current - target) > .00015 || Math.abs(x - targetX) > .001 || Math.abs(y - targetY) > .001;
      if (moving) {
        if (lastFrameTime && time - lastFrameTime > 30) slowFrames++; else slowFrames = Math.max(0, slowFrames - 1);
        if (slowFrames >= 8 && activePixelRatio > 1.25) {
          activePixelRatio = Math.max(1.25, activePixelRatio - .25); renderer.setPixelRatio(activePixelRatio);
          renderer.transmissionResolutionScale = .8; slowFrames = 0;
        }
        lastFrameTime = time; frame = requestAnimationFrame(draw);
      } else {
        lastFrameTime = 0; slowFrames = 0;
        // Restore native display resolution for the settled product close-up.
        if (activePixelRatio !== fullPixelRatio || renderer.transmissionResolutionScale !== 1) {
          activePixelRatio = fullPixelRatio; renderer.setPixelRatio(fullPixelRatio);
          renderer.transmissionResolutionScale = 1; updateScene(current);
        }
      }
    };
    const invalidate = () => { if (!frame && loaded && inView && contextHealthy && !document.hidden) frame = requestAnimationFrame(draw); };
    const resize = () => {
      const { width, height } = element.getBoundingClientRect();
      if (!width || !height) return;
      const mobile = window.innerWidth <= 700;
      fullPixelRatio = lowData ? 1 : Math.min(window.devicePixelRatio || 1, 3);
      activePixelRatio = fullPixelRatio; renderer.setPixelRatio(fullPixelRatio);
      renderer.setSize(width, height);
      // Fit both dimensions, including tall tablets with a narrow art column.
      const halfHeight = Math.max(mobile ? 2.55 : 3.0, 2.85 * height / width);
      camera.left = -halfHeight * width / height; camera.right = -camera.left;
      camera.top = halfHeight; camera.bottom = -halfHeight; camera.updateProjectionMatrix();
      backdrop.scale.set(halfHeight * width / height * 2.01, halfHeight * 2.01, 1);
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

    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const loadAsset = (url: string) => loader.loadAsync(url).then(asset => {
      if (disposed) { disposeResources([asset.scene]); throw new Error('Scene disposed'); }
      loadedScenes.push(asset.scene); return asset;
    });
    Promise.all([loadAsset('/models/botanicals.glb?rev=2'), loadAsset('/models/keshya.glb?rev=2')]).then(async ([nature, product]) => {
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
      // Preserve all native texture pixels and keep lettering crisp at oblique angles.
      const textures = new Set<Texture>();
      loadedScenes.forEach(asset => asset.traverse(child => {
        if (!(child instanceof Mesh)) return;
        (Array.isArray(child.material) ? child.material : [child.material]).forEach(material => {
          Object.values(material).forEach(value => { if (value && typeof value === 'object' && 'isTexture' in value) textures.add(value as Texture); });
        });
      }));
      textures.forEach(texture => {
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); texture.needsUpdate = true;
        if (contextHealthy) renderer.initTexture(texture);
      });
      // Center the complete silhouette without cropping or hiding label/cap parts.
      const center = new Box3().setFromObject(productRoot).getCenter(new Vector3()); productRoot.position.sub(center);
      // Prepare the glass and textured botanical shaders before scroll reveals them.
      if (contextHealthy) await renderer.compileAsync(scene, camera);
      if (disposed) return;
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

function createStudioEnvironment() {
  const studio = new Scene(); studio.background = new Color(0x797c73);
  const panels: [number, number, number, number, number, number][] = [
    [-4, 1.2, 4, 1.05, 6, 5], [4, .8, 3.5, .7, 5.5, 4],
    [-1.6, 5, -1, 4, 2, 3], [0, 1, -5, 3.3, 4.8, 2.5],
    [0, 5.5, 1.5, 4.5, 2.5, 2],
  ];
  panels.forEach(([x, y, z, width, height, intensity]) => {
    const panel = new Mesh(new PlaneGeometry(width, height), new MeshBasicMaterial({ color: new Color(0xfff9ef).multiplyScalar(intensity), toneMapped: false }));
    panel.position.set(x, y, z); panel.lookAt(0, 0, 0); studio.add(panel);
  });
  // Dark flags between softboxes produce the narrow edge reflections of glass.
  [-1, 1].forEach(side => {
    const flag = new Mesh(new PlaneGeometry(1.4, 7), new MeshBasicMaterial({ color: 0x1c211b, toneMapped: false }));
    flag.position.set(side * 3.8, 1, -.2); flag.lookAt(0, 0, 0); studio.add(flag);
  });
  return studio;
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
