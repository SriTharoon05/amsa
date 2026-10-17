'use client';

import { useEffect, useRef, type RefObject } from 'react';
import {
  Scene, Group, Mesh, Object3D, OrthographicCamera, WebGLRenderer,
  HemisphereLight, DirectionalLight, MeshStandardMaterial, MeshPhysicalMaterial, MeshBasicMaterial,
  LatheGeometry, SplineCurve, Vector2, TorusGeometry, PlaneGeometry, CanvasTexture,
  PMREMGenerator, ACESFilmicToneMapping, SRGBColorSpace, Box3, Vector3,
  type Texture, type WebGLRenderTarget,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { ingredientCount } from '@/lib/ingredients';
import { clamp01, smoothRange, mix, getBlendFrame, getBotanicalPose } from '@/lib/journey';
import { loadBottleScene } from '@/lib/model-assets';
import { createStudioEnvironment, disposeSceneResources } from '@/lib/scene-resources';

type Props = { progress: RefObject<number>; onState: (state: 'loading' | 'ready' | 'fallback') => void };
type Botanical = { object: Object3D; angle: number; radius: number; y: number; z: number; scale: number; boundsRadius: number; index: number };

export default function JourneyScene({ progress, onState }: Props) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let renderer: WebGLRenderer;
    try { renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' }); }
    catch { onState('fallback'); return; }
    let disposed = false, loaded = false, natureReady = false, natureRequested = false, inView = true, contextHealthy = true, frame = 0;
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
    let envTarget: WebGLRenderTarget;
    try { envTarget = pmrem.fromScene(environment, .008, .1, 100, { size: lowData || window.innerWidth <= 700 ? 256 : 512 }); }
    catch { disposeSceneResources([environment]); pmrem.dispose(); renderer.dispose(); renderer.domElement.remove(); onState('fallback'); return; }
    scene.environment = envTarget.texture;
    scene.environmentIntensity = .9;
    disposeSceneResources([environment]); pmrem.dispose();

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
    let oil: Object3D | undefined;
    const loadedScenes: Object3D[] = [];

    const dropMaterial = new MeshPhysicalMaterial({ color: 0xe5a433, metalness: 0, roughness: .12, transmission: .12, thickness: .35, ior: 1.46, clearcoat: 1, clearcoatRoughness: .06 });
    const profile = new SplineCurve([[0,-.6],[.26,-.56],[.44,-.32],[.48,-.1],[.43,.14],[.3,.43],[.1,.8],[0,1.1]].map(([radius,height]) => new Vector2(radius,height))).getPoints(48);
    profile.forEach(point => { point.x = Math.max(0, point.x); });
    const drop = new Mesh(new LatheGeometry(profile, 48), dropMaterial);
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
      const blend = getBlendFrame(p);
      const finalReveal = smoothRange(p, .62, .78);
      const intro = natureReady ? 1 - smoothRange(p, .04, .20) : 1;
      const bottleReveal = p >= .62 ? .82 + .18 * finalReveal : intro;
      camera.position.y = mix(3.6, .7, bottleReveal); camera.lookAt(0, 0, 0);
      backdrop.position.copy(camera.position).addScaledVector(camera.getWorldDirection(cameraDirection), 20);
      backdrop.quaternion.copy(camera.quaternion);
      botanicals.visible = natureReady && p > .04 && p < .51;
      botanicals.rotation.y = p * 1.1 + x * .08;
      // A Y-axis orbit preserves the tested vertical clearance above the vessel.
      botanicals.rotation.z = 0;
      items.forEach(item => {
        const pose = getBotanicalPose(p, item);
        item.object.position.set(pose.x, pose.y, pose.z);
        item.object.rotation.set(item.index * .63 + p * 2, pose.angle + p, item.index * .31 + blend.gather * 1.8);
        const emerge = smoothRange(p, .04, .20);
        item.object.scale.setScalar(Math.max(.001, pose.scale * emerge));
        item.object.visible = pose.visible;
      });
      const vesselShow = natureReady ? blend.scale : 0;
      blending.visible = vesselShow > .001;
      blending.scale.setScalar(Math.max(.001, vesselShow));
      blending.position.set(0, blend.y, 0);
      blending.rotation.y = p * 1.5;
      if (oil) oil.scale.setScalar(.6 + smoothRange(p, .28, .52) * .4);
      ripples.forEach((ring, i) => { ring.scale.setScalar(.9 + Math.sin(p * 36 + i * 2) * .08); });
      drop.visible = natureReady && p > .47 && p < .62;
      const droplet = smoothRange(p, .47, .55) * (1 - smoothRange(p, .60, .62));
      drop.scale.set(.72 * droplet, 1.06 * droplet, .72 * droplet);
      drop.position.y = mix(.05, .25, smoothRange(p, .49, .60));
      drop.rotation.z = -.1 + p * .15;
      bottle.visible = bottleReveal > 0;
      bottle.scale.setScalar(Math.max(.001, bottleReveal * (1 + finalReveal * .08)));
      bottle.position.set(0, mix(-.5, .03, bottleReveal), 0);
      bottle.rotation.set(.02 + y * .05, mix(-.75, -.04, bottleReveal) + x * .11, -.025);
      halo.rotation.z = -.33 + p * .8;
      ringMaterial.opacity = .24 * (1 - smoothRange(p, .25, .56)) + .12 * smoothRange(p, .86, 1);
      shadow.scale.setScalar(bottleReveal > .5 ? .72 : vesselShow);
      shadow.position.y = bottleReveal > .5 ? bottle.position.y - 1.8 * bottle.scale.x - .04 : blend.y - .26 * vesselShow;
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
    const invalidate = () => { if (loaded && !natureRequested && progress.current > .03 && inView) requestNature(); if (!frame && loaded && inView && contextHealthy && !document.hidden) frame = requestAnimationFrame(draw); };
    const resize = () => {
      const { width, height } = element.getBoundingClientRect();
      if (!width || !height) return;
      const mobile = window.innerWidth <= 700;
      fullPixelRatio = lowData ? 1 : Math.min(window.devicePixelRatio || 1, 2);
      activePixelRatio = fullPixelRatio; renderer.setPixelRatio(fullPixelRatio);
      renderer.setSize(width, height);
      // Fit both dimensions, including tall tablets with a narrow art column.
      const halfHeight = Math.max(mobile ? 2.45 : 3.0, 2.65 * height / width);
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
    // A lost context also loses the baked studio environment; retain the readable fallback.
    const contextRestored = () => { if (!disposed) onState('fallback'); };
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
      if (disposed) { disposeSceneResources([asset.scene]); throw new Error('Scene disposed'); }
      loadedScenes.push(asset.scene); return asset;
    });
    const prepareTextures = (assets: Object3D[]) => {
      const textures = new Set<Texture>();
      assets.forEach(asset => asset.traverse(child => {
        if (!(child instanceof Mesh)) return;
        (Array.isArray(child.material) ? child.material : [child.material]).forEach(material => Object.values(material).forEach(value => { if (value && typeof value === 'object' && 'isTexture' in value) textures.add(value as Texture); }));
      }));
      textures.forEach(texture => { texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); texture.needsUpdate = true; if (contextHealthy) renderer.initTexture(texture); });
    };
    function requestNature() {
      if (natureRequested || disposed) return;
      natureRequested = true;
      loadAsset('/models/botanicals.glb?rev=3').then(async nature => {
      if (disposed) return;
      for (let i = 1; i <= ingredientCount; i++) {
        const object = nature.scene.getObjectByName(`Ingredient_${String(i).padStart(2, '0')}`);
        if (!object) throw new Error(`Missing botanical ${i}`);
        botanicals.add(object);
        const hero = [1, 26, 52].includes(i);
        const angle = i * 2.399963;
        items.push({ object, angle, radius: hero ? 1.1 : 1.0 + (i % 7) * .18, y: Math.sin(angle) * (hero ? 1.25 : 1.75), z: hero ? .9 : Math.cos(i * .93) * .35, scale: hero ? 1.65 : .63 + (i % 5) * .10, boundsRadius: new Box3().setFromObject(object).getSize(new Vector3()).length() / 2, index: i });
      }
      const vessel = nature.scene.getObjectByName('Vessel'); oil = nature.scene.getObjectByName('Oil');
      if (!vessel || !oil) throw new Error('Incomplete botanical assets');
      blending.add(vessel, oil); oil.position.y = .235;
      oil.traverse(object => { if (object instanceof Mesh) {
        const old = Array.isArray(object.material) ? object.material : [object.material];
        object.material = new MeshPhysicalMaterial({color:0xc79232,roughness:.16,metalness:0,clearcoat:.8,clearcoatRoughness:.09});
        old.forEach(material=>material.dispose());
      }});
      prepareTextures([nature.scene, botanicals, blending]);
      botanicals.visible = blending.visible = true;
      if (contextHealthy) await renderer.compileAsync(scene, camera);
      if (disposed || !contextHealthy) return;
      natureReady = true; invalidate();
      }).catch(() => { if (!disposed) { natureReady = false; botanicals.visible = blending.visible = drop.visible = false; invalidate(); } });
    }
    loadBottleScene().then(async product => {
      if (disposed) { disposeSceneResources([product]); return; }
      loadedScenes.push(product);
      const productRoot = product.getObjectByName('KeshyaBottle');
      if (!productRoot) throw new Error('Incomplete bottle');
      bottle.add(productRoot);
      const center = new Box3().setFromObject(productRoot).getCenter(new Vector3()); productRoot.position.sub(center);
      prepareTextures([bottle]);
      if (contextHealthy) await renderer.compileAsync(scene, camera);
      if (disposed || !contextHealthy) return;
      loaded = true; current = progress.current;
      if (contextHealthy) { updateScene(current); onState('ready'); invalidate(); }
    }).catch(() => { if (!disposed) onState('fallback'); });

    return () => {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); visibility.disconnect();
      window.removeEventListener('amsa:journey', invalidate); document.removeEventListener('visibilitychange', invalidate); reduceMotion.removeEventListener('change', invalidate);
      element.removeEventListener('pointermove', pointer); element.removeEventListener('pointerleave', resetPointer);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost); renderer.domElement.removeEventListener('webglcontextrestored', contextRestored);
      disposeSceneResources([scene, ...loadedScenes]); envTarget.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    };
  }, [progress, onState]);
  return <div className="journey-canvas" ref={host}/>;
}

