export const PHOTO_CATEGORIES = {
  portrait: 'Portrait Photography',
  landscape: 'Landscape Photography',
  street: 'Street Photography',
  nature: 'Nature Photography',
  creative: 'Creative Photography',
  architecture: 'Architecture Photography',
  fashion: 'Fashion Photography',
  sports: 'Sports Photography',
  wildlife: 'Wildlife Photography',
  macro: 'Macro Photography',
  abstract: 'Abstract Photography',
  event: 'Event Photography',
  wedding: 'Wedding Photography',
  food: 'Food Photography',
  travel: 'Travel Photography',
  'black-and-white': 'Black & White Photography',
  night: 'Night Photography',
  underwater: 'Underwater Photography',
  aerial: 'Aerial Photography',
  documentary: 'Documentary Photography',
  'fine-art': 'Fine Art Photography',
  product: 'Product Photography',
  concert: 'Concert Photography',
  astrophotography: 'Astrophotography',
  urban: 'Urban Photography',
} as const;

export type PhotoCategory = keyof typeof PHOTO_CATEGORIES;

export interface ClassificationResult {
  category: PhotoCategory;
  confidence: number;
  allPredictions: Array<{
    category: PhotoCategory;
    confidence: number;
  }>;
  detectedObjects?: string[];
  reasoning?: string;
}

export function normalizePhotoCategory(value: unknown): PhotoCategory {
  const category = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return Object.prototype.hasOwnProperty.call(PHOTO_CATEGORIES, category)
    ? category as PhotoCategory
    : 'creative';
}

export interface Photo {
  id: string | number;
  category: PhotoCategory;
  title: string;
  description: string;
  image: string;
  date: string;
  location: string;
  camera: string;
  lens: string;
  settings: string;
  isAIClassified?: boolean;
  aiConfidence?: number;
}

export type NewPhoto = Omit<Photo, 'id'>;

export interface PhotoWithKeys extends Omit<Photo, 'title' | 'description' | 'date' | 'location'> {
  titleKey?: string;
  descriptionKey?: string;
  dateKey?: string;
  locationKey?: string;
  title?: string;
  description?: string;
  date?: string;
  location?: string;
}
