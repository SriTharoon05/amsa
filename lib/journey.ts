export const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
export const smoothRange = (value: number, start: number, end: number) => { const t=clamp01((value-start)/(end-start)); return t*t*(3-2*t); };
export const getJourneyProgress = (scroll: number, top: number, height: number, viewport: number) => clamp01((scroll-top)/Math.max(1,height-viewport));
export const getJourneyChapter = (progress: number) => Math.min(4,Math.floor(clamp01(progress)*4+.42));
