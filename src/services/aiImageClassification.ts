import { visionImageClassificationService } from './visionImageClassification';

// Photography category mapping - Extended with more detailed categories
export const PHOTO_CATEGORIES = {
  'portrait': 'Portrait Photography',
  'landscape': 'Landscape Photography',
  'street': 'Street Photography',
  'nature': 'Nature Photography',
  'architecture': 'Architecture Photography',
  'fashion': 'Fashion Photography',
  'sports': 'Sports Photography',
  'wildlife': 'Wildlife Photography',
  'macro': 'Macro Photography',
  'abstract': 'Abstract Photography',
  'event': 'Event Photography',
  'wedding': 'Wedding Photography',
  'food': 'Food Photography',
  'travel': 'Travel Photography',
  'black-and-white': 'Black & White Photography',
  'night': 'Night Photography',
  'underwater': 'Underwater Photography',
  'aerial': 'Aerial Photography',
  'documentary': 'Documentary Photography',
  'fine-art': 'Fine Art Photography',
  'product': 'Product Photography',
  'concert': 'Concert Photography',
  'astrophotography': 'Astrophotography',
  'urban': 'Urban Photography'
} as const;

export type PhotoCategory = keyof typeof PHOTO_CATEGORIES;

// Image classification result interface
export interface ClassificationResult {
  category: PhotoCategory;
  confidence: number;
  allPredictions: Array<{
    category: PhotoCategory;
    confidence: number;
  }>;
  detectedObjects?: string[]; // Objects detected by Vision API
  reasoning?: string; // Classification reasoning
}

// AI Image Classification Service - Google Cloud Vision API Version
export class AIImageClassificationService {
  constructor() {
    console.log('AI Classification Service Initialized - Using Google Cloud Vision API');
  }

  // Simple fallback classification logic (when Vision API is unavailable)
  private getBasicCategory(): PhotoCategory {
    // If Vision API is unavailable, return nature as default
    return 'nature';
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
      return {
        category: this.getBasicCategory(),
        confidence: 0.3,
        allPredictions: [{ category: this.getBasicCategory(), confidence: 0.3 }],
        detectedObjects: ['Unidentified'],
        reasoning: 'Vision API unavailable, classified as abstract photography'
      };
    }
  }


  // Batch classify images - Google Cloud Vision API
  async classifyMultipleImages(imageElements: HTMLImageElement[]): Promise<ClassificationResult[]> {
    if (visionImageClassificationService.isServiceReady()) {
      console.log(`Using Google Cloud Vision API to batch analyze ${imageElements.length} images...`);
      return await visionImageClassificationService.classifyMultipleImages(imageElements);
    } else {
      // If Vision API is unavailable, return default classification
      console.warn('Vision API unavailable, all photos will be classified as Creative Photography');
      return imageElements.map(() => ({
        category: this.getBasicCategory(),
        confidence: 0.3,
        allPredictions: [{ category: this.getBasicCategory(), confidence: 0.3 }],
        detectedObjects: ['Unidentified'],
        reasoning: 'Vision API unavailable, classified as abstract photography'
      }));
    }
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

  // Reinitialize Vision API service
  async reloadModel(): Promise<void> {
    try {
      await visionImageClassificationService.reinitialize();
      console.log('Google Cloud Vision API service reinitialization complete');
    } catch (error) {
      console.error('Vision API reinitialization failed:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const aiImageClassificationService = new AIImageClassificationService();
