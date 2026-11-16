import {
  BAMBOO_LEAVES as settings,
  between,
  getLeafOutline,
  getMidribPolygon,
  getVeinUnit,
  shouldSkipCrossVein,
  type Point,
} from './bamboo-leaf.util';

export function createLeafProfiles() {
  const { ratio, defaultRatio, widestAt, bend } = settings.shape;
  return Array.from({ length: settings.shapeVariants }, (_, index) => ({
    ratio: index === 1
      ? defaultRatio
      : between(index === 0 ? [ratio[0], defaultRatio] : [defaultRatio, ratio[1]], Math.random),
    widestAt: between(widestAt, Math.random),
    bend: between(bend, Math.random),
    lightness: ((index + Math.random()) / settings.shapeVariants * 2 - 1) * settings.brightnessJitter,
  }));
}

type LeafProfile = ReturnType<typeof createLeafProfiles>[number];
const columns = settings.palette.length * 2;
const details = settings.details;

function traceCurve(path: Path2D, points: readonly Point[]) {
  if (points.length < 2) return;
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i];
    const [nextX, nextY] = points[i + 1];
    path.quadraticCurveTo(x, y, (x + nextX) / 2, (y + nextY) / 2);
  }
  path.lineTo(...points[points.length - 1]);
}

function buildClosedPolygon(upper: readonly Point[], lower: readonly Point[]) {
  const path = new Path2D();
  const reversedLower = [...lower].reverse();
  path.moveTo(...upper[0]);
  traceCurve(path, upper);
  traceCurve(path, reversedLower);
  path.closePath();
  return path;
}

function lerpPoint(a: Point, b: Point, t: number): Point {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function createPaths(length: number, profile: LeafProfile, withDetailedVeins: boolean) {
  const { upper, lower, mid } = getLeafOutline(length, profile.ratio, profile.widestAt, profile.bend);
  const unit = getVeinUnit(length);
  const blade = buildClosedPolygon(upper, lower);
  const fold = buildClosedPolygon(mid, lower);

  const midribDarkPoly = getMidribPolygon(mid, details.midribDarkWidth * unit);
  const midribLightPoly = getMidribPolygon(mid, details.midribLightWidth * unit);
  const midribDark = buildClosedPolygon(midribDarkPoly.upper, midribDarkPoly.lower);
  const midribLight = buildClosedPolygon(midribLightPoly.upper, midribLightPoly.lower);

  const stem = new Path2D();
  const [baseX, baseY] = mid[0];
  stem.moveTo(baseX - length * details.stemLength, baseY + length * 0.01);
  stem.lineTo(baseX + length * 0.006, baseY);

  const secondaryBuckets = [
    { weight: 1.0, dark: new Path2D(), light: new Path2D() },
    { weight: 0.8, dark: new Path2D(), light: new Path2D() },
  ];
  const crossVeins = new Path2D();

  if (withDetailedVeins) {
    const sides = [upper, lower] as const;
    for (const side of sides) {
      const slicedSide = side.slice(1, -1);
      const slicedMid = mid.slice(1, -1);
      details.secondaryVeins.forEach((fraction, veinIdx) => {
        const bucket = secondaryBuckets[veinIdx % 2];
        const pts = slicedSide.map(([x, y], i): Point => {
          const [, centerY] = slicedMid[i];
          return [x, centerY + (y - centerY) * fraction];
        });
        bucket.dark.moveTo(...pts[0]);
        traceCurve(bucket.dark, pts);
        const litPts = pts.map(([x, y]): Point => [x, y + details.secondaryHighlightOffset * unit]);
        bucket.light.moveTo(...litPts[0]);
        traceCurve(bucket.light, litPts);
      });

      const bands = [0, ...details.secondaryVeins];
      for (let b = 0; b < bands.length - 1; b++) {
        const f0 = bands[b];
        const f1 = bands[b + 1];
        for (let i = 2; i < mid.length - 3; i++) {
          if (shouldSkipCrossVein(i + b * 3)) continue;
          const p0 = lerpPoint(mid[i], side[i], f0);
          const outerA = lerpPoint(mid[i], side[i], f1);
          const outerB = lerpPoint(mid[i + 1], side[i + 1], f1);
          const p1 = lerpPoint(outerA, outerB, details.crossVeinTipShift);
          crossVeins.moveTo(...p0);
          crossVeins.lineTo(...p1);
        }
      }
    }
  }

  return { blade, fold, midribDark, midribLight, stem, secondaryBuckets, crossVeins, unit };
}

function shiftColor(color: string, lightness: number) {
  const keep = 100 * (1 - Math.abs(lightness));
  return `color-mix(in srgb, ${color} ${keep}%, ${lightness < 0 ? 'black' : 'white'})`;
}

function createAtlas(layer: number, dpr: number, jade: string, profiles: LeafProfile[]) {
  const layerSpec = settings.layers[layer];
  const [, length] = layerSpec.size;
  const width = Math.ceil(length * 0.32 * dpr);
  const height = Math.ceil(length * 1.14 * dpr);
  const canvas = document.createElement('canvas');
  canvas.width = width * columns;
  canvas.height = height * profiles.length;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const baseJade = jade ? `color-mix(in srgb, ${settings.palette[0][0]} 90%, ${jade})` : settings.palette[0][0];
  const lightestJade = settings.palette[0][1];
  const withDetailedVeins = layerSpec.veinBoost > 0;

  for (const [row, profile] of profiles.entries()) {
    const paths = createPaths(length, profile, withDetailedVeins);
    for (let column = 0; column < columns; column++) {
      const shade = Math.floor(column / 2);
      const underside = column % 2 === 1;
      const [base, tip] = underside
        ? settings.underside
        : shade === 0 ? [baseJade, lightestJade] : settings.palette[shade];
      const shadeShift = (shade / (settings.palette.length - 1) - 0.5) * settings.brightnessJitter / 2;
      const lightness = profile.lightness * 0.75 + shadeShift;
      const stemColor = shiftColor(base, lightness);

      ctx.setTransform(dpr, 0, 0, dpr, (column + 0.5) * width, (row + 0.5) * height);
      ctx.rotate(Math.PI / 2);
      const gradient = ctx.createLinearGradient(-length / 2, 0, length / 2, 0);
      gradient.addColorStop(0, stemColor);
      gradient.addColorStop(1, shiftColor(tip, lightness));

      ctx.strokeStyle = stemColor;
      ctx.lineWidth = length / details.stemWidthRatio;
      ctx.lineCap = 'round';
      ctx.stroke(paths.stem);

      ctx.fillStyle = gradient;
      ctx.fill(paths.blade);
      ctx.fillStyle = `rgba(255,255,255,${details.foldAlpha})`;
      ctx.fill(paths.fold);

      ctx.save();
      ctx.clip(paths.blade);
      // Far leaves and golden autumn leaves keep clean silhouettes with only a gentle midrib.
      if (!withDetailedVeins || shade === 3) {
        ctx.fillStyle = `rgba(232,246,238,${underside ? 0.12 : 0.18})`;
        ctx.fill(paths.midribLight);
      } else {
        const boost = underside ? layerSpec.veinBoost * 0.48 : layerSpec.veinBoost;
        ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(255,255,255,${Math.min(0.32, details.crossVeinAlpha * boost)})`;
        ctx.lineWidth = details.crossVeinWidth * paths.unit;
        ctx.stroke(paths.crossVeins);

        for (const bucket of paths.secondaryBuckets) {
          ctx.strokeStyle = `rgba(8,40,28,${Math.min(0.82, details.secondaryDarkAlpha * boost)})`;
          ctx.lineWidth = paths.unit * bucket.weight;
          ctx.stroke(bucket.dark);
          ctx.strokeStyle = `rgba(255,255,255,${Math.min(0.68, details.secondaryLightAlpha * boost)})`;
          ctx.lineWidth = paths.unit * bucket.weight * 0.85;
          ctx.stroke(bucket.light);
        }

        ctx.fillStyle = `rgba(8,40,28,${Math.min(0.75, details.midribDarkAlpha * boost)})`;
        ctx.fill(paths.midribDark);
        const coreAlpha = Math.min(0.88, details.midribLightAlpha * (1 + (boost - 1) * 0.45));
        ctx.fillStyle = `rgba(232,246,238,${coreAlpha})`;
        ctx.fill(paths.midribLight);
      }
      ctx.restore();
    }
  }
  return { canvas, width, height, length, drawWidth: width / dpr, drawHeight: height / dpr };
}

export function createLeafAtlases(dpr: number, jade: string, isCoarse: boolean, profiles: LeafProfile[]) {
  return settings.layers.slice(0, isCoarse ? 2 : 3)
    .map((_, layer) => createAtlas(layer, dpr, jade, profiles));
}

export function createClearanceMask(
  width: number,
  height: number,
  dpr: number,
  canvasRect: DOMRect,
  protectedElements: NodeListOf<HTMLElement>,
  pad: number,
): HTMLCanvasElement | null {
  const mask = document.createElement('canvas');
  mask.width = Math.max(1, Math.round(width * dpr));
  mask.height = Math.max(1, Math.round(height * dpr));
  const ctx = mask.getContext('2d');
  if (!ctx) return null;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (const element of protectedElements) {
    const area = element.getBoundingClientRect();
    if (!area.width || !area.height) continue;
    const rx = area.width * 0.62 + pad;
    const ry = area.height * 0.68 + pad;
    const cx = area.left - canvasRect.left + area.width / 2;
    const cy = area.top - canvasRect.top + area.height / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(rx, ry);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    gradient.addColorStop(0, 'rgba(0,0,0,0.72)');
    gradient.addColorStop(0.55, 'rgba(0,0,0,0.64)');
    gradient.addColorStop(0.82, 'rgba(0,0,0,0.28)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  return mask;
}
