export const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
export const smoothRange = (value: number, start: number, end: number) => { const t=clamp01((value-start)/(end-start)); return t*t*(3-2*t); };
export const getJourneyProgress = (scroll: number, top: number, height: number, viewport: number) => clamp01((scroll-top)/Math.max(1,height-viewport));
export const getJourneyChapter = (progress: number) => Math.min(4, Math.round(clamp01(progress) * 4));

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** All blend props share this frame; ingredients dissolve above the oil surface. */
export function getBlendFrame(progress: number) {
  const p = clamp01(progress);
  const scale = smoothRange(p, .25, .36) * (1 - smoothRange(p, .55, .62));
  const y = mix(-1.15, -.62, smoothRange(p, .28, .43));
  return { scale, y, surface: y + .35 * scale, gather: smoothRange(p, .26, .45), dissolve: smoothRange(p, .34, .50) };
}

export function getBotanicalPose(p: number, item: { angle: number; radius: number; y: number; z: number; scale: number; boundsRadius: number }) {
  const blend = getBlendFrame(p);
  const angle = item.angle + p * 2.1 + blend.gather * 4.5;
  const radius = item.radius * (1 - blend.gather * .9);
  const scale = item.scale * (1 - blend.dissolve);
  const y = mix(item.y, blend.surface + .20, blend.gather);
  return {
    x: Math.cos(angle) * radius,
    y: blend.scale > .001 ? Math.max(y, blend.surface + item.boundsRadius * scale + .045) : y,
    z: Math.sin(angle) * radius * .48 + item.z * (1 - blend.gather),
    angle, scale, visible: scale > .008 && p > .04 && p < .51,
  };
}
