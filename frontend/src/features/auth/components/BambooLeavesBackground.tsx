'use client';

import { useRef } from 'react';
import { useBambooLeaves } from '../hooks/useBambooLeaves';

export default function BambooLeavesBackground() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useBambooLeaves(canvas);

  return (
    <canvas
      ref={canvas}
      aria-hidden="true"
      data-bamboo-leaves
      className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
    />
  );
}
