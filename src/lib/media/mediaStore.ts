import { get, set, del, createStore } from 'idb-keyval';
import { nanoid } from 'nanoid';

const mediaStore = createStore('ecm-media', 'media');

export type MediaKind = 'image' | 'video';

export interface LocalMediaItem {
  id: string;
  blob: Blob;
  mimeType: string;
  kind: MediaKind;
  width?: number;
  height?: number;
  /** kind: 'video' only */
  durationSec?: number;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_VIDEO_BYTES = 60 * 1024 * 1024; // 60 MB — story backgrounds only, re-encode short clips for best results
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const VIDEO_TYPES = ['video/mp4', 'video/webm'];

function getImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = url;
  });
}

function getVideoMetadata(blob: Blob): Promise<{ width: number; height: number; durationSec: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.onloadedmetadata = () => {
      resolve({ width: video.videoWidth, height: video.videoHeight, durationSec: video.duration || 0 });
      URL.revokeObjectURL(url);
    };
    video.onerror = () => resolve({ width: 0, height: 0, durationSec: 0 });
    video.src = url;
  });
}

export async function saveMedia(file: File, kind: MediaKind = 'image'): Promise<LocalMediaItem> {
  if (kind === 'video') {
    if (!VIDEO_TYPES.includes(file.type)) {
      throw new Error('Unsupported video type. Use MP4 or WebM.');
    }
    if (file.size > MAX_VIDEO_BYTES) {
      throw new Error('Video too large. Maximum size is 60 MB — trim or re-encode a shorter clip.');
    }
    const meta = await getVideoMetadata(file);
    const item: LocalMediaItem = {
      id: nanoid(),
      blob: file,
      mimeType: file.type,
      kind: 'video',
      width: meta.width,
      height: meta.height,
      durationSec: meta.durationSec,
    };
    await set(item.id, item, mediaStore);
    return item;
  }

  if (!IMAGE_TYPES.includes(file.type)) {
    throw new Error('Unsupported image type. Use PNG, JPG, WebP, or GIF.');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('Image too large. Maximum size is 5 MB.');
  }

  const dims = await getImageDimensions(file);
  const item: LocalMediaItem = {
    id: nanoid(),
    blob: file,
    mimeType: file.type,
    kind: 'image',
    width: dims.width,
    height: dims.height,
  };

  await set(item.id, item, mediaStore);
  return item;
}

export async function getMedia(id: string): Promise<LocalMediaItem | undefined> {
  return get<LocalMediaItem>(id, mediaStore);
}

export async function deleteMedia(id: string): Promise<void> {
  return del(id, mediaStore);
}

export async function resolveObjectUrl(id: string): Promise<string | undefined> {
  const item = await getMedia(id);
  if (!item) return undefined;
  return URL.createObjectURL(item.blob);
}
