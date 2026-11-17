'use client';

import Image from 'next/image';
import React, { useEffect, useState } from 'react';
import { fetchMedia } from '@/features/assessments/api/assessments.api';

export type MediaItem = { id: string; kind: string; mime: string };

const FIELD =
  'w-full min-w-0 max-w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none';

export function MediaThumb({
  assessmentId,
  mediaId,
  className = 'max-h-28 w-full object-contain',
}: {
  assessmentId: string;
  mediaId: string;
  className?: string;
}) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let objectUrl = '';
    const controller = new AbortController();
    void fetchMedia(assessmentId, mediaId, controller.signal)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [assessmentId, mediaId]);
  if (!url) return <span className="text-xs text-[var(--ink-3)]">Đã gắn ảnh minh họa</span>;
  return (
    <Image
      src={url}
      alt="Ảnh đính kèm"
      width={320}
      height={160}
      unoptimized
      className={className}
    />
  );
}

export function MediaAudioPlayer({
  assessmentId,
  mediaId,
}: {
  assessmentId: string;
  mediaId: string;
}) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let objectUrl = '';
    const controller = new AbortController();
    void fetchMedia(assessmentId, mediaId, controller.signal)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [assessmentId, mediaId]);

  if (!url) return <span className="text-xs text-[var(--ink-3)]">Đang tải file âm thanh...</span>;
  return (
    <audio
      controls
      preload="metadata"
      src={url}
      aria-label="Trình phát âm thanh"
      className="w-full max-w-md"
    />
  );
}

export function MediaAttach({
  kind,
  value,
  library,
  assessmentId,
  onChange,
  onUpload,
}: {
  kind: 'AUDIO' | 'IMAGE';
  value: string;
  library: MediaItem[];
  assessmentId?: string;
  onChange: (id: string) => void;
  onUpload?: (file: File) => Promise<string>;
}) {
  const items = library.filter((m) => m.kind === kind);
  const accept = kind === 'AUDIO' ? '.mp3,.m4a,.wav' : '.jpg,.jpeg,.png';
  const label = kind === 'AUDIO' ? 'Tải audio' : 'Tải ảnh';
  return (
    <div className="min-w-0 space-y-2">
      {value && assessmentId && kind === 'IMAGE' ? <MediaThumb assessmentId={assessmentId} mediaId={value} /> : null}
      {value && assessmentId && kind === 'AUDIO' ? (
        <MediaAudioPlayer assessmentId={assessmentId} mediaId={value} />
      ) : value && kind === 'AUDIO' ? (
        <p className="text-xs text-[var(--ink-3)]">Đã gắn audio</p>
      ) : null}
      {items.length > 0 ? (
        <select
          className={FIELD}
          value={value}
          aria-label={kind === 'AUDIO' ? 'Chọn audio có sẵn' : 'Chọn ảnh có sẵn'}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Chọn file đã tải</option>
          {items.map((m, i) => (
            <option key={m.id} value={m.id}>{kind === 'AUDIO' ? `Audio ${i + 1}` : `Ảnh ${i + 1}`}</option>
          ))}
        </select>
      ) : null}
      {onUpload ? (
        <input
          type="file"
          accept={accept}
          aria-label={label}
          className="block w-full max-w-full text-xs text-[var(--ink-2)]"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            void onUpload(file).then(onChange).catch(() => undefined);
          }}
        />
      ) : null}
    </div>
  );
}
