import { photoFileKey } from './aiImageClassification';
import { savePhotoToFirestore, uploadPhotoToStorage } from './photoService';
import { ClassificationResult, NewPhoto, Photo } from '@/types/photo';

const FALLBACK_CLASSIFICATION: ClassificationResult = {
  category: 'creative',
  confidence: 0,
  allPredictions: [{ category: 'creative', confidence: 0 }],
  reasoning: 'Awaiting manual review',
};

export type RejectedPhotoFile = {
  file: File;
  reason: 'format' | 'size';
};

export function validatePhotoFiles(files: Iterable<File>): {
  accepted: File[];
  rejected: RejectedPhotoFile[];
} {
  const accepted: File[] = [];
  const rejected: RejectedPhotoFile[] = [];

  for (const file of files) {
    if (!file.type.startsWith('image/')) rejected.push({ file, reason: 'format' });
    else if (file.size > 50 * 1024 * 1024) rejected.push({ file, reason: 'size' });
    else accepted.push(file);
  }

  return { accepted, rejected };
}

export async function publishPhotoFiles(options: {
  files: File[];
  classifications: Map<string, ClassificationResult>;
  buildPhoto: (file: File, classification: ClassificationResult, image: string) => NewPhoto;
  onProgress?: (file: File, progress: number) => void;
}): Promise<{ photos: Photo[]; failures: Array<{ file: File; error: unknown }> }> {
  const photos: Photo[] = [];
  const failures: Array<{ file: File; error: unknown }> = [];
  const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const concurrency = mobile ? 1 : 2;
  const delay = mobile ? 300 : 200;

  for (let offset = 0; offset < options.files.length; offset += concurrency) {
    const batch = options.files.slice(offset, offset + concurrency);
    await Promise.all(batch.map(async file => {
      try {
        const image = await uploadPhotoToStorage(file, progress => options.onProgress?.(file, progress));
        const classification = options.classifications.get(photoFileKey(file)) ?? FALLBACK_CLASSIFICATION;
        const photo = options.buildPhoto(file, classification, image);
        photos.push({ id: await savePhotoToFirestore(photo), ...photo });
      } catch (error) {
        failures.push({ file, error });
      }
    }));

    if (offset + concurrency < options.files.length) {
      await new Promise(resolve => window.setTimeout(resolve, delay));
    }
  }

  return { photos, failures };
}
