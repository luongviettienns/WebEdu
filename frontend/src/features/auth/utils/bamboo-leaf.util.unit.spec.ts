import { expect, test } from '@playwright/test';
import { BAMBOO_LEAVES, createLeaf, getLeafCount, getLeafOutline, stepLeaf } from './bamboo-leaf.util';

const bounds = { width: 1440, height: 900 };
const idlePointer = { active: false, x: 0, y: 0, vx: 0, vy: 0, touch: false };
const random = () => 0.5;
const dt = 1 / 60;

test('recycles the same leaf above the viewport and resets its extra motion', () => {
  const leaf = createLeaf(bounds, 2, true, random);
  leaf.baseY = bounds.height + leaf.size + 1;
  leaf.vy = 15;
  leaf.offsetY = 4;

  stepLeaf(leaf, dt, 0, idlePointer, bounds, random);

  expect(leaf.y).toBe(-1.5 * leaf.size);
  expect(leaf.vy).toBe(0);
  expect(leaf.offsetY).toBe(0);
  expect(leaf.layer).toBe(2);
});

test('pointer force vanishes at the radius and points away from the pointer inside it', () => {
  const leaf = createLeaf(bounds, 2, true, random);
  const pointer = { ...idlePointer, active: true, x: leaf.x - 140, y: leaf.y, vy: 200 };
  stepLeaf(leaf, dt, 0, pointer, bounds);
  expect(leaf.vx).toBe(0);
  expect(leaf.vy).toBe(0);
  expect(leaf.spin).toBe(0);

  pointer.x = leaf.x - 20;
  pointer.y = leaf.y;
  stepLeaf(leaf, dt, 0, pointer, bounds);
  expect(leaf.vx).toBeGreaterThan(0);
  expect(leaf.vy).toBeGreaterThan(0);
  expect(leaf.spin).toBeGreaterThan(0);

  const farLeaf = createLeaf(bounds, 0, true, random);
  pointer.x = farLeaf.x - 50;
  pointer.y = farLeaf.y;
  stepLeaf(farLeaf, dt, 0, pointer, bounds);
  expect(farLeaf.vx).toBe(0);
});

test('extra velocity decays exponentially and the displaced leaf returns to its path', () => {
  const leaf = createLeaf(bounds, 2, true, random);
  leaf.vx = 30;
  leaf.vy = -15;
  leaf.spin = 1;
  leaf.offsetX = 20;

  for (let frame = 0; frame < 120; frame += 1) stepLeaf(leaf, dt, 0, idlePointer, bounds);

  const damping = Math.exp(-2 * BAMBOO_LEAVES.damping);
  expect(leaf.vx).toBeCloseTo(30 * damping, 8);
  expect(leaf.vy).toBeCloseTo(-15 * damping, 8);
  expect(leaf.spin).toBeCloseTo(damping, 8);
  expect(Math.abs(leaf.offsetX)).toBeLessThan(1);
});

test('tumble preserves a visible width on either side of the fold', () => {
  const leaf = createLeaf(bounds, 1, true, random);
  leaf.tumble = Math.PI / 2 - 0.001;
  stepLeaf(leaf, 0, 0, idlePointer, bounds);
  expect(leaf.scaleX).toBe(BAMBOO_LEAVES.minScaleX);

  leaf.tumble = Math.PI / 2 + 0.001;
  stepLeaf(leaf, 0, 0, idlePointer, bounds);
  expect(leaf.scaleX).toBe(-BAMBOO_LEAVES.minScaleX);
});

test('area-based leaf count keeps desktop and coarse-pointer budgets', () => {
  expect(getLeafCount(1440, 900, false)).toBe(22);
  expect(getLeafCount(3840, 2160, false)).toBe(32);
  expect(getLeafCount(375, 812, true)).toBe(8);
  expect(getLeafCount(1280, 800, true)).toBe(10);
});

test('blade narrows to both tips and is widest 40 percent from the stem', () => {
  const length = 100;
  const { upper, lower, mid } = getLeafOutline(length, 7.2, 0.4, 0.08);
  const widths = lower.map(([, y], index) => y - upper[index][1]);
  const widest = Math.max(...widths);
  expect(upper).toHaveLength(19);
  expect(upper[0]).toEqual([-50, 0]);
  expect(widths.at(-1)).toBeCloseTo(0);
  expect(mid.at(-1)).toEqual([50, 6]);
  expect(widths.indexOf(widest) / 18).toBeCloseTo(0.4, 1);
  expect(widest).toBeGreaterThan(12);
  expect(widest).toBeLessThan(14);
});
