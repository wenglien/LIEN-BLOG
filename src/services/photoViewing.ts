import { Photo } from '@/types/photo';

export function photoIdFromLocation(): string | null {
  const match = window.location.hash.match(/^#photo-(.+)$/);
  return match ? decodeURIComponent(match[1] ?? '') : null;
}

export function setPhotoLocation(photoId: Photo['id'] | null): void {
  const url = new URL(window.location.href);
  url.hash = photoId === null ? '' : `photo-${encodeURIComponent(String(photoId))}`;
  history.replaceState(null, '', url.pathname + url.search + url.hash);
}

export function photoUrl(photoId: Photo['id']): string {
  const url = new URL(window.location.href);
  url.hash = `photo-${encodeURIComponent(String(photoId))}`;
  return url.toString();
}

export async function downloadPhoto(photo: Photo, fileName: string): Promise<void> {
  let objectUrl: string | null = null;
  const link = document.createElement('a');

  try {
    const response = await fetch(photo.image);
    if (!response.ok) throw new Error(`Download failed (${response.status})`);
    objectUrl = URL.createObjectURL(await response.blob());
    link.href = objectUrl;
    link.download = fileName;
  } catch (error) {
    console.warn('Blob download unavailable, opening the original image:', error);
    link.href = photo.image;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }

  document.body.appendChild(link);
  link.click();
  link.remove();
  if (objectUrl) URL.revokeObjectURL(objectUrl);
}
