'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useSyncExternalStore } from 'react';
import {
  getSystemConfig,
  SYSTEM_CONFIG_UPDATED_EVENT,
  type SystemConfigDto,
} from '@/features/system-settings/api/system-settings.api';
import { sanitizeBrandLogoSrc } from '@/features/system-settings/utils/logo';

const DEFAULT_CENTER_NAME = 'Trung Tâm TD Hán Ngữ';
const REVALIDATE_COOLDOWN_MS = 500;

export interface BrandConfig {
  centerName: string;
  centerLogo: string | null;
}

const DEFAULT_BRAND: BrandConfig = {
  centerName: DEFAULT_CENTER_NAME,
  centerLogo: null,
};

let cachedBrand: BrandConfig = DEFAULT_BRAND;
let lastFetchedAt = 0;
let inFlightFetch: Promise<BrandConfig> | null = null;
const subscribers = new Set<() => void>();

function toBrandConfig(cfg: SystemConfigDto | null | undefined): BrandConfig {
  return {
    centerName: cfg?.centerName?.trim() || DEFAULT_CENTER_NAME,
    centerLogo: sanitizeBrandLogoSrc(cfg?.centerLogoBase64 ?? cfg?.centerLogoUrl),
  };
}

function broadcastBrand(next: BrandConfig): void {
  cachedBrand = next;
  if (typeof document !== 'undefined') {
    document.title = `${next.centerName} — Hệ Thống Quản Trị Học Tập`;
  }
  subscribers.forEach((listener) => listener());
}

export async function refreshSharedBrandConfig(force = false): Promise<BrandConfig> {
  if (typeof window === 'undefined') return cachedBrand;
  const now = Date.now();
  if (!force && lastFetchedAt > 0 && now - lastFetchedAt < REVALIDATE_COOLDOWN_MS) {
    return cachedBrand;
  }
  if (inFlightFetch) return inFlightFetch;

  inFlightFetch = getSystemConfig()
    .then((cfg) => {
      lastFetchedAt = Date.now();
      const next = toBrandConfig(cfg);
      broadcastBrand(next);
      return next;
    })
    .catch(() => {
      lastFetchedAt = Date.now();
      return cachedBrand;
    })
    .finally(() => {
      inFlightFetch = null;
    });

  return inFlightFetch;
}

function attachSharedListeners(): () => void {
  const onConfigUpdated = (event: Event) => {
    const updated = (event as CustomEvent<SystemConfigDto>).detail;
    if (!updated) return;
    lastFetchedAt = Date.now();
    broadcastBrand(toBrandConfig(updated));
  };
  const onFocusOrVisible = () => {
    if (document.visibilityState === 'hidden') return;
    void refreshSharedBrandConfig(false);
  };
  window.addEventListener(SYSTEM_CONFIG_UPDATED_EVENT, onConfigUpdated);
  window.addEventListener('focus', onFocusOrVisible);
  document.addEventListener('visibilitychange', onFocusOrVisible);
  return () => {
    window.removeEventListener(SYSTEM_CONFIG_UPDATED_EVENT, onConfigUpdated);
    window.removeEventListener('focus', onFocusOrVisible);
    document.removeEventListener('visibilitychange', onFocusOrVisible);
  };
}

let detachGlobalListeners: (() => void) | null = null;

function subscribeBrand(listener: () => void): () => void {
  subscribers.add(listener);
  if (!detachGlobalListeners && typeof window !== 'undefined') {
    detachGlobalListeners = attachSharedListeners();
  }
  return () => {
    subscribers.delete(listener);
    if (subscribers.size === 0 && detachGlobalListeners) {
      detachGlobalListeners();
      detachGlobalListeners = null;
    }
  };
}

const getSnapshot = () => cachedBrand;
const getServerSnapshot = () => DEFAULT_BRAND;

/**
 * Thương hiệu trung tâm (tên + logo) dùng chung qua store đơn lệ,
 * khử trùng lặp request đồng thời và tự đồng bộ khi chuyển route SPA / focus lại tab.
 */
export function useBrandConfig(): BrandConfig {
  const pathname = usePathname();
  const brand = useSyncExternalStore(subscribeBrand, getSnapshot, getServerSnapshot);

  useEffect(() => {
    void refreshSharedBrandConfig(false);
  }, [pathname]);

  return brand;
}
