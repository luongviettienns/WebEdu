export const BAMBOO_LEAVES = {
  layers: [
    { size: [30, 48], speed: [20, 30], alpha: 0.1, sensitivity: 0.25, shade: 2 },
    { size: [52, 74], speed: [30, 45], alpha: 0.16, sensitivity: 0.6, shade: 1 },
    { size: [80, 106], speed: [45, 60], alpha: 0.22, sensitivity: 1, shade: 0 },
  ],
  areaPerLeaf: 60_000,
  minLeaves: 8,
  maxLeaves: 32,
  coarseMaxLeaves: 10,
  maxAlpha: 0.25,
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
    segments: 18,
  },
  details: {
    veinAlpha: 0.28,
    veinWidthRatio: 120,
    minVeinWidth: 0.6,
    secondaryVeins: [0.4, 0.72],
    secondaryAlpha: 0.13,
    secondaryWidthRatio: 260,
    foldAlpha: 0.10,
    stemLength: 0.05,
    stemWidthRatio: 90,
  },
  brightnessJitter: 0.04,
  sway: [20, 60],
  swayRate: [0.45, 0.95],
  tumbleRate: [0.85, 1.55],
  maxTilt: (35 * Math.PI) / 180,
  minScaleX: 0.15,
  wind: [
    { strength: 8, rate: 0.33 },
    { strength: 5, rate: 0.72 },
  ],
  pointerRadius: 140,
  repulsion: 240,
  pointerDrag: 0.16,
  pointerSmoothing: 14,
  velocitySmoothing: 10,
  maxPointerSpeed: 420,
  touchImpulse: 0.16,
  torque: 0.012,
  damping: 2.2,
  offsetReturn: 2.6,
  maxSpeed: 72,
  maxSpin: 1.25,
  fadeIn: 0.6,
  maxDt: 0.05,
  desktopDpr: 2,
  coarseDpr: 1.5,
  resizeDebounceMs: 100,
  frameSampleSize: 60,
  slowFrameMs: 24,
  textClearance: 6,
} as const;

const TAU = 2 * Math.PI;
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
  offsetX: number;
  offsetY: number;
  offsetAngle: number;
}

export function getLeafCount(width: number, height: number, isCoarse: boolean): number {
  const { minLeaves, maxLeaves, coarseMaxLeaves, areaPerLeaf } = BAMBOO_LEAVES;
  const limit = isCoarse ? coarseMaxLeaves : maxLeaves;
  return Math.max(minLeaves, Math.min(limit, Math.round((width * height) / areaPerLeaf)));
}

export function between(range: Range, random: () => number): number {
  return range[0] + (range[1] - range[0]) * random();
}

type Point = [number, number];

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
  leaf.offsetX = 0;
  leaf.offsetY = 0;
  leaf.offsetAngle = 0;
  updatePose(leaf);
}

export function createLeaf(bounds: LeafBounds, layer: Layer, spread: boolean, random = Math.random): BambooLeaf {
  const leaf = {
    layer, shade: 0, shape: 0, ratio: 0, size: 0, fallSpeed: 0, baseX: 0, baseY: 0, sway: 0,
    swayAngle: 0, swayRate: 0, tumble: 0, tumbleRate: 0, x: 0, y: 0, rotation: 0,
    scaleX: 1, vx: 0, vy: 0, spin: 0, offsetX: 0, offsetY: 0, offsetAngle: 0,
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
      }
      const speed = Math.hypot(leaf.vx, leaf.vy);
      if (speed > settings.maxSpeed) {
        leaf.vx *= settings.maxSpeed / speed;
        leaf.vy *= settings.maxSpeed / speed;
      }
      leaf.spin = Math.max(-settings.maxSpin, Math.min(settings.maxSpin, leaf.spin));
    }
  }

  leaf.offsetX = (leaf.offsetX + leaf.vx * dt) * returning;
  leaf.offsetY = (leaf.offsetY + leaf.vy * dt) * returning;
  leaf.offsetAngle = (leaf.offsetAngle + leaf.spin * dt) * returning;
  leaf.baseX += wind * sensitivity * dt;
  leaf.baseY += leaf.fallSpeed * dt;
  leaf.swayAngle += leaf.swayRate * dt;
  leaf.tumble += leaf.tumbleRate * dt;
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
