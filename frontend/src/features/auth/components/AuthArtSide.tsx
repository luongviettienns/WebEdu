'use client';

import React from 'react';
import Link from 'next/link';

export function AuthArtSide() {
  return (
    <div
      className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[var(--surface)] border-r border-[var(--line)] flex-col justify-between p-10 select-none"
    >
      {/* Brand Header */}
      <Link href="/login" className="flex items-center gap-3 focus:outline-none z-10 group">
        <div className="seal flex-none">
          TD
        </div>
        <div>
          <div className="font-bold text-base tracking-tight text-[var(--ink)] leading-tight group-hover:text-[var(--red)] transition-colors">
            TD Hán Ngữ
          </div>
          <div className="text-xs text-[var(--ink)] mt-0.5 flex items-center gap-1.5 font-medium">
            <span>Trung tâm tiếng Trung</span>
            <span className="text-[var(--ink-3)]">·</span>
            <span className="font-han text-[13px] font-semibold text-[var(--ink)] tracking-wider">
              汉语学习中心
            </span>
          </div>
        </div>
      </Link>

      {/* Giant Calligraphic Watermark: 學 */}
      <div className="relative my-auto flex items-center justify-center" aria-hidden="true">
        <div className="font-han font-bold text-[240px] leading-none text-[var(--jade)] opacity-85 select-none pointer-events-none">
          學
        </div>

        {/* Tilted Vermilion Seal Stamp: -7 deg */}
        <div
          className="absolute right-8 top-1/2 -translate-y-1/2 w-20 h-20 border-[2.5px] border-[var(--red)] rounded-md text-[var(--red)] font-han font-bold text-[18px] leading-snug flex flex-col items-center justify-center text-center shadow-xs bg-white/60 backdrop-blur-xs pointer-events-none"
          style={{ transform: 'rotate(-7deg)' }}
        >
          <span>天地</span>
          <span>漢語</span>
        </div>
      </div>

      {/* Lunyu Quote */}
      <div className="border-l-[3px] border-[var(--red)] pl-4 max-w-[44ch] z-10">
        <p className="font-han text-xl font-semibold tracking-wide text-[var(--ink)] mb-1.5 leading-snug">
          學而時習之，不亦說乎？
        </p>
        <p className="text-xs font-medium text-[var(--ink-2)] leading-relaxed">
          &ldquo;Học mà thường ôn luyện, chẳng phải vui sao?&rdquo; —{' '}
          <span className="font-semibold text-[var(--ink)]">Luận Ngữ (論語)</span>
        </p>
      </div>
    </div>
  );
}
