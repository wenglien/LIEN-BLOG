import { PhotoCategory, ClassificationResult } from './aiImageClassification';

// Google Cloud Vision API Photography Classification Service
export class VisionImageClassificationService {
  private apiEndpoint: string | null = null;
  private isReady = false;

  constructor() {
    this.initializeVision();
  }

  // Initialize Vision API
  private async initializeVision() {
    try {
      const apiEndpoint = import.meta.env.VITE_VISION_API_URL;

      if (!apiEndpoint) {
        console.warn('Vision API proxy URL not set, using fallback classification method');
        return;
      }

      this.apiEndpoint = apiEndpoint;
      this.isReady = true;
      console.log('Google Cloud Vision API initialized successfully');
    } catch (error) {
      console.error('Vision API initialization failed:', error);
      this.isReady = false;
    }
  }

  // Convert image to base64
  private async imageToBase64(imageElement: HTMLImageElement): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Cannot create canvas context'));
          return;
        }

        const width = imageElement.naturalWidth;
        const height = imageElement.naturalHeight;

        if (width === 0 || height === 0) {
          reject(new Error(`Image has invalid dimensions: ${width}x${height}`));
          return;
        }

        canvas.width = width;
        canvas.height = height;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(imageElement, 0, 0, width, height);

        // Convert to base64, adjust quality if needed
        let quality = 0.9;
        const maxSize = 20 * 1024 * 1024; // 20MB limit for Vision API

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Canvas toBlob returned null'));
            return;
          }

          // If blob is too large, reduce quality
          if (blob.size > maxSize) {
            console.warn(`Image too large (${blob.size} bytes), reducing quality...`);
            quality = 0.7;
            canvas.toBlob((smallerBlob) => {
              if (!smallerBlob) {
                reject(new Error('Failed to create smaller blob'));
                return;
              }

              if (smallerBlob.size > maxSize) {
                quality = 0.5;
                canvas.toBlob((smallestBlob) => {
                  if (!smallestBlob) {
                    reject(new Error('Image too large even after compression'));
                    return;
                  }
                  this.blobToBase64(smallestBlob).then(resolve).catch(reject);
                }, 'image/jpeg', quality);
              } else {
                this.blobToBase64(smallerBlob).then(resolve).catch(reject);
              }
            }, 'image/jpeg', quality);
          } else {
            this.blobToBase64(blob).then(resolve).catch(reject);
          }
        }, 'image/jpeg', quality);
      } catch (error) {
        reject(new Error(`Failed to convert image element: ${error instanceof Error ? error.message : String(error)}`));
      }
    });
  }

  // Convert blob to base64
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result as string;
        if (!base64Data) {
          reject(new Error('FileReader returned empty result'));
          return;
        }
        // Remove data URL prefix
        const base64 = base64Data.split(',')[1];
        if (!base64) {
          reject(new Error('Invalid base64 data'));
          return;
        }
        resolve(base64);
      };
      reader.onerror = (error) => {
        reject(new Error(`FileReader error: ${error}`));
      };
      reader.readAsDataURL(blob);
    });
  }

  // Map Vision API labels to photo categories
  private mapLabelsToCategory(labels: Array<{ description: string; score: number }>): {
    category: PhotoCategory;
    confidence: number;
    detectedObjects: string[];
    reasoning: string;
  } {
    console.log('🔍 Vision API 分析開始，收到標籤數量:', labels.length);
    console.log('📋 所有標籤:', labels.map(l => `${l.description} (${(l.score * 100).toFixed(1)}%)`));

    // Priority-based classification with enhanced keywords
    const categoryScores: Record<PhotoCategory, number> = {
      portrait: 0,
      wildlife: 0,
      architecture: 0,
      landscape: 0,
      nature: 0,
      street: 0,
      sports: 0,
      fashion: 0,
      macro: 0,
      abstract: 0,
      event: 0,
      wedding: 0,
      food: 0,
      travel: 0,
      'black-and-white': 0,
      night: 0,
      underwater: 0,
      aerial: 0,
      documentary: 0,
      'fine-art': 0,
      product: 0,
      concert: 0,
      astrophotography: 0,
      urban: 0,
    };

    // Enhanced keyword lists with more comprehensive matching
    const portraitKeywords = [
      'person', 'people', 'face', 'portrait', 'human', 'man', 'woman', 'child', 'baby', 'group',
      'portrait photography', 'headshot', 'selfie', 'crowd', 'family', 'couple', 'individual',
      'facial expression', 'smile', 'eyes', 'head', 'shoulder'
    ];

    const wildlifeKeywords = [
      'animal', 'dog', 'cat', 'bird', 'wildlife', 'pet', 'mammal', 'insect', 'fish', 'reptile',
      'wild animal', 'domestic animal', 'bird of prey', 'butterfly', 'bee', 'spider', 'snake',
      'tiger', 'lion', 'elephant', 'deer', 'rabbit', 'squirrel', 'horse', 'cow', 'sheep',
      'penguin', 'seal', 'whale', 'dolphin', 'shark', 'turtle', 'frog', 'lizard'
    ];

    const architectureKeywords = [
      'building', 'architecture', 'structure', 'bridge', 'monument', 'tower', 'skyscraper',
      'interior', 'room', 'house', 'church', 'temple', 'cathedral', 'mosque', 'palace',
      'castle', 'museum', 'library', 'theater', 'stadium', 'airport', 'station',
      'modern architecture', 'historical building', 'facade', 'dome', 'column', 'arch',
      'window', 'door', 'roof', 'wall', 'ceiling', 'floor', 'furniture', 'decoration'
    ];

    const landscapeKeywords = [
      'mountain', 'ocean', 'sea', 'lake', 'river', 'valley', 'sunset', 'sunrise', 'horizon',
      'vista', 'scenery', 'landscape', 'coast', 'beach', 'shore', 'cliff', 'canyon', 'desert',
      'forest', 'field', 'meadow', 'prairie', 'grassland', 'tundra', 'ice', 'snow',
      'cloud', 'sky', 'weather', 'storm', 'rainbow', 'aurora', 'night sky', 'star'
    ];

    const natureKeywords = [
      'plant', 'flower', 'tree', 'forest', 'leaf', 'nature', 'garden', 'vegetation', 'foliage',
      'blossom', 'petal', 'stem', 'branch', 'root', 'bark', 'moss', 'fern', 'bush', 'shrub',
      'cactus', 'succulent', 'herb', 'grass', 'weed', 'vine', 'ivy', 'bamboo', 'palm',
      'rose', 'tulip', 'sunflower', 'daisy', 'orchid', 'lily', 'cherry blossom', 'maple'
    ];

    const streetKeywords = [
      'street', 'road', 'vehicle', 'car', 'urban', 'city', 'traffic', 'sidewalk', 'pavement',
      'urban scene', 'cityscape', 'metropolis', 'downtown', 'alley', 'avenue', 'boulevard',
      'crosswalk', 'intersection', 'parking', 'bus', 'truck', 'motorcycle', 'bicycle', 'taxi',
      'subway', 'metro', 'train', 'tram', 'street sign', 'traffic light', 'lamp post',
      'shop', 'store', 'restaurant', 'cafe', 'market', 'vendor', 'pedestrian', 'crowd'
    ];

    const sportsKeywords = [
      'sport', 'athlete', 'ball', 'stadium', 'game', 'competition', 'player', 'team',
      'football', 'soccer', 'basketball', 'baseball', 'tennis', 'golf', 'swimming', 'running',
      'cycling', 'skiing', 'snowboarding', 'surfing', 'skating', 'boxing', 'wrestling',
      'gymnastics', 'volleyball', 'hockey', 'rugby', 'cricket', 'badminton', 'table tennis',
      'track and field', 'marathon', 'race', 'match', 'tournament', 'championship'
    ];

    const fashionKeywords = [
      'fashion', 'clothing', 'dress', 'outfit', 'style', 'model', 'apparel', 'garment',
      'fashion show', 'runway', 'catwalk', 'designer', 'boutique', 'wardrobe', 'accessory',
      'jewelry', 'watch', 'bag', 'shoe', 'boot', 'hat', 'cap', 'sunglasses', 'scarf',
      'jacket', 'coat', 'shirt', 'pants', 'skirt', 'suit', 'tie', 'belt', 'glove'
    ];

    // Macro photography keywords
    const macroKeywords = [
      'macro', 'close-up', 'closeup', 'microscopic', 'detail', 'texture', 'pattern',
      'insect', 'butterfly', 'bee', 'spider', 'ant', 'dragonfly', 'moth',
      'flower detail', 'petal', 'stamen', 'pollen', 'water drop', 'dew', 'crystal',
      'small object', 'miniature', 'tiny', 'magnified', 'macro lens'
    ];

    // Abstract photography keywords
    const abstractKeywords = [
      'abstract', 'artistic', 'pattern', 'texture', 'geometric', 'shape', 'form',
      'color', 'composition', 'minimalist', 'surreal', 'conceptual', 'experimental',
      'light and shadow', 'reflection', 'refraction', 'bokeh', 'blur', 'motion blur',
      'double exposure', 'multiple exposure', 'creative', 'artistic photography'
    ];

    // Event photography keywords
    const eventKeywords = [
      'event', 'party', 'celebration', 'festival', 'conference', 'meeting', 'gathering',
      'ceremony', 'award', 'presentation', 'speech', 'performance', 'show', 'exhibition',
      'opening', 'launch', 'anniversary', 'birthday', 'corporate event', 'social event'
    ];

    // Wedding photography keywords
    const weddingKeywords = [
      'wedding', 'bride', 'groom', 'marriage', 'ceremony', 'wedding dress', 'bouquet',
      'wedding cake', 'reception', 'vows', 'ring', 'engagement', 'honeymoon',
      'wedding party', 'bridesmaid', 'groomsman', 'altar', 'chapel', 'church wedding'
    ];

    // Food photography keywords
    const foodKeywords = [
      'food', 'dish', 'meal', 'cuisine', 'restaurant', 'cooking', 'recipe', 'ingredient',
      'plate', 'bowl', 'fork', 'knife', 'spoon', 'table setting', 'gourmet', 'delicious',
      'appetizer', 'main course', 'dessert', 'beverage', 'drink', 'wine', 'coffee', 'tea',
      'breakfast', 'lunch', 'dinner', 'snack', 'bakery', 'pastry', 'cake', 'bread'
    ];

    // Travel photography keywords
    const travelKeywords = [
      'travel', 'tourism', 'vacation', 'journey', 'trip', 'destination', 'sightseeing',
      'landmark', 'monument', 'tourist', 'backpack', 'luggage', 'passport', 'airport',
      'hotel', 'resort', 'beach resort', 'adventure', 'exploration', 'culture', 'local'
    ];

    // Black and white photography keywords
    const blackAndWhiteKeywords = [
      'black and white', 'monochrome', 'grayscale', 'bw', 'black white', 'mono',
      'no color', 'grayscale', 'silhouette', 'high contrast', 'dramatic lighting'
    ];

    // Night photography keywords
    const nightKeywords = [
      'night', 'nocturnal', 'dark', 'evening', 'dusk', 'dawn', 'twilight', 'nighttime',
      'night scene', 'city lights', 'neon', 'illumination', 'street light', 'moonlight',
      'night sky', 'stars', 'nightlife', 'night market', 'nightclub', 'bar', 'pub'
    ];

    // Underwater photography keywords
    const underwaterKeywords = [
      'underwater', 'diving', 'scuba', 'ocean floor', 'coral', 'reef', 'fish', 'marine',
      'sea life', 'aquatic', 'submerged', 'water', 'swimming', 'snorkeling', 'diver',
      'seaweed', 'jellyfish', 'shark', 'dolphin', 'whale', 'turtle', 'octopus', 'crab'
    ];

    // Aerial photography keywords
    const aerialKeywords = [
      'aerial', 'drone', 'bird\'s eye view', 'overhead', 'from above', 'sky view',
      'helicopter', 'airplane', 'aircraft', 'flying', 'elevation', 'height', 'altitude',
      'top view', 'vertical view', 'satellite', 'map view', 'landscape from above'
    ];

    // Documentary photography keywords
    const documentaryKeywords = [
      'documentary', 'journalism', 'reportage', 'news', 'story', 'narrative',
      'social', 'political', 'historical', 'war', 'conflict', 'protest', 'demonstration',
      'human interest', 'photojournalism', 'editorial', 'press', 'media'
    ];

    // Fine art photography keywords
    const fineArtKeywords = [
      'fine art', 'artistic', 'gallery', 'museum', 'exhibition', 'artwork', 'creative',
      'aesthetic', 'composition', 'artistic expression', 'visual art', 'contemporary art',
      'modern art', 'classical', 'sculpture', 'painting', 'art piece'
    ];

    // Product photography keywords
    const productKeywords = [
      'product', 'commercial', 'advertisement', 'ad', 'marketing', 'brand', 'logo',
      'packaging', 'box', 'bottle', 'container', 'merchandise', 'item', 'goods',
      'e-commerce', 'catalog', 'showcase', 'display', 'studio product', 'white background'
    ];

    // Concert photography keywords
    const concertKeywords = [
      'concert', 'music', 'performance', 'live music', 'band', 'singer', 'musician',
      'stage', 'audience', 'crowd', 'venue', 'arena', 'theater', 'amphitheater',
      'festival', 'music festival', 'gig', 'show', 'tour', 'rock', 'pop', 'jazz'
    ];

    // Astrophotography keywords
    const astrophotographyKeywords = [
      'astrophotography', 'astronomy', 'star', 'stars', 'galaxy', 'nebula', 'planet',
      'moon', 'sun', 'solar', 'lunar', 'constellation', 'milky way', 'universe',
      'space', 'cosmos', 'celestial', 'telescope', 'night sky', 'star trail', 'aurora'
    ];

    // Urban photography keywords (more specific than street)
    const urbanKeywords = [
      'urban', 'metropolitan', 'cityscape', 'skyline', 'downtown', 'urban area',
      'city center', 'metropolis', 'megalopolis', 'urban planning', 'city planning',
      'urban development', 'urban environment', 'city life', 'urban life'
    ];

    // Calculate scores with weighted matching
    labels.forEach((label, index) => {
      const desc = label.description.toLowerCase();
      const score = label.score;
      // Higher weight for top labels
      const weight = index < 3 ? 1.5 : index < 5 ? 1.2 : 1.0;

      // Portrait matching
      if (portraitKeywords.some(kw => desc.includes(kw))) {
        categoryScores.portrait += score * weight;
        console.log(`  ✅ 標籤 "${label.description}" 匹配 portrait (+${(score * weight).toFixed(3)})`);
      }
      // Wildlife matching
      if (wildlifeKeywords.some(kw => desc.includes(kw))) {
        categoryScores.wildlife += score * weight;
        console.log(`  ✅ 標籤 "${label.description}" 匹配 wildlife (+${(score * weight).toFixed(3)})`);
      }
      // Architecture matching
      if (architectureKeywords.some(kw => desc.includes(kw))) {
        categoryScores.architecture += score * weight;
        console.log(`  ✅ 標籤 "${label.description}" 匹配 architecture (+${(score * weight).toFixed(3)})`);
      }
      // Landscape matching
      if (landscapeKeywords.some(kw => desc.includes(kw))) {
        categoryScores.landscape += score * weight;
        console.log(`  ✅ 標籤 "${label.description}" 匹配 landscape (+${(score * weight).toFixed(3)})`);
      }
      // Nature matching
      if (natureKeywords.some(kw => desc.includes(kw))) {
        categoryScores.nature += score * weight;
        console.log(`  ✅ 標籤 "${label.description}" 匹配 nature (+${(score * weight).toFixed(3)})`);
      }
      // Street matching
      if (streetKeywords.some(kw => desc.includes(kw))) {
        categoryScores.street += score * weight;
        console.log(`  ✅ 標籤 "${label.description}" 匹配 street (+${(score * weight).toFixed(3)})`);
      }
      // Sports matching
      if (sportsKeywords.some(kw => desc.includes(kw))) {
        categoryScores.sports += score * weight;
        console.log(`  ✅ 標籤 "${label.description}" 匹配 sports (+${(score * weight).toFixed(3)})`);
      }
      // Fashion matching
      if (fashionKeywords.some(kw => desc.includes(kw))) {
        categoryScores.fashion += score * weight;
        console.log(`  ✅ 標籤 "${label.description}" 匹配 fashion (+${(score * weight).toFixed(3)})`);
      }
      // Macro matching
      if (macroKeywords.some(kw => desc.includes(kw))) {
        categoryScores.macro += score * weight;
        console.log(`  ✅ 標籤 "${label.description}" 匹配 macro (+${(score * weight).toFixed(3)})`);
      }
      // Abstract matching
      if (abstractKeywords.some(kw => desc.includes(kw))) {
        categoryScores.abstract += score * weight;
        console.log(`  ✅ 標籤 "${label.description}" 匹配 abstract (+${(score * weight).toFixed(3)})`);
      }
      // Event matching
      if (eventKeywords.some(kw => desc.includes(kw))) {
        categoryScores.event += score * weight;
        console.log(`  ✅ 標籤 "${label.description}" 匹配 event (+${(score * weight).toFixed(3)})`);
      }
      // Wedding matching
      if (weddingKeywords.some(kw => desc.includes(kw))) {
        categoryScores.wedding += score * weight;
        console.log(`  ✅ 標籤 "${label.description}" 匹配 wedding (+${(score * weight).toFixed(3)})`);
      }
      // Food matching
      if (foodKeywords.some(kw => desc.includes(kw))) {
        categoryScores.food += score * weight;
        console.log(`  ✅ 標籤 "${label.description}" 匹配 food (+${(score * weight).toFixed(3)})`);
      }
      // Travel matching
      if (travelKeywords.some(kw => desc.includes(kw))) {
        categoryScores.travel += score * weight;
        console.log(`  ✅ 標籤 "${label.description}" 匹配 travel (+${(score * weight).toFixed(3)})`);
      }
      // Black and white matching
      if (blackAndWhiteKeywords.some(kw => desc.includes(kw))) {
        categoryScores['black-and-white'] += score * weight;
        console.log(`  ✅ 標籤 "${label.description}" 匹配 black-and-white (+${(score * weight).toFixed(3)})`);
      }
      // Night matching
      if (nightKeywords.some(kw => desc.includes(kw))) {
        categoryScores.night += score * weight;
        console.log(`  ✅ 標籤 "${label.description}" 匹配 night (+${(score * weight).toFixed(3)})`);
      }
      // Underwater matching
      if (underwaterKeywords.some(kw => desc.includes(kw))) {
        categoryScores.underwater += score * weight;
        console.log(`  ✅ 標籤 "${label.description}" 匹配 underwater (+${(score * weight).toFixed(3)})`);
      }
      // Aerial matching
      if (aerialKeywords.some(kw => desc.includes(kw))) {
        categoryScores.aerial += score * weight;
        console.log(`  ✅ 標籤 "${label.description}" 匹配 aerial (+${(score * weight).toFixed(3)})`);
      }
      // Documentary matching
      if (documentaryKeywords.some(kw => desc.includes(kw))) {
        categoryScores.documentary += score * weight;
        console.log(`  ✅ 標籤 "${label.description}" 匹配 documentary (+${(score * weight).toFixed(3)})`);
      }
      // Fine art matching
      if (fineArtKeywords.some(kw => desc.includes(kw))) {
        categoryScores['fine-art'] += score * weight;
        console.log(`  ✅ 標籤 "${label.description}" 匹配 fine-art (+${(score * weight).toFixed(3)})`);
      }
      // Product matching
      if (productKeywords.some(kw => desc.includes(kw))) {
        categoryScores.product += score * weight;
        console.log(`  ✅ 標籤 "${label.description}" 匹配 product (+${(score * weight).toFixed(3)})`);
      }
      // Concert matching
      if (concertKeywords.some(kw => desc.includes(kw))) {
        categoryScores.concert += score * weight;
        console.log(`  ✅ 標籤 "${label.description}" 匹配 concert (+${(score * weight).toFixed(3)})`);
      }
      // Astrophotography matching
      if (astrophotographyKeywords.some(kw => desc.includes(kw))) {
        categoryScores.astrophotography += score * weight;
        console.log(`  ✅ 標籤 "${label.description}" 匹配 astrophotography (+${(score * weight).toFixed(3)})`);
      }
      // Urban matching
      if (urbanKeywords.some(kw => desc.includes(kw))) {
        categoryScores.urban += score * weight;
        console.log(`  ✅ 標籤 "${label.description}" 匹配 urban (+${(score * weight).toFixed(3)})`);
      }
    });

    // Log category scores
    console.log('📊 類別評分結果:');
    Object.entries(categoryScores).forEach(([cat, score]) => {
      if (score > 0) {
        console.log(`  ${cat}: ${score.toFixed(3)}`);
      }
    });

    // Find the category with highest score
    let maxScore = 0;
    let selectedCategory: PhotoCategory = 'nature'; // default
    for (const [category, score] of Object.entries(categoryScores) as [PhotoCategory, number][]) {
      if (score > maxScore) {
        maxScore = score;
        selectedCategory = category;
      }
    }

    // If no strong match, use top labels with more intelligent inference
    if (maxScore === 0 && labels.length > 0 && labels[0]) {
      console.log('⚠️ 沒有強匹配，使用頂部標籤推斷...');
      const topLabel = labels[0].description.toLowerCase();
      const topScore = labels[0].score;

      if (portraitKeywords.some(kw => topLabel.includes(kw))) {
        selectedCategory = 'portrait';
        maxScore = topScore;
      } else if (wildlifeKeywords.some(kw => topLabel.includes(kw))) {
        selectedCategory = 'wildlife';
        maxScore = topScore;
      } else if (architectureKeywords.some(kw => topLabel.includes(kw))) {
        selectedCategory = 'architecture';
        maxScore = topScore;
      } else if (landscapeKeywords.some(kw => topLabel.includes(kw))) {
        selectedCategory = 'landscape';
        maxScore = topScore;
      } else if (streetKeywords.some(kw => topLabel.includes(kw))) {
        selectedCategory = 'street';
        maxScore = topScore;
      } else if (sportsKeywords.some(kw => topLabel.includes(kw))) {
        selectedCategory = 'sports';
        maxScore = topScore;
      } else if (fashionKeywords.some(kw => topLabel.includes(kw))) {
        selectedCategory = 'fashion';
        maxScore = topScore;
      } else if (macroKeywords.some(kw => topLabel.includes(kw))) {
        selectedCategory = 'macro';
        maxScore = topScore;
      } else if (abstractKeywords.some(kw => topLabel.includes(kw))) {
        selectedCategory = 'abstract';
        maxScore = topScore;
      } else if (eventKeywords.some(kw => topLabel.includes(kw))) {
        selectedCategory = 'event';
        maxScore = topScore;
      } else if (weddingKeywords.some(kw => topLabel.includes(kw))) {
        selectedCategory = 'wedding';
        maxScore = topScore;
      } else if (foodKeywords.some(kw => topLabel.includes(kw))) {
        selectedCategory = 'food';
        maxScore = topScore;
      } else if (travelKeywords.some(kw => topLabel.includes(kw))) {
        selectedCategory = 'travel';
        maxScore = topScore;
      } else if (blackAndWhiteKeywords.some(kw => topLabel.includes(kw))) {
        selectedCategory = 'black-and-white';
        maxScore = topScore;
      } else if (nightKeywords.some(kw => topLabel.includes(kw))) {
        selectedCategory = 'night';
        maxScore = topScore;
      } else if (underwaterKeywords.some(kw => topLabel.includes(kw))) {
        selectedCategory = 'underwater';
        maxScore = topScore;
      } else if (aerialKeywords.some(kw => topLabel.includes(kw))) {
        selectedCategory = 'aerial';
        maxScore = topScore;
      } else if (documentaryKeywords.some(kw => topLabel.includes(kw))) {
        selectedCategory = 'documentary';
        maxScore = topScore;
      } else if (fineArtKeywords.some(kw => topLabel.includes(kw))) {
        selectedCategory = 'fine-art';
        maxScore = topScore;
      } else if (productKeywords.some(kw => topLabel.includes(kw))) {
        selectedCategory = 'product';
        maxScore = topScore;
      } else if (concertKeywords.some(kw => topLabel.includes(kw))) {
        selectedCategory = 'concert';
        maxScore = topScore;
      } else if (astrophotographyKeywords.some(kw => topLabel.includes(kw))) {
        selectedCategory = 'astrophotography';
        maxScore = topScore;
      } else if (urbanKeywords.some(kw => topLabel.includes(kw))) {
        selectedCategory = 'urban';
        maxScore = topScore;
      } else {
        // Default to nature but with lower confidence
        selectedCategory = 'nature';
        maxScore = topScore * 0.5;
        console.log(`  ⚠️ 使用預設分類 nature，信心度降低至 ${(maxScore * 100).toFixed(1)}%`);
      }
    }

    // Normalize confidence (ensure it's between 0 and 1)
    const confidence = Math.min(Math.max(maxScore, 0.1), 1.0);
    const topLabels = labels.slice(0, 5).map(l => l.description);
    const reasoning = `Vision API 檢測到: ${topLabels.join(', ')}`;

    console.log(`✅ 最終分類結果: ${selectedCategory} (信心度: ${(confidence * 100).toFixed(1)}%)`);
    console.log(`📝 推理: ${reasoning}`);

    return {
      category: selectedCategory,
      confidence,
      detectedObjects: labels.slice(0, 10).map(l => l.description),
      reasoning,
    };
  }

  // Analyze photography category using Vision API
  async classifyImage(imageElement: HTMLImageElement): Promise<ClassificationResult> {
    if (!this.isReady || !this.apiEndpoint) {
      throw new Error('Google Cloud Vision API proxy is not configured.');
    }

    // Validate image element
    if (!imageElement || !imageElement.src) {
      throw new Error('Invalid image element: missing src');
    }

    if (imageElement.naturalWidth === 0 || imageElement.naturalHeight === 0) {
      throw new Error(`Image not loaded: dimensions are ${imageElement.naturalWidth}x${imageElement.naturalHeight}`);
    }

    try {
      console.log('Converting image to base64...');
      const base64Image = await this.imageToBase64(imageElement);
      console.log('Image converted to base64, size:', base64Image.length, 'characters');

      // Prepare Vision API request with multiple features for better analysis
      const requestBody = {
        requests: [
          {
            image: {
              content: base64Image,
            },
            features: [
              {
                type: 'LABEL_DETECTION',
                maxResults: 30, // Increased for more comprehensive analysis
              },
              {
                type: 'OBJECT_LOCALIZATION',
                maxResults: 15, // Increased for better object detection
              },
              {
                type: 'TEXT_DETECTION',
                maxResults: 10, // Can help identify context
              },
            ],
          },
        ],
      };

      // Send request to Vision API
      console.log('🚀 發送請求到 Google Cloud Vision API...');
      console.log('📤 請求參數:', {
        imageSize: `${base64Image.length} characters`,
        features: ['LABEL_DETECTION', 'OBJECT_LOCALIZATION', 'TEXT_DETECTION']
      });

      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Vision API error response:', errorData);

        if (response.status === 400) {
          throw new Error(`Vision API Bad Request (400): ${errorData.error?.message || 'Invalid request format'}`);
        } else if (response.status === 401) {
          throw new Error('Vision API proxy rejected the request (401).');
        } else if (response.status === 403) {
          throw new Error('Vision API Forbidden (403): API key does not have permission or quota exceeded.');
        } else if (response.status === 429) {
          throw new Error('Vision API Rate Limited (429): Too many requests. Please wait and try again.');
        } else {
          throw new Error(`Vision API Error (${response.status}): ${errorData.error?.message || response.statusText}`);
        }
      }

      const result = await response.json();
      console.log('✅ Vision API 回應已收到');
      console.log('📥 完整回應:', JSON.stringify(result, null, 2));

      // Extract labels from response
      const responses = result.responses?.[0];
      if (!responses) {
        console.error('❌ 無效的 Vision API 回應格式:', result);
        throw new Error('Invalid Vision API response format');
      }

      // Combine labels from LABEL_DETECTION and OBJECT_LOCALIZATION
      const labels: Array<{ description: string; score: number }> = [];

      // Add label detection results
      if (responses.labelAnnotations && responses.labelAnnotations.length > 0) {
        console.log(`📋 標籤檢測結果: ${responses.labelAnnotations.length} 個標籤`);
        responses.labelAnnotations.forEach((label: any) => {
          labels.push({
            description: label.description,
            score: label.score || 0,
          });
        });
      } else {
        console.warn('⚠️ 未檢測到標籤 (labelAnnotations)');
      }

      // Add object localization results
      if (responses.localizedObjectAnnotations && responses.localizedObjectAnnotations.length > 0) {
        console.log(`🎯 物體定位結果: ${responses.localizedObjectAnnotations.length} 個物體`);
        responses.localizedObjectAnnotations.forEach((obj: any) => {
          labels.push({
            description: obj.name,
            score: obj.score || 0,
          });
        });
      } else {
        console.warn('⚠️ 未檢測到物體 (localizedObjectAnnotations)');
      }

      // Add text detection results (can provide context)
      if (responses.textAnnotations && responses.textAnnotations.length > 0) {
        console.log(`📝 文字檢測結果: ${responses.textAnnotations.length} 個文字區域`);
        // Use first text annotation (full text) for context
        const fullText = responses.textAnnotations[0]?.description || '';
        if (fullText) {
          console.log(`📄 檢測到的文字: "${fullText.substring(0, 100)}${fullText.length > 100 ? '...' : ''}"`);
        }
      }

      if (labels.length === 0) {
        console.error('❌ 未檢測到任何標籤或物體');
        throw new Error('No labels detected in image');
      }

      // Remove duplicates and sort by score
      const uniqueLabels = new Map<string, number>();
      labels.forEach(label => {
        const key = label.description.toLowerCase();
        if (!uniqueLabels.has(key) || uniqueLabels.get(key)! < label.score) {
          uniqueLabels.set(key, label.score);
        }
      });

      const sortedLabels = Array.from(uniqueLabels.entries())
        .map(([description, score]) => ({ description, score }))
        .sort((a, b) => b.score - a.score);

      console.log(`🎯 處理後的標籤 (共 ${sortedLabels.length} 個，去重後):`);
      sortedLabels.slice(0, 15).forEach((l, i) => {
        console.log(`  ${i + 1}. ${l.description} (${(l.score * 100).toFixed(1)}%)`);
      });

      // Map labels to photo category
      const classification = this.mapLabelsToCategory(sortedLabels);

      // Build all predictions
      const allPredictions: Array<{ category: PhotoCategory; confidence: number }> = [
        {
          category: classification.category,
          confidence: classification.confidence,
        },
      ];

      // Add alternative categories based on label scores
      // Use the classification result's detected objects to calculate alternative scores
      const alternativeScores: Record<PhotoCategory, number> = {
        portrait: 0,
        wildlife: 0,
        architecture: 0,
        landscape: 0,
        nature: 0,
        street: 0,
        sports: 0,
        fashion: 0,
        macro: 0,
        abstract: 0,
        event: 0,
        wedding: 0,
        food: 0,
        travel: 0,
        'black-and-white': 0,
        night: 0,
        underwater: 0,
        aerial: 0,
        documentary: 0,
        'fine-art': 0,
        product: 0,
        concert: 0,
        astrophotography: 0,
        urban: 0,
      };

      // Recalculate scores for alternatives using the classification's detected objects
      // This is a simplified approach - we'll use the classification result's confidence
      // and add alternatives based on the top labels that didn't match the primary category
      sortedLabels.forEach((label, index) => {
        const desc = label.description.toLowerCase();
        const score = label.score * (index < 5 ? 0.5 : 0.3); // Lower weight for alternatives

        // Simple keyword matching for alternatives (using common patterns)
        if (desc.includes('person') || desc.includes('face') || desc.includes('portrait')) alternativeScores.portrait += score;
        if (desc.includes('animal') || desc.includes('bird') || desc.includes('pet')) alternativeScores.wildlife += score;
        if (desc.includes('building') || desc.includes('architecture') || desc.includes('structure')) alternativeScores.architecture += score;
        if (desc.includes('mountain') || desc.includes('ocean') || desc.includes('landscape')) alternativeScores.landscape += score;
        if (desc.includes('plant') || desc.includes('flower') || desc.includes('tree')) alternativeScores.nature += score;
        if (desc.includes('street') || desc.includes('road') || desc.includes('vehicle')) alternativeScores.street += score;
        if (desc.includes('sport') || desc.includes('athlete') || desc.includes('ball')) alternativeScores.sports += score;
        if (desc.includes('fashion') || desc.includes('clothing') || desc.includes('dress')) alternativeScores.fashion += score;
        if (desc.includes('macro') || desc.includes('close-up') || desc.includes('closeup')) alternativeScores.macro += score;
        if (desc.includes('abstract') || desc.includes('artistic') || desc.includes('pattern')) alternativeScores.abstract += score;
        if (desc.includes('event') || desc.includes('party') || desc.includes('festival')) alternativeScores.event += score;
        if (desc.includes('wedding') || desc.includes('bride') || desc.includes('groom')) alternativeScores.wedding += score;
        if (desc.includes('food') || desc.includes('dish') || desc.includes('meal')) alternativeScores.food += score;
        if (desc.includes('travel') || desc.includes('tourism') || desc.includes('vacation')) alternativeScores.travel += score;
        if (desc.includes('black and white') || desc.includes('monochrome')) alternativeScores['black-and-white'] += score;
        if (desc.includes('night') || desc.includes('dark') || desc.includes('evening')) alternativeScores.night += score;
        if (desc.includes('underwater') || desc.includes('diving') || desc.includes('scuba')) alternativeScores.underwater += score;
        if (desc.includes('aerial') || desc.includes('drone') || desc.includes('from above')) alternativeScores.aerial += score;
        if (desc.includes('documentary') || desc.includes('journalism') || desc.includes('news')) alternativeScores.documentary += score;
        if (desc.includes('fine art') || desc.includes('gallery') || desc.includes('museum')) alternativeScores['fine-art'] += score;
        if (desc.includes('product') || desc.includes('commercial') || desc.includes('advertisement')) alternativeScores.product += score;
        if (desc.includes('concert') || desc.includes('music') || desc.includes('performance')) alternativeScores.concert += score;
        if (desc.includes('star') || desc.includes('galaxy') || desc.includes('astronomy')) alternativeScores.astrophotography += score;
        if (desc.includes('urban') || desc.includes('metropolitan') || desc.includes('cityscape')) alternativeScores.urban += score;
      });

      // Add top alternative categories
      const sortedCategories = Object.entries(alternativeScores)
        .filter(([cat]) => cat !== classification.category)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3);

      sortedCategories.forEach(([category, score]) => {
        if (score > 0.1) {
          allPredictions.push({
            category: category as PhotoCategory,
            confidence: Math.min(score, 1.0),
          });
        }
      });

      // Sort all predictions by confidence
      allPredictions.sort((a, b) => b.confidence - a.confidence);

      console.log('Vision API Classification Result:', {
        category: classification.category,
        confidence: Math.round(classification.confidence * 100) + '%',
        reasoning: classification.reasoning,
        detectedObjects: classification.detectedObjects.slice(0, 5),
      });

      const finalResult = {
        category: classification.category,
        confidence: classification.confidence,
        allPredictions,
        detectedObjects: classification.detectedObjects,
        reasoning: classification.reasoning,
      };

      console.log('🎉 Vision API 分類完成！');
      console.log('📊 最終結果:', {
        category: finalResult.category,
        confidence: `${(finalResult.confidence * 100).toFixed(1)}%`,
        detectedObjects: finalResult.detectedObjects.slice(0, 5),
        reasoning: finalResult.reasoning
      });

      return finalResult;
    } catch (error) {
      console.error('Vision API image classification failed:', error);
      throw error;
    }
  }

  // Batch classify multiple images
  async classifyMultipleImages(imageElements: HTMLImageElement[]): Promise<ClassificationResult[]> {
    if (!this.isReady || !this.apiEndpoint) {
      throw new Error('Google Cloud Vision API proxy is not configured.');
    }

    const results: ClassificationResult[] = [];

    for (let i = 0; i < imageElements.length; i++) {
      const imageElement = imageElements[i];
      if (!imageElement) {
        console.warn(`[${i + 1}/${imageElements.length}] Skipping undefined image element`);
        continue;
      }
      try {
        console.log(`[${i + 1}/${imageElements.length}] Starting classification...`);
        console.log(`Image dimensions: ${imageElement.naturalWidth}x${imageElement.naturalHeight}`);

        const result = await this.classifyImage(imageElement);
        console.log(`[${i + 1}/${imageElements.length}] Classification result:`, result.category, `(confidence: ${result.confidence})`);
        results.push(result);

        // Add delay to avoid API rate limiting
        if (i < imageElements.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`[${i + 1}/${imageElements.length}] Failed to classify image:`, error);
        console.error('Error details:', {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          imageSize: imageElement ? `${imageElement.naturalWidth}x${imageElement.naturalHeight}` : 'unknown',
        });

        throw new Error(`Failed to classify image ${i + 1}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return results;
  }

  // Check if service is available
  isServiceReady(): boolean {
    return this.isReady;
  }

  // Reinitialize service
  async reinitialize(): Promise<void> {
    this.isReady = false;
      this.apiEndpoint = null;
    await this.initializeVision();
  }
}

// Create singleton instance
export const visionImageClassificationService = new VisionImageClassificationService();
