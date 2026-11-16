'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { createClearanceMask, createLeafAtlases, createLeafProfiles } from '../utils/bamboo-leaf-sprites';
import {
  BAMBOO_LEAVES as settings,
  createLeaf,
  getLeafCount,
  getLeafLayer,
  stepLeaf,
  type LeafPointer,
} from '../utils/bamboo-leaf.util';

interface PointerState extends LeafPointer {
  targetX: number;
  targetY: number;
}

const [breeze, gust] = settings.wind;

function smoothPointer(pointer: PointerState, dt: number) {
  if (!pointer.active || pointer.touch || dt === 0) return;
  const positionBlend = 1 - Math.exp(-dt * settings.pointerSmoothing);
  const velocityBlend = 1 - Math.exp(-dt * settings.velocitySmoothing);
  const dx = (pointer.targetX - pointer.x) * positionBlend;
  const dy = (pointer.targetY - pointer.y) * positionBlend;
  const speed = Math.hypot(dx, dy) / dt;
  const scale = speed > settings.maxPointerSpeed ? settings.maxPointerSpeed / speed : 1;
  pointer.x += dx;
  pointer.y += dy;
  pointer.vx += (dx * scale / dt - pointer.vx) * velocityBlend;
  pointer.vy += (dy * scale / dt - pointer.vy) * velocityBlend;
}

export function useBambooLeaves(canvasRef: RefObject<HTMLCanvasElement | null>): void {
  const pointerRef = useRef<PointerState>({
    active: false, x: 0, y: 0, vx: 0, vy: 0, touch: false, targetX: 0, targetY: 0,
  });

  useEffect(() => {
    const element = canvasRef.current;
    const root = element?.parentElement;
    const context = element?.getContext('2d');
    if (!element || !root || !context) return;
    const canvas = element;
    const ctx = context;

    const pointer = pointerRef.current;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const coarse = window.matchMedia('(pointer: coarse)');
    const jade = getComputedStyle(canvas).getPropertyValue('--jade').trim();
    const profiles = createLeafProfiles();
    const protectedElements = root.querySelectorAll<HTMLElement>('[data-bamboo-clear]');
    const bounds = { width: 0, height: 0 };
    const leaves: ReturnType<typeof createLeaf>[] = [];
    const frameTimes = new Float64Array(settings.frameSampleSize);

    let dpr = 1;
    let deviceDpr = 1;
    let coarseProfile = coarse.matches;
    let elapsed = 0;
    let previousTime: number | null = null;
    let frame: number | null = null;
    let resizeTimer: number | undefined;
    let intersecting = false;
    let listening = false;
    let degraded = false;
    let sampleIndex = 0;
    let sampleCount = 0;
    let sampleTotal = 0;
    let atlases: ReturnType<typeof createLeafAtlases> | null = null;
    let clearanceMask: HTMLCanvasElement | null = null;

    function resetPointer() {
      pointer.active = false;
      pointer.touch = false;
      pointer.vx = 0;
      pointer.vy = 0;
    }

    function trackPointer(event: PointerEvent, touch: boolean) {
      const rect = canvas.getBoundingClientRect();
      pointer.targetX = event.clientX - rect.left;
      pointer.targetY = event.clientY - rect.top;
      if (!pointer.active || pointer.touch || touch) {
        pointer.x = pointer.targetX;
        pointer.y = pointer.targetY;
        pointer.vx = 0;
        pointer.vy = 0;
      }
      pointer.active = true;
      pointer.touch = touch;
    }

    function pointerMove(event: PointerEvent) {
      if (event.pointerType !== 'touch') trackPointer(event, false);
    }

    function pointerDown(event: PointerEvent) {
      if (event.pointerType === 'touch') trackPointer(event, true);
    }

    function pointerLeave(event: PointerEvent) {
      if (event.pointerType !== 'touch') resetPointer();
    }

    function setPointerListeners(enabled: boolean) {
      if (listening === enabled) return;
      listening = enabled;
      if (enabled) {
        window.addEventListener('pointermove', pointerMove, { passive: true });
        window.addEventListener('pointerdown', pointerDown, { passive: true });
        window.addEventListener('pointerleave', pointerLeave);
        document.documentElement.addEventListener('pointerleave', pointerLeave);
        window.addEventListener('blur', resetPointer);
      } else {
        window.removeEventListener('pointermove', pointerMove);
        window.removeEventListener('pointerdown', pointerDown);
        window.removeEventListener('pointerleave', pointerLeave);
        document.documentElement.removeEventListener('pointerleave', pointerLeave);
        window.removeEventListener('blur', resetPointer);
        resetPointer();
      }
    }

    function clearCanvas() {
      ctx.resetTransform();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    function sampleFrame(duration: number) {
      if (degraded || duration === 0) return;
      if (sampleCount === frameTimes.length) sampleTotal -= frameTimes[sampleIndex];
      else sampleCount += 1;
      frameTimes[sampleIndex] = duration;
      sampleTotal += duration;
      sampleIndex = (sampleIndex + 1) % frameTimes.length;
      if (sampleCount === frameTimes.length && sampleTotal / sampleCount > settings.slowFrameMs) {
        degraded = true;
        leaves.length = Math.floor(leaves.length / 2);
      }
    }

    function tick(timestamp: number) {
      const currentDpr = window.devicePixelRatio || 1;
      if (currentDpr !== deviceDpr) {
        deviceDpr = currentDpr;
        queueResize();
      }
      const duration = previousTime === null ? 0 : timestamp - previousTime;
      previousTime = timestamp;
      sampleFrame(duration);
      const dt = Math.min(duration / 1000, settings.maxDt);
      elapsed += dt;
      smoothPointer(pointer, dt);
      const wind = breeze.strength * Math.sin(elapsed * breeze.rate)
        + gust.strength * Math.sin(elapsed * gust.rate);
      const fade = Math.min(elapsed / settings.fadeIn, 1);
      clearCanvas();
      for (let i = 0; i < leaves.length; i++) {
        const leaf = leaves[i];
        stepLeaf(leaf, dt, wind, pointer, bounds);
        const atlas = atlases?.[leaf.layer];
        if (!atlas) continue;
        const size = dpr * leaf.size / atlas.length;
        const cos = Math.cos(leaf.rotation) * size;
        const sin = Math.sin(leaf.rotation) * size;
        const fold = leaf.scaleX * profiles[leaf.shape].ratio / leaf.ratio;
        const column = leaf.shade * 2 + (leaf.scaleX < 0 ? 1 : 0);
        ctx.setTransform(cos * fold, sin * fold, -sin, cos, leaf.x * dpr, leaf.y * dpr);
        ctx.globalAlpha = Math.min(settings.layers[leaf.layer].alpha * fade, settings.maxAlpha);
        ctx.drawImage(
          atlas.canvas, column * atlas.width, leaf.shape * atlas.height, atlas.width, atlas.height,
          -atlas.drawWidth / 2, -atlas.drawHeight / 2, atlas.drawWidth, atlas.drawHeight,
        );
      }
      if (pointer.touch) resetPointer();
      // Soft-feather behind floating copy so leaves pass behind text without sharp cutouts or contrast drops.
      if (clearanceMask) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = 1;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(clearanceMask, 0, 0);
        ctx.restore();
      }
      frame = window.requestAnimationFrame(tick);
    }

    function stop() {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null;
      previousTime = null;
      sampleIndex = 0;
      sampleCount = 0;
      sampleTotal = 0;
      setPointerListeners(false);
    }

    function syncActivity() {
      if (motion.matches || document.hidden || !intersecting || leaves.length === 0) {
        stop();
        if (motion.matches) clearCanvas();
        return;
      }
      atlases ??= createLeafAtlases(dpr, jade, coarseProfile, profiles);
      setPointerListeners(true);
      if (frame === null) frame = window.requestAnimationFrame(tick);
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const prevWidth = bounds.width;
      const prevHeight = bounds.height;
      const previousDpr = dpr;
      bounds.width = rect.width;
      bounds.height = rect.height;
      if (coarseProfile !== coarse.matches) {
        leaves.length = 0;
        coarseProfile = coarse.matches;
        atlases = null;
      }
      deviceDpr = window.devicePixelRatio || 1;
      dpr = Math.min(deviceDpr, coarseProfile ? settings.coarseDpr : settings.desktopDpr);
      if (previousDpr !== dpr || prevWidth !== bounds.width || prevHeight !== bounds.height) atlases = null;
      const width = Math.round(rect.width * dpr);
      const height = Math.round(rect.height * dpr);
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;

      if (prevWidth && prevHeight && (prevWidth !== bounds.width || prevHeight !== bounds.height)) {
        for (const leaf of leaves) {
          const dx = leaf.baseX * (bounds.width / prevWidth - 1);
          const dy = leaf.baseY * (bounds.height / prevHeight - 1);
          leaf.baseX += dx;
          leaf.baseY += dy;
          leaf.x += dx;
          leaf.y += dy;
        }
        resetPointer();
      }
      const targetCount = getLeafCount(bounds.width, bounds.height, coarseProfile);
      const count = degraded ? Math.floor(targetCount / 2) : targetCount;
      if (leaves.length > count) leaves.length = count;
      while (leaves.length < count) {
        leaves.push(createLeaf(bounds, getLeafLayer(leaves.length, coarseProfile), true));
      }

      clearanceMask = createClearanceMask(
        rect.width,
        rect.height,
        dpr,
        rect,
        protectedElements,
        settings.textClearance,
      );
      syncActivity();
    }

    function queueResize() {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, settings.resizeDebounceMs);
    }

    const resizeObserver = new ResizeObserver(queueResize);
    resizeObserver.observe(canvas);
    for (const element of protectedElements) resizeObserver.observe(element);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      intersecting = entry.isIntersecting;
      syncActivity();
    });
    intersectionObserver.observe(canvas);
    resize();

    document.addEventListener('visibilitychange', syncActivity);
    motion.addEventListener('change', syncActivity);
    coarse.addEventListener('change', queueResize);
    return () => {
      stop();
      clearCanvas();
      window.clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      intersectionObserver.takeRecords();
      document.removeEventListener('visibilitychange', syncActivity);
      motion.removeEventListener('change', syncActivity);
      coarse.removeEventListener('change', queueResize);
    };
  }, [canvasRef]);
}
