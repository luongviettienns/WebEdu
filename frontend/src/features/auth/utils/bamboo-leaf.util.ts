export const BAMBOO_LEAVES = {
  layers: [
    { size: [34, 50], speed: [20, 32], alpha: 0.13, sensitivity: 0.25, shade: 2, veinBoost: 0 },
    { size: [56, 80], speed: [32, 48], alpha: 0.21, sensitivity: 0.72, shade: 1, veinBoost: 1.2 },
    { size: [86, 114], speed: [46, 64], alpha: 0.32, sensitivity: 1, shade: 0, veinBoost: 2.3 },
  ],
  areaPerLeaf: 24_000,
  minLeaves: 12,
  maxLeaves: 56,
  coarseMaxLeaves: 16,
  maxAlpha: 0.34,
  goldChance: 1 / 8,
  layerShadeChance: 0.65,
  palette: [
    ['#1B5A45', '#3F8A6C'],
    ['#2F7458', '#6FA588'],
    ['#4C8E70', '#9CC4AE'],
    ['#3A7A55', '#C9B26B'],
  ],
  underside: ['#8DB8A3', '#B9D3C4'],
  shapeVariants: 3,
  shape: {
    ratio: [6, 8.5],
    defaultRatio: 7.2,
    widestAt: [0.36, 0.44],
    baseExponent: 0.75,
    tipExponent: 1.7,
    bend: [0.07, 0.10],
    asymmetry: 0.92,
    segments: 24,
  },
  details: {
    unitDivisor: 170,
    minUnit: 0.6,
    midribDarkWidth: 3.4,
    midribLightWidth: 1.7,
    midribDarkAlpha: 0.24,
    midribLightAlpha: 0.55,
    midribTaperExponent: 0.9,
    secondaryVeins: [0.18, 0.36, 0.54, 0.72, 0.88],
    secondaryWeights: [1.0, 0.8, 1.0, 0.8, 1.0],
    secondaryDarkAlpha: 0.30,
    secondaryLightAlpha: 0.20,
    secondaryHighlightOffset: 0.9,
    crossVeinAlpha: 0.07,
    crossVeinWidth: 0.3,
    crossVeinTipShift: 0.55,
    foldAlpha: 0.10,
    stemLength: 0.05,
    stemWidthRatio: 90,
  },
  brightnessJitter: 0.04,
  sway: [20, 60],
  swayRate: [0.45, 0.95],
  tumbleRate: [0.85, 1.55],
  maxTilt: (35 * Math.PI) / 180,
  minScaleX: 0.22,
  wind: [
    { strength: 8, rate: 0.33 },
    { strength: 5, rate: 0.72 },
  ],
  pointerRadius: 190,
  repulsion: 2800,
  pointerDrag: 2.6,
  pointerSmoothing: 24,
  velocitySmoothing: 18,
  maxPointerSpeed: 1200,
  touchImpulse: 0.28,
  torque: 0.45,
  tumbleTorque: 0.35,
  damping: 2.2,
  offsetReturn: 2.6,
  maxSpeed: 520,
  maxSpin: 7.5,
  maxTumbleSpin: 10,
  fadeIn: 0.6,
  maxDt: 0.05,
  desktopDpr: 2,
  coarseDpr: 1.5,
  resizeDebounceMs: 100,
  frameSampleSize: 60,
  slowFrameMs: 24,
  textClearance: 24,
} as const;

const TAU = 2 * Math.PI;
const DESKTOP_LAYER_CYCLE: readonly Layer[] = [0, 1, 2, 0, 2, 1, 0, 2];
const COARSE_LAYER_CYCLE: readonly Layer[] = [0, 1, 0, 1, 0];
type Layer = 0 | 1 | 2;
type Range = readonly [number, number];

export interface LeafBounds {
  width: number;
  height: number;
}

export interface LeafPointer {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  touch: boolean;
}

interface BambooLeaf {
  layer: Layer;
  shade: number;
  shape: number;
  ratio: number;
  size: number;
  fallSpeed: number;
  baseX: number;
  baseY: number;
  sway: number;
  swayAngle: number;
  swayRate: number;
  tumble: number;
  tumbleRate: number;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  vx: number;
  vy: number;
  spin: number;
  tumbleSpin: number;
  offsetX: number;
  offsetY: number;
  offsetAngle: number;
}

export function getLeafCount(width: number, height: number, isCoarse: boolean): number {
  const { minLeaves, maxLeaves, coarseMaxLeaves, areaPerLeaf } = BAMBOO_LEAVES;
  const limit = isCoarse ? coarseMaxLeaves : maxLeaves;
  return Math.max(minLeaves, Math.min(limit, Math.round((width * height) / areaPerLeaf)));
}

export function getLeafLayer(index: number, isCoarse: boolean): Layer {
  const cycle = isCoarse ? COARSE_LAYER_CYCLE : DESKTOP_LAYER_CYCLE;
  return cycle[index % cycle.length];
}

export function getVeinUnit(length: number): number {
  return Math.max(BAMBOO_LEAVES.details.minUnit, length / BAMBOO_LEAVES.details.unitDivisor);
}

export function shouldSkipCrossVein(index: number): boolean {
  return (index * 7) % 5 === 0;
}

export function between(range: Range, random: () => number): number {
  return range[0] + (range[1] - range[0]) * random();
}

export type Point = [number, number];

export function getMidribPolygon(mid: readonly Point[], baseWidth: number): { upper: Point[]; lower: Point[] } {
  const last = mid.length - 1;
  const exp = BAMBOO_LEAVES.details.midribTaperExponent;
  const upper: Point[] = [];
  const lower: Point[] = [];
  for (let i = 0; i <= last; i++) {
    const prev = mid[Math.max(0, i - 1)];
    const next = mid[Math.min(last, i + 1)];
    const dx = next[0] - prev[0];
    const dy = next[1] - prev[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const t = i / last;
    const half = (baseWidth * Math.pow(Math.max(0, 1 - t), exp)) / 2;
    upper.push([mid[i][0] + nx * half, mid[i][1] + ny * half]);
    lower.push([mid[i][0] - nx * half, mid[i][1] - ny * half]);
  }
  return { upper, lower };
}

export function getLeafOutline(length: number, ratio: number, widestAt: number, bend: number) {
  const { asymmetry, segments, baseExponent, tipExponent } = BAMBOO_LEAVES.shape;
  const halfWidth = length / ratio / 2;
  const upper: Point[] = [];
  const lower: Point[] = [];
  const mid: Point[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const profile = t < widestAt
      ? Math.sin((Math.PI / 2) * (t / widestAt)) ** baseExponent
      : Math.cos((Math.PI / 2) * ((t - widestAt) / (1 - widestAt))) ** tipExponent;
    const width = halfWidth * profile;
    const x = (t - 0.5) * length;
    const y = bend * length * (t * t - 0.25 * t);
    mid.push([x, y]);
    upper.push([x, y - width]);
    lower.push([x, y + width * asymmetry]);
  }
  return { upper, lower, mid };
}

function updatePose(leaf: BambooLeaf) {
  const sway = Math.sin(leaf.swayAngle);
  const fold = Math.cos(leaf.tumble);
  leaf.x = leaf.baseX + sway * leaf.sway + leaf.offsetX;
  leaf.y = leaf.baseY + leaf.offsetY;
  leaf.rotation = sway * BAMBOO_LEAVES.maxTilt + leaf.offsetAngle;
  leaf.scaleX = (fold < 0 ? -1 : 1) * Math.max(BAMBOO_LEAVES.minScaleX, Math.abs(fold));
}

function resetLeaf(leaf: BambooLeaf, bounds: LeafBounds, spread: boolean, random: () => number) {
  const settings = BAMBOO_LEAVES;
  const layer = settings.layers[leaf.layer];
  leaf.shade = random() < settings.goldChance ? 3 : random() < settings.layerShadeChance ? layer.shade : 0;
  leaf.shape = Math.floor(random() * settings.shapeVariants);
  leaf.ratio = between(settings.shape.ratio, random);
  leaf.size = between(layer.size, random);
  leaf.fallSpeed = between(layer.speed, random);
  leaf.baseX = random() * bounds.width;
  leaf.baseY = spread ? random() * bounds.height : -leaf.size * (1 + random());
  leaf.sway = between(settings.sway, random);
  leaf.swayAngle = random() * TAU;
  leaf.swayRate = between(settings.swayRate, random);
  leaf.tumble = random() * TAU;
  leaf.tumbleRate = between(settings.tumbleRate, random);
  leaf.vx = 0;
  leaf.vy = 0;
  leaf.spin = 0;
  leaf.tumbleSpin = 0;
  leaf.offsetX = 0;
  leaf.offsetY = 0;
  leaf.offsetAngle = 0;
  updatePose(leaf);
}

export function createLeaf(bounds: LeafBounds, layer: Layer, spread: boolean, random = Math.random): BambooLeaf {
  const leaf = {
    layer, shade: 0, shape: 0, ratio: 0, size: 0, fallSpeed: 0, baseX: 0, baseY: 0, sway: 0,
    swayAngle: 0, swayRate: 0, tumble: 0, tumbleRate: 0, x: 0, y: 0, rotation: 0,
    scaleX: 1, vx: 0, vy: 0, spin: 0, tumbleSpin: 0, offsetX: 0, offsetY: 0, offsetAngle: 0,
  };
  resetLeaf(leaf, bounds, spread, random);
  return leaf;
}

export function stepLeaf(
  leaf: BambooLeaf,
  dt: number,
  wind: number,
  pointer: LeafPointer,
  bounds: LeafBounds,
  random = Math.random,
): void {
  const settings = BAMBOO_LEAVES;
  const { sensitivity } = settings.layers[leaf.layer];
  const damping = Math.exp(-dt * settings.damping);
  const returning = Math.exp(-dt * settings.offsetReturn);
  leaf.vx *= damping;
  leaf.vy *= damping;
  leaf.spin *= damping;
  leaf.tumbleSpin *= damping;

  if (pointer.active) {
    const dx = leaf.x - pointer.x;
    const dy = leaf.y - pointer.y;
    const distance = Math.hypot(dx, dy);
    const radius = settings.pointerRadius * sensitivity;
    if (distance < radius) {
      const weight = (1 - distance / radius) ** 2 * sensitivity;
      const impulse = weight * (pointer.touch ? settings.touchImpulse : dt);
      const radial = distance > 0 ? settings.repulsion / distance : 0;
      leaf.vx += impulse * (radial * dx + settings.pointerDrag * pointer.vx);
      leaf.vy += impulse * (radial * dy + settings.pointerDrag * pointer.vy);
      if (distance > 0) {
        const tangent = (dx * pointer.vy - dy * pointer.vx) / distance;
        leaf.spin += impulse * tangent * settings.torque;
        leaf.tumbleSpin += impulse * tangent * settings.tumbleTorque;
      }
      const speed = Math.hypot(leaf.vx, leaf.vy);
      if (speed > settings.maxSpeed) {
        leaf.vx *= settings.maxSpeed / speed;
        leaf.vy *= settings.maxSpeed / speed;
      }
      leaf.spin = Math.max(-settings.maxSpin, Math.min(settings.maxSpin, leaf.spin));
      leaf.tumbleSpin = Math.max(-settings.maxTumbleSpin, Math.min(settings.maxTumbleSpin, leaf.tumbleSpin));
    }
  }

  leaf.offsetX = (leaf.offsetX + leaf.vx * dt) * returning;
  leaf.offsetY = (leaf.offsetY + leaf.vy * dt) * returning;
  leaf.offsetAngle = (leaf.offsetAngle + leaf.spin * dt) * returning;
  leaf.baseX += wind * sensitivity * dt;
  leaf.baseY += leaf.fallSpeed * dt;
  leaf.swayAngle += leaf.swayRate * dt;
  leaf.tumble += (leaf.tumbleRate + leaf.tumbleSpin) * dt;
  updatePose(leaf);

  if (leaf.x < -leaf.size) {
    leaf.baseX += bounds.width + 2 * leaf.size;
    leaf.x += bounds.width + 2 * leaf.size;
  } else if (leaf.x > bounds.width + leaf.size) {
    leaf.baseX -= bounds.width + 2 * leaf.size;
    leaf.x -= bounds.width + 2 * leaf.size;
  }
  if (leaf.y > bounds.height + leaf.size) resetLeaf(leaf, bounds, false, random);
}
