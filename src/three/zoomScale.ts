export type ZoomLevel = {
  index: number;
  zoom: number;
  name: string;
  distance: number;
};

export const ZOOM_LEVELS: ZoomLevel[] = [
  { index: 0, zoom: 0, name: 'Earth and Moon', distance: 14 },
  { index: 1, zoom: 1, name: 'Inner Solar System', distance: 190 },
  { index: 2, zoom: 2, name: 'Outer Solar System', distance: 520 },
  { index: 3, zoom: 3, name: 'Kuiper Belt and Oort Cloud', distance: 1_250 },
  { index: 4, zoom: 4, name: 'Local Interstellar Cloud', distance: 2_900 },
  { index: 5, zoom: 5, name: 'Orion Arm', distance: 7_400 },
  { index: 6, zoom: 6, name: 'Milky Way', distance: 16_000 },
  { index: 7, zoom: 7, name: 'Local Group', distance: 36_000 },
  { index: 8, zoom: 8, name: 'Observable Universe', distance: 78_000 },
];

export const MIN_ZOOM = ZOOM_LEVELS[0].zoom;
export const MAX_ZOOM = ZOOM_LEVELS[ZOOM_LEVELS.length - 1].zoom;

export function clamp(value: number, min = MIN_ZOOM, max = MAX_ZOOM) {
  return Math.min(max, Math.max(min, value));
}

export function damp(current: number, target: number, lambda: number, delta: number) {
  return current + (target - current) * (1 - Math.exp(-lambda * delta));
}

export function smoothstep(edge0: number, edge1: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function bellOpacity(zoom: number, center: number, width = 0.95) {
  const distance = Math.abs(zoom - center);
  return 1 - smoothstep(width * 0.35, width, distance);
}

export function rangeOpacity(zoom: number, fadeIn: number, fullIn: number, fullOut: number, fadeOut: number) {
  const incoming = smoothstep(fadeIn, fullIn, zoom);
  const outgoing = 1 - smoothstep(fullOut, fadeOut, zoom);
  return Math.min(incoming, outgoing);
}

export function cameraDistanceForZoom(zoom: number) {
  const clamped = clamp(zoom);
  const lowerIndex = Math.min(Math.floor(clamped), ZOOM_LEVELS.length - 2);
  const upperIndex = lowerIndex + 1;
  const lower = ZOOM_LEVELS[lowerIndex];
  const upper = ZOOM_LEVELS[upperIndex];
  const t = smoothstep(lower.zoom, upper.zoom, clamped);
  return Math.exp(Math.log(lower.distance) * (1 - t) + Math.log(upper.distance) * t);
}

export function levelNameForZoom(zoom: number) {
  const level = ZOOM_LEVELS.reduce((closest, item) => {
    return Math.abs(item.zoom - zoom) < Math.abs(closest.zoom - zoom) ? item : closest;
  }, ZOOM_LEVELS[0]);
  return level.name;
}
