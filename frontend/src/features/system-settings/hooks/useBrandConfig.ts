'use client';

import { useEffect, useState } from 'react';
import {
  getSystemConfig,
  SYSTEM_CONFIG_UPDATED_EVENT,
  type SystemConfigDto,
} from '@/features/system-settings/api/system-settings.api';
import { sanitizeBrandLogoSrc } from '@/features/system-settings/utils/logo';

const DEFAULT_CENTER_NAME = 'Trung Tâm TD Hán Ngữ';

interface BrandConfig {
  centerName: string;
  centerLogo: string | null;
}

/**
 * Thương hiệu trung tâm (tên + logo) cho thanh điều hướng.
 * Tải cấu hình một lần và cập nhật trực tiếp qua SYSTEM_CONFIG_UPDATED_EVENT;
 * sự kiện cập nhật luôn thắng phản hồi tải ban đầu nếu phản hồi này về muộn hơn.
 */
export function useBrandConfig(): BrandConfig {
  const [centerName, setCenterName] = useState<string>(DEFAULT_CENTER_NAME);
  const [centerLogo, setCenterLogo] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    function handleSystemConfigUpdated(event: Event) {
      const updated = (event as CustomEvent<SystemConfigDto>).detail;
      if (!updated) return;
      controller.abort();
      if (updated.centerName) {
        setCenterName(updated.centerName);
      }
      setCenterLogo(
        sanitizeBrandLogoSrc(updated.centerLogoBase64 ?? updated.centerLogoUrl),
      );
    }

    window.addEventListener(
      SYSTEM_CONFIG_UPDATED_EVENT,
      handleSystemConfigUpdated,
    );

    void (async () => {
      try {
        const cfg = await getSystemConfig({ signal: controller.signal });
        if (!controller.signal.aborted && cfg?.centerName) {
          setCenterName(cfg.centerName);
          setCenterLogo(
            sanitizeBrandLogoSrc(cfg.centerLogoBase64 ?? cfg.centerLogoUrl),
          );
        }
      } catch {
        // Fallback mặc định khi chưa đăng nhập hoặc endpoint cấu hình không khả dụng
      }
    })();

    return () => {
      controller.abort();
      window.removeEventListener(
        SYSTEM_CONFIG_UPDATED_EVENT,
        handleSystemConfigUpdated,
      );
    };
  }, []);

  return { centerName, centerLogo };
}
