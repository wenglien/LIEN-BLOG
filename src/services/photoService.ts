import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from 'firebase/storage';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  orderBy,
  query,
  Timestamp
} from 'firebase/firestore';
import { storage, db, auth } from '../config/firebase';
import { compressImage, blobToFile, formatFileSize } from '../utils/imageCompression';
import { NewPhoto, normalizePhotoCategory, Photo } from '@/types/photo';

function toPhoto(id: string, data: Record<string, unknown>): Photo {
  return {
    id,
    category: normalizePhotoCategory(data.category),
    title: typeof data.title === 'string' ? data.title : '',
    description: typeof data.description === 'string' ? data.description.trim() : '',
    image: typeof data.imageUrl === 'string' ? data.imageUrl : '',
    date: typeof data.date === 'string' ? data.date : new Date().toISOString().slice(0, 10),
    location: typeof data.location === 'string' ? data.location : '',
    camera: typeof data.camera === 'string' ? data.camera : '',
    lens: typeof data.lens === 'string' ? data.lens : '',
    settings: typeof data.settings === 'string' ? data.settings : '',
    isAIClassified: data.isAIClassified === true,
    aiConfidence: typeof data.aiConfidence === 'number' ? data.aiConfidence : 0,
  };
}

// Upload photo to Firebase Storage
export async function uploadPhotoToStorage(file: File, onProgress?: (progress: number) => void): Promise<string> {
  try {
    // Check Firebase config
    if (!storage) {
      const errorMsg = 'Firebase Storage is not configured correctly, please check environment variables and Firebase initialization';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    if (!auth?.currentUser || auth.currentUser.isAnonymous) {
      throw new Error('請先使用管理員帳號登入後再上傳照片。');
    }

    // Optimized compression: Skip compression for small files and large files to reduce CPU load
    console.log(`Original file size: ${formatFileSize(file.size)}, checking if compression needed...`);
    onProgress?.(5);

    let fileToUpload = file;
    const fileSizeMB = file.size / (1024 * 1024);

    // Check if file is RAW format (should skip compression)
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
    const rawFormats = ['cr2', 'nef', 'arw', 'raf', 'orf', 'rw2', 'dng', 'crw', 'srw', '3fr', 'fff', 'pef', 'x3f', 'raw'];
    const isRawFile = rawFormats.includes(fileExtension);

    // Skip compression for:
    // 1. Files larger than 8MB (to avoid memory issues and browser freezing)
    // 2. RAW format files (they need to be uploaded as-is)
    // 3. Files smaller than 1MB (no need to compress)
    // Only compress files between 1MB and 8MB that are not RAW format
    const shouldCompress = !isRawFile && fileSizeMB > 1 && fileSizeMB <= 8;

    if (shouldCompress) {
      try {
        // Add timeout for compression to prevent hanging
        const compressionPromise = compressImage(file, {
          forceResize: true,
          targetWidth: 1920,
          targetHeight: 1920,
          quality: 0.8, // Slightly lower quality for faster processing
          maxSizeMB: 2
        });

        // Set timeout (60 seconds for compression)
        const timeoutPromise = new Promise<Blob>((_, reject) => {
          setTimeout(() => reject(new Error('Compression timeout')), 60000);
        });

        const compressedBlob = await Promise.race([compressionPromise, timeoutPromise]);

        // Convert to File object
        const mimeType = file.type || `image/${fileExtension === 'png' ? 'png' : 'jpeg'}`;
        fileToUpload = blobToFile(compressedBlob, file.name, mimeType);

        console.log(`Compressed from ${formatFileSize(file.size)} to ${formatFileSize(fileToUpload.size)}`);
        onProgress?.(15);
      } catch (compressionError) {
        console.warn('Image compression failed or timed out, using original file:', compressionError);
        // If compression fails or times out, use original file
        fileToUpload = file;
        onProgress?.(15);
      }
    } else {
      if (isRawFile) {
        console.log(`File is RAW format (${fileExtension}), skipping compression to preserve quality`);
      } else if (fileSizeMB > 8) {
        console.log(`File is large (${formatFileSize(file.size)}), skipping compression to avoid memory issues`);
      } else {
        console.log(`File is small (${formatFileSize(file.size)}), skipping compression`);
      }
      onProgress?.(15);
    }

    // Create unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const fileName = `${timestamp}_${randomId}_${fileToUpload.name}`;
    const storageRef = ref(storage, `photos/${fileName}`);

    // Confirm Storage path
    console.log('Upload to Storage path:', storageRef.fullPath);
    console.log('Storage Bucket:', storage.app.options.storageBucket);

    // Upload file with progress tracking using uploadBytesResumable
    return new Promise<string>((resolve, reject) => {
      const uploadTask = uploadBytesResumable(storageRef, fileToUpload);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // Calculate upload progress
          // Compression takes 0-15%, upload takes 15-95%, getting URL takes 95-100%
          const uploadProgress = (snapshot.bytesTransferred / snapshot.totalBytes) * 80; // 80% of total (15% to 95%)
          const totalProgress = 15 + uploadProgress;
          onProgress?.(Math.min(totalProgress, 95));
        },
        (error) => {
          console.error('Upload error:', error);
          reject(error);
        },
        async () => {
          try {
            // Upload complete, get download URL
            onProgress?.(95);
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            onProgress?.(100);
            console.log('Photo upload success:', downloadURL);
            resolve(downloadURL);
          } catch (error) {
            reject(error);
          }
        }
      );
    });

  } catch (error: any) {
    console.error('Photo upload failed:', error);
    console.error('Error details:', {
      code: error?.code,
      message: error?.message,
      stack: error?.stack
    });

    // Provide detailed error message
    if (error?.code) {
      // Firebase Storage error codes
      if (error.code === 'storage/unauthorized') {
        throw new Error('沒有上傳權限，請確認已使用管理員帳號登入。');
      } else if (error.code === 'storage/canceled') {
        throw new Error('Upload canceled');
      } else if (error.code === 'storage/unknown') {
        throw new Error('Unknown error, please check browser console');
      } else if (error.code === 'storage/invalid-format') {
        throw new Error('Invalid file format');
      } else if (error.code === 'storage/retry-limit-exceeded') {
        throw new Error('Upload retry limit exceeded, please check network connection');
      }
    }

    if (error instanceof Error) {
      if (error.message.includes('permission') || error.message.includes('unauthorized')) {
        throw new Error('沒有上傳權限，請確認已使用管理員帳號登入。');
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        throw new Error('Network connection failed, please check network connection');
      } else if (error.message.includes('quota') || error.message.includes('storage/quota-exceeded')) {
        throw new Error('Storage quota exceeded, please contact administrator');
      } else if (error.message.includes('Firebase Authentication failed')) {
        throw error; // Keep original error message
      }
    }

    // Return detailed error message
    const errorMessage = error?.message || 'Photo upload failed, please try again';
    throw new Error(errorMessage);
  }
}

// Save photo data to Firestore
export async function savePhotoToFirestore(photo: NewPhoto): Promise<string> {
  try {
    // Check Firestore config
    if (!db) {
      const errorMsg = 'Firestore is not configured correctly, please check environment variables and Firebase initialization';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Validate required fields
    if (!photo.image) {
      throw new Error('Photo URL cannot be empty');
    }

    const docRef = await addDoc(collection(db, 'photos'), {
      category: photo.category,
      title: photo.title,
      description: photo.description,
      imageUrl: photo.image,
      date: photo.date,
      location: photo.location,
      camera: photo.camera,
      lens: photo.lens,
      settings: photo.settings,
      isAIClassified: photo.isAIClassified ?? false,
      aiConfidence: photo.aiConfidence ?? 0,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    console.log('Photo data saved:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Photo data save failed:', error);

    // Provide detailed error message
    if (error instanceof Error) {
      if (error.message.includes('permission')) {
        throw new Error('No write permission, please check Firestore rules');
      } else if (error.message.includes('network')) {
        throw new Error('Network connection failed, please check network connection');
      } else if (error.message.includes('quota')) {
        throw new Error('Database quota exceeded, please contact administrator');
      }
    }

    throw new Error('Failed to save photo data, please try again');
  }
}

// Get all photos from Firestore
export async function getAllPhotos(): Promise<Photo[]> {
  try {
    // Check if Firestore is initialized
    if (!db) {
      console.warn('Firestore not initialized, cannot get photos');
      return [];
    }

    const photosRef = collection(db, 'photos');
    const q = query(photosRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);

    const photos: Photo[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      photos.push(toPhoto(doc.id, data));

      // Log if category was missing or invalid
      if (!data.category || typeof data.category !== 'string' || data.category.trim() === '') {
        console.warn(`Photo ${doc.id} has invalid category, using default 'creative'`, {
          originalCategory: data.category,
          photoId: doc.id
        });
      }

      // Log if description was missing (for debugging)
      if (!data.description || typeof data.description !== 'string') {
        console.warn(`Photo ${doc.id} has missing description`, {
          originalDescription: data.description,
          photoId: doc.id
        });
      }
    });

    console.log(`Loaded ${photos.length} photos from Firestore`);
    return photos;
  } catch (error) {
    console.error('Failed to get photos:', error);
    // Provide detailed error message
    if (error instanceof Error) {
      if (error.message.includes('permission')) {
        console.error('Firestore read permission error, please check Firestore rules');
      } else if (error.message.includes('network')) {
        console.error('Network connection error, please check network connection');
      } else if (error.message.includes('index')) {
        console.error('Firestore index error, please check if index creation is needed');
      }
    }
    // Return empty array instead of throwing, to allow app to run
    return [];
  }
}

// Update photo data
export async function updatePhotoInFirestore(photoId: string, changes: Partial<NewPhoto>): Promise<void> {
  try {
    const photoRef = doc(db, 'photos', photoId);
    const { image, ...fields } = changes;
    await updateDoc(photoRef, {
      ...fields,
      ...(image === undefined ? {} : { imageUrl: image }),
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Photo update failed:', error);
    throw new Error('Failed to update photo, please try again');
  }
}

// Delete photo
export async function deletePhoto(photoId: string, imageUrl: string): Promise<void> {
  try {
    // Delete photo data from Firestore
    await deleteDoc(doc(db, 'photos', photoId));

    // Delete photo file from Storage
    // Extract file path from full URL
    // URL format: https://firebasestorage.googleapis.com/v0/b/bucket-name/o/photos%2Ffilename?alt=media&token=...
    try {
      // Parse URL to get storage path
      const url = new URL(imageUrl);
      const pathMatch = url.pathname.match(/\/o\/(.+)$/);

      if (pathMatch && pathMatch[1]) {
        // Decode URL encoded path
        const filePath = decodeURIComponent(pathMatch[1]);
        const imageRef = ref(storage, filePath);
        await deleteObject(imageRef);
        console.log('Photo file deleted from Storage:', filePath);
      } else {
        console.warn('Cannot extract file path from URL, skipping Storage delete:', imageUrl);
      }
    } catch (storageError) {
      // If Storage delete fails (e.g. file not found), only warn
      console.warn('Storage delete failed (file might not exist):', storageError);
    }


  } catch (error: any) {
    console.error('Delete photo failed:', error);

    // Provide more detailed error message
    if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
      throw new Error('Permission denied. Please ensure: 1) Logged in as admin 2) Firebase rules allow deletion');
    }

    throw new Error(error?.message || 'Delete photo failed, please try again');
  }
}

// Batch upload photos
export async function uploadMultiplePhotos(files: File[]): Promise<string[]> {
  try {
    const uploadPromises = files.map(file => uploadPhotoToStorage(file));
    const downloadURLs = await Promise.all(uploadPromises);
    return downloadURLs;
  } catch (error) {
    console.error('Batch upload failed:', error);
    throw new Error('Batch upload failed, please try again');
  }
}

// Get photo stats
export async function getPhotoStats(): Promise<{
  totalPhotos: number;
  categories: Record<string, number>;
  totalSize: number;
}> {
  try {
    const photos = await getAllPhotos();
    const categories: Record<string, number> = {};
    let totalSize = 0;

    photos.forEach(photo => {
      categories[photo.category] = (categories[photo.category] || 0) + 1;
    });

    // Calculate total size (need to get actual size from Storage)
    // Using estimate due to Firebase Storage API limits
    totalSize = photos.length * 2;

    return {
      totalPhotos: photos.length,
      categories,
      totalSize
    };
  } catch (error) {
    console.error('Failed to get stats:', error);
    throw new Error('Failed to get stats, please try again');
  }
}
