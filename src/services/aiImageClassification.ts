import { visionImageClassificationService } from './visionImageClassification';
import { ClassificationResult, Photo, PhotoCategory } from '@/types/photo';
export { PHOTO_CATEGORIES, type ClassificationResult, type PhotoCategory } from '@/types/photo';

export function photoFileKey(file: File): string {
  return `${file.name}-${file.size}`;
}

// AI Image Classification Service - Google Cloud Vision API Version
export class AIImageClassificationService {
  constructor() {
    console.log('AI Classification Service Initialized - Using Google Cloud Vision API');
  }

  // Simple fallback classification logic (when Vision API is unavailable)
  private getBasicCategory(): PhotoCategory {
    return 'creative';
  }

  private fallbackResult(reason: string): ClassificationResult {
    const category = this.getBasicCategory();
    return {
      category,
      confidence: 0.3,
      allPredictions: [{ category, confidence: 0.3 }],
      detectedObjects: ['Unidentified'],
      reasoning: reason,
    };
  }

  private loadImage(src: string, crossOrigin: boolean): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const timeout = window.setTimeout(() => reject(new Error('Image load timeout')), 30000);
      if (crossOrigin) image.crossOrigin = 'anonymous';
      image.onload = () => {
        window.clearTimeout(timeout);
        resolve(image);
      };
      image.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error(`Failed to load ${src}`));
      };
      image.src = src;
    });
  }

  // Classify image - Google Cloud Vision API
  async classifyImage(imageElement: HTMLImageElement): Promise<ClassificationResult> {
    try {
      // Use Vision API for classification
      if (visionImageClassificationService.isServiceReady()) {
        console.log('Using Google Cloud Vision API for image analysis...');
        const visionResult = await visionImageClassificationService.classifyImage(imageElement);
        console.log('Vision API classification success:', visionResult);
        return visionResult;
      } else {
        throw new Error('Google Cloud Vision API service unavailable, please check API key settings');
      }

    } catch (error) {
      console.error('Vision API classification failed:', error);

      // Simple fallback: return creative photography
      console.warn('Using fallback classification: Creative Photography');
      return this.fallbackResult('Vision unavailable; kept in Creative Photography for review');
    }
  }

  async classifyFiles(
    files: File[],
    onProgress?: (file: File, progress: number) => void,
  ): Promise<Map<string, ClassificationResult>> {
    const results = new Map<string, ClassificationResult>();

    for (const [index, file] of files.entries()) {
      const objectUrl = URL.createObjectURL(file);
      try {
        const image = new Image();
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error(`Failed to load ${file.name}`));
          image.src = objectUrl;
        });
        results.set(photoFileKey(file), await this.classifyImage(image));
      } catch (error) {
        console.error(`Failed to prepare ${file.name} for classification:`, error);
        results.set(photoFileKey(file), this.fallbackResult('Image preparation failed; kept for manual review'));
      } finally {
        URL.revokeObjectURL(objectUrl);
        onProgress?.(file, ((index + 1) / files.length) * 100);
      }
      if (index < files.length - 1) await new Promise(resolve => window.setTimeout(resolve, 500));
    }

    return results;
  }

  async classifyPhotos(
    photos: Pick<Photo, 'id' | 'image'>[],
    onProgress?: (photo: Pick<Photo, 'id' | 'image'>, progress: number) => void,
  ): Promise<Map<string, ClassificationResult>> {
    const results = new Map<string, ClassificationResult>();

    for (const [index, photo] of photos.entries()) {
      if (!photo.image) continue;
      try {
        let image: HTMLImageElement;
        try {
          image = await this.loadImage(photo.image, true);
        } catch {
          image = await this.loadImage(photo.image, false);
        }
        results.set(String(photo.id), await this.classifyImage(image));
        onProgress?.(photo, ((index + 1) / photos.length) * 100);
      } catch (error) {
        console.error(`Failed to classify photo ${photo.id}:`, error);
      }
      if (index < photos.length - 1) await new Promise(resolve => window.setTimeout(resolve, 500));
    }

    return results;
  }

  // Check if Vision API is available
  isReady(): boolean {
    return visionImageClassificationService.isServiceReady();
  }

  // Get available AI service types
  getAvailableServices(): string[] {
    const services: string[] = [];
    if (visionImageClassificationService.isServiceReady()) {
      services.push('Google Cloud Vision API');
    } else {
      services.push('Basic Classification');
    }
    return services;
  }

}

// Create singleton instance
export const aiImageClassificationService = new AIImageClassificationService();
