'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';
import type { NavGroup } from './nav-links';

interface SidebarNavProps {
  groups: NavGroup[];
  onItemClick?: () => void;
}

export function SidebarNav({ groups, onItemClick }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4" aria-label="Điều hướng chính">
      {groups.map((group) => (
        <div key={group.title}>
          <div className="px-2 pb-1.5 text-[11px] font-semibold tracking-wider text-[var(--ink-3)] uppercase">
            {group.title}
          </div>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/admin/students' && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onItemClick}
                  className={`relative flex items-center justify-between gap-2 px-2.5 py-2 rounded-[7px] text-[13.5px] font-medium transition-colors ${
                    isActive
                      ? 'bg-[var(--red-soft)] text-[var(--red-ink)] font-semibold'
                      : 'text-[var(--ink-2)] hover:bg-[var(--hover)] hover:text-[var(--ink)]'
                  }`}
                >
                  {isActive && (
                    <span
                      className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-[var(--red)]"
                      aria-hidden="true"
                    />
                  )}
                  <div className="flex items-center gap-2 truncate">
                    <span className="truncate">{item.label}</span>
                    <span className="font-han text-[12px] text-[var(--ink-2)] font-medium">
                      {item.han}
                    </span>
                  </div>
                  {typeof item.badge === 'number' && item.badge > 0 && (
                    <span className="inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-[var(--red)] px-1.5 text-[11px] font-bold text-white shadow-xs">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
