import { storage, db } from '../config/firebase';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { ref, listAll } from 'firebase/storage';

export interface FirebaseDiagnostics {
  isFirebaseInitialized: boolean;
  isStorageAvailable: boolean;
  isFirestoreAvailable: boolean;
  firestorePhotoCount: number;
  storagePhotoCount: number;
  errors: string[];
  warnings: string[];
}

/**
 * Diagnose Firebase connection and photo data status
 */
export async function diagnoseFirebase(): Promise<FirebaseDiagnostics> {
  const diagnostics: FirebaseDiagnostics = {
    isFirebaseInitialized: false,
    isStorageAvailable: false,
    isFirestoreAvailable: false,
    firestorePhotoCount: 0,
    storagePhotoCount: 0,
    errors: [],
    warnings: []
  };

  try {
    // Check if Firebase is initialized
    if (!db && !storage) {
      diagnostics.errors.push('Firebase not initialized, please check environment variables configuration');
      return diagnostics;
    }

    diagnostics.isFirebaseInitialized = true;

    // Check Firestore
    if (db) {
      diagnostics.isFirestoreAvailable = true;
      try {
        const photosRef = collection(db, 'photos');
        await getDocs(query(photosRef, limit(1)));
        // Getting total count requires reading all docs (here only checking connection)
        const allPhotos = await getDocs(photosRef);
        diagnostics.firestorePhotoCount = allPhotos.size;

        if (diagnostics.firestorePhotoCount === 0) {
          diagnostics.warnings.push('No photo data in Firestore');
        }
      } catch (error) {
        diagnostics.errors.push(`Firestore connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        diagnostics.isFirestoreAvailable = false;
      }
    } else {
      diagnostics.errors.push('Firestore not initialized');
    }

    // Check Storage
    if (storage) {
      diagnostics.isStorageAvailable = true;
      try {
        const photosRef = ref(storage, 'photos');
        const result = await listAll(photosRef);
        diagnostics.storagePhotoCount = result.items.length;

        if (diagnostics.storagePhotoCount === 0) {
          diagnostics.warnings.push('No photo files in Storage');
        }
      } catch (error) {
        diagnostics.errors.push(`Storage connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        diagnostics.isStorageAvailable = false;
      }
    } else {
      diagnostics.errors.push('Storage not initialized');
    }

    // Check data consistency
    if (diagnostics.firestorePhotoCount > 0 && diagnostics.storagePhotoCount === 0) {
      diagnostics.warnings.push('Firestore has photo data, but no corresponding files in Storage');
    }

    if (diagnostics.storagePhotoCount > 0 && diagnostics.firestorePhotoCount === 0) {
      diagnostics.warnings.push('Storage has photo files, but no corresponding data in Firestore');
    }

  } catch (error) {
    diagnostics.errors.push(`Error during diagnostics: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return diagnostics;
}

/**
 * Output diagnostics to console
 */
export function logDiagnostics(diagnostics: FirebaseDiagnostics): void {
  console.group('🔥 Firebase Diagnostics Result');

  console.log('Firebase Initialization:', diagnostics.isFirebaseInitialized ? '✅' : '❌');
  console.log('Storage Available:', diagnostics.isStorageAvailable ? '✅' : '❌');
  console.log('Firestore Available:', diagnostics.isFirestoreAvailable ? '✅' : '❌');
  console.log('Firestore Photo Count:', diagnostics.firestorePhotoCount);
  console.log('Storage Photo Count:', diagnostics.storagePhotoCount);

  if (diagnostics.errors.length > 0) {
    console.group('❌ Errors');
    diagnostics.errors.forEach(error => console.error(error));
    console.groupEnd();
  }

  if (diagnostics.warnings.length > 0) {
    console.group('⚠️ Warnings');
    diagnostics.warnings.forEach(warning => console.warn(warning));
    console.groupEnd();
  }

  if (diagnostics.errors.length === 0 && diagnostics.warnings.length === 0) {
    console.log('✅ All checks passed!');
  }

  console.groupEnd();
}
