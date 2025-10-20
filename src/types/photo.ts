/**
 * Photo related type definitions
 */

export interface Photo {
  id: string | number;
  category: string;
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
