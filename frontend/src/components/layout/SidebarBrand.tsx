'use client';

import Image from 'next/image';
import Link from 'next/link';
import React from 'react';
import { useBrandConfig } from '@/features/system-settings/hooks/useBrandConfig';

export function SidebarBrand() {
  const { centerName, centerLogo } = useBrandConfig();

  return (
    <div className="px-3 pt-4 pb-2 border-b border-[var(--line)]">
      <Link href="/" className="flex items-center gap-2.5 focus:outline-none group">
        {centerLogo ? (
          <Image
            src={centerLogo}
            alt={centerName}
            width={36}
            height={36}
            unoptimized
            className="h-9 w-9 rounded border border-[var(--line)] object-contain bg-white flex-none"
          />
        ) : (
          <div className="seal flex-none" aria-hidden="true">
            TD
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-bold text-[15px] leading-tight text-[var(--ink)] truncate group-hover:text-[var(--red)] transition-colors">
            {centerName}
          </div>
          <div className="text-[11.5px] text-[var(--ink-2)] truncate mt-0.5 font-normal">
            Quản lý lớp học · <span className="font-han text-[12px]">汉语班级管理</span>
          </div>
        </div>
      </Link>
    </div>
  );
}
