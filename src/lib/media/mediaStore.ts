import { get, set, del, createStore } from 'idb-keyval';
import { nanoid } from 'nanoid';

const mediaStore = createStore('ecm-media', 'media');

export interface LocalMediaItem {
  id: string;
  blob: Blob;
  mimeType: string;
  width?: number;
  height?: number;
}

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

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

export async function saveMedia(file: File): Promise<LocalMediaItem> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error('Unsupported image type. Use PNG, JPG, WebP, or GIF.');
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error('Image too large. Maximum size is 5 MB.');
  }

  const dims = await getImageDimensions(file);
  const item: LocalMediaItem = {
    id: nanoid(),
    blob: file,
    mimeType: file.type,
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
