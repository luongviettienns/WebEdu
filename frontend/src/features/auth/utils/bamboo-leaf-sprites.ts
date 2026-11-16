import { BAMBOO_LEAVES as settings, between, getLeafOutline } from './bamboo-leaf.util';

type Point = ReturnType<typeof getLeafOutline>['mid'][number];

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

function traceCurve(path: Path2D, points: Point[]) {
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i];
    const [nextX, nextY] = points[i + 1];
    path.quadraticCurveTo(x, y, (x + nextX) / 2, (y + nextY) / 2);
  }
  path.lineTo(...points[points.length - 1]);
}

function createPaths(length: number, profile: LeafProfile, withSecondaryVeins: boolean) {
  const { upper, lower, mid } = getLeafOutline(length, profile.ratio, profile.widestAt, profile.bend);
  const reversedLower = [...lower].reverse();
  const blade = new Path2D();
  blade.moveTo(...upper[0]);
  traceCurve(blade, upper);
  traceCurve(blade, reversedLower);
  blade.closePath();

  const fold = new Path2D();
  fold.moveTo(...mid[0]);
  traceCurve(fold, mid);
  traceCurve(fold, reversedLower);
  fold.closePath();

  const vein = new Path2D();
  const veinPoints = mid.slice(1, -1);
  vein.moveTo(...veinPoints[0]);
  traceCurve(vein, veinPoints);

  const stem = new Path2D();
  const [baseX, baseY] = mid[0];
  stem.moveTo(baseX - length * details.stemLength, baseY + length * 0.01);
  stem.lineTo(baseX + length * 0.006, baseY);

  const secondary = new Path2D();
  if (withSecondaryVeins) {
    for (const side of [upper, lower]) {
      for (const distance of details.secondaryVeins) {
        const points = side.slice(2, -2).map(([x, y], i): Point => {
          const [, centerY] = mid[i + 2];
          return [x, centerY + (y - centerY) * distance];
        });
        secondary.moveTo(...points[0]);
        traceCurve(secondary, points);
      }
    }
  }
  return { blade, fold, vein, stem, secondary };
}

function shiftColor(color: string, lightness: number) {
  const keep = 100 * (1 - Math.abs(lightness));
  return `color-mix(in srgb, ${color} ${keep}%, ${lightness < 0 ? 'black' : 'white'})`;
}

function createAtlas(layer: number, dpr: number, jade: string, profiles: LeafProfile[]) {
  const [minLength, length] = settings.layers[layer].size;
  const width = Math.ceil(length * 0.32 * dpr);
  const height = Math.ceil(length * 1.14 * dpr);
  const canvas = document.createElement('canvas');
  canvas.width = width * columns;
  canvas.height = height * profiles.length;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const withSecondaryVeins = layer === 2;
  const baseJade = jade ? `color-mix(in srgb, ${settings.palette[0][0]} 90%, ${jade})` : settings.palette[0][0];
  const lightestJade = settings.palette[0][1];

  for (const [row, profile] of profiles.entries()) {
    const paths = createPaths(length, profile, withSecondaryVeins);
    for (let column = 0; column < columns; column++) {
      const shade = Math.floor(column / 2);
      const underside = column % 2 === 1;
      const [base, tip] = underside ? settings.underside
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
      if (withSecondaryVeins) {
        ctx.strokeStyle = `rgba(0,0,0,${details.secondaryAlpha})`;
        ctx.lineWidth = length / details.secondaryWidthRatio;
        ctx.stroke(paths.secondary);
      }
      ctx.strokeStyle = `rgba(255,255,255,${details.veinAlpha})`;
      ctx.lineWidth = Math.max(length / details.veinWidthRatio, details.minVeinWidth * length / minLength);
      ctx.stroke(paths.vein);
    }
  }
  return { canvas, width, height, length, drawWidth: width / dpr, drawHeight: height / dpr };
}

export function createLeafAtlases(dpr: number, jade: string, isCoarse: boolean, profiles: LeafProfile[]) {
  return settings.layers.slice(0, isCoarse ? 2 : 3)
    .map((_, layer) => createAtlas(layer, dpr, jade, profiles));
}
