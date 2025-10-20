import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Upload,
  X,
  CheckCircle,
  AlertCircle,
  Camera,
  Sparkles,
  Edit3,
  Trash2,
  Plus,
  Save,
  Image as ImageIcon,
  Tag,
  LogOut,
  Search,
  List,
  SortAsc,
  SortDesc,
  CheckCircle2,
  FileImage,
  FolderOpen,
  LayoutGrid,
  ImagePlus,
  RefreshCw,
  Activity,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Keyboard,
  Folder
} from 'lucide-react';
import { LiquidGlassButton } from '@/components/common/LiquidGlassButton';
import { aiImageClassificationService, ClassificationResult, PhotoCategory, PHOTO_CATEGORIES } from '@/services/aiImageClassification';
import { useAuth } from '@/contexts/AuthContext';
import {
  uploadPhotoToStorage,
  savePhotoToFirestore,
  getAllPhotos,
  updatePhotoInFirestore,
  deletePhoto as deletePhotoFromFirebase,
  PhotoData
} from '@/services/photoService';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '@/config/firebase';
import { useI18n } from '@/i18n';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { OptimizedImage } from '@/components/gallery/OptimizedImage';
import { formatFileSize } from '@/utils/imageCompression';
import { diagnoseFirebase, logDiagnostics, FirebaseDiagnostics } from '@/utils/firebaseDiagnostics';
import { localizePhoto, localizePhotoCategory } from '@/utils/photoLocalization';

interface PhotoItem {
  id: string | number;
  category: PhotoCategory | string;
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

function getPhotoCompleteness(photo: PhotoItem) {
  const fields = [photo.title, photo.description, photo.location, photo.camera, photo.lens, photo.settings];
  const completed = fields.filter(value => Boolean(value && value.trim())).length;
  const placeholderTitle = /^(新作品|new work|untitled)/i.test(photo.title || '');
  const missing = fields.length - completed + (placeholderTitle && photo.title ? 1 : 0);
  return {
    missing,
    percent: Math.max(0, Math.round(((fields.length - Math.min(missing, fields.length)) / fields.length) * 100)),
  };
}

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onPhotosUpdate: (photos: PhotoItem[]) => void;
  existingPhotos: PhotoItem[];
}

export function AdminPanel({ isOpen, onClose, onPhotosUpdate, existingPhotos }: AdminPanelProps) {
  const { t, lang } = useI18n();
  const getDisplayPhoto = useCallback(
    (photo: PhotoItem) => localizePhoto(photo, lang, t),
    [lang, t],
  );
  const { logout, isAuthenticated, firebaseUser } = useAuth();
  const [photos, setPhotos] = useState<PhotoItem[]>(existingPhotos);
  const [isDragging, setIsDragging] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [classificationResults, setClassificationResults] = useState<Map<string, ClassificationResult>>(new Map());
  const [editingPhoto, setEditingPhoto] = useState<PhotoItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Map<string, number>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'needs-review' | 'unclassified' | 'complete'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'category'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string | number>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<PhotoItem | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<PhotoItem | null>(null);
  const [inspectorPhoto, setInspectorPhoto] = useState<PhotoItem | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'manage' | 'upload'>('manage');
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [showShortcutsTooltip, setShowShortcutsTooltip] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number>(0);
  const [diagnostics, setDiagnostics] = useState<FirebaseDiagnostics | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadSectionRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const photoListRef = useRef<HTMLDivElement>(null);

  // Scroll to upload section
  const scrollToUpload = useCallback(() => {
    setActiveTab('upload');
    if (uploadSectionRef.current) {
      uploadSectionRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  }, []);

  // Optimized scroll container recalculation
  const forceScrollRecalculation = useCallback(() => {
    // Use requestAnimationFrame to ensure execution in the next render frame
    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        // Use a more efficient way to trigger recalculation
        container.style.transform = 'translateZ(0)';
        container.offsetHeight; // Trigger reflow
        container.style.transform = '';

        // Ensure scroll position remains reasonable
        if (container.scrollTop < 0) {
          container.scrollTop = 0;
        }
      }
    });
  }, []);


  // Listen for selectedFiles changes, trigger scroll recalculation
  useEffect(() => {
    if (selectedFiles.length > 0) {
      // When files are selected, delay triggering scroll recalculation and scroll to action options
      const timer = setTimeout(() => {
        forceScrollRecalculation();
      }, 300);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [selectedFiles.length, forceScrollRecalculation]);

  // Load photo data
  const loadPhotos = useCallback(async () => {
    try {
      setIsLoading(true);
      const firebasePhotos = await getAllPhotos();
      const formattedPhotos: PhotoItem[] = firebasePhotos.map(photo => ({
        id: photo.id || '',
        category: photo.category as PhotoCategory,
        title: photo.title,
        description: photo.description,
        image: photo.imageUrl,
        date: photo.date,
        location: photo.location,
        camera: photo.camera,
        lens: photo.lens,
        settings: photo.settings,
        isAIClassified: photo.isAIClassified,
        aiConfidence: photo.aiConfidence
      }));
      setPhotos(formattedPhotos);
      onPhotosUpdate(formattedPhotos);
    } catch (err) {
      console.error('Load photos failed:', err);
      setError(t('error_load_photos'));
    } finally {
      setIsLoading(false);
    }
  }, [onPhotosUpdate]);

  // Run Firebase diagnostics
  const runDiagnostics = useCallback(async () => {
    setIsDiagnosing(true);
    setError(null);
    try {
      const result = await diagnoseFirebase();
      setDiagnostics(result);
      logDiagnostics(result);

      // If there are errors, show error message
      if (result.errors.length > 0) {
        setError(t('admin_diag_errors', { count: result.errors.length }));
      } else if (result.warnings.length > 0) {
        setError(t('admin_diag_warnings', { count: result.warnings.length }));
      }
    } catch (err) {
      console.error('Diagnostics failed:', err);
      setError(t('admin_diag_error'));
    } finally {
      setIsDiagnosing(false);
    }
  }, []);

  // Fetch photos when component loads
  React.useEffect(() => {
    if (isOpen) {
      loadPhotos();
    }
  }, [isOpen, loadPhotos]);

  // Handle file selection
  const handleFileSelect = useCallback((files: FileList) => {
    const validFiles = Array.from(files).filter(file => {
      if (!file.type.startsWith('image/')) {
        setError(t('admin_file_invalid_format', { name: file.name }));
        return false;
      }
      if (file.size > 50 * 1024 * 1024) {
        setError(t('admin_file_too_large', { name: file.name }));
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setError(null);
    setSelectedFiles(prev => [...prev, ...validFiles]);
    // Trigger scroll recalculation
    forceScrollRecalculation();
  }, [forceScrollRecalculation]);

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  // Handle file input
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files);
    }
  }, [handleFileSelect]);

  // Start batch AI classification - Google Cloud Vision API
  // Returns the result map so callers (e.g. upload) can use it immediately
  const startBatchClassification = useCallback(async (): Promise<Map<string, ClassificationResult>> => {
    if (selectedFiles.length === 0) return new Map();

    // Check authentication status
    if (!isAuthenticated) {
      setError(t('admin_need_login_ai'));
      logout();
      onClose();
      return new Map();
    }

    setIsClassifying(true);
    setError(null);
    const results = new Map<string, ClassificationResult>();

    try {
      console.log(`Start analyzing ${selectedFiles.length} images using ${aiImageClassificationService.getAvailableServices().join(' + ')}`);

      // Prepare image element array
      const imageElements: HTMLImageElement[] = [];
      const fileIds: string[] = [];

      // Batch create image elements
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        if (!file) continue;

        const fileId = `${file.name}-${file.size}`;
        fileIds.push(fileId);

        try {
          const imageElement = new Image();
          imageElement.crossOrigin = 'anonymous';

          await new Promise<void>((resolve, reject) => {
            imageElement.onload = () => resolve();
            imageElement.onerror = reject;
            const objectUrl = URL.createObjectURL(file);
            imageElement.src = objectUrl;
          });

          imageElements.push(imageElement);

          // Update preparation progress
          setUploadProgress(prev => new Map(prev).set(fileId, (i + 1) / selectedFiles.length * 30));
        } catch (err) {
          console.error(`Failed to load image ${file.name}:`, err);
          // Add empty placeholder
          imageElements.push(null as any);
        }
      }

      // Use optimized batch classification
      const classificationResults = await aiImageClassificationService.classifyMultipleImages(
        imageElements.filter(img => img !== null)
      );

      // Handle classification results
      classificationResults.forEach((result, index) => {
        const fileId = fileIds[index];
        if (fileId) {
          results.set(fileId, result);
          // Update completion progress
          setUploadProgress(prev => new Map(prev).set(fileId, 100));
        }
      });

      // Clean up image URLs
      imageElements.forEach(img => {
        if (img && img.src.startsWith('blob:')) {
          URL.revokeObjectURL(img.src);
        }
      });

      setClassificationResults(results);

      // Show classification completion summary
      const successCount = classificationResults.filter(r => r.confidence > 0.5).length;
      console.log(`Batch classification complete: ${successCount}/${selectedFiles.length} images classified successfully`);

      setTimeout(() => {
        setUploadProgress(new Map());
      }, 2000);

    } catch (err) {
      console.error('Batch classification failed:', err);
      setError(t('admin_ai_classification_error'));
    } finally {
      setIsClassifying(false);
    }
    return results;
  }, [selectedFiles, isAuthenticated, logout, onClose, t]);

  // Confirm and add photos to portfolio with concurrency control
  const confirmAndAddPhotos = useCallback(async () => {
    // Check authentication status
    if (!isAuthenticated) {
      setError(t('admin_need_login_upload'));
      logout();
      onClose();
      return;
    }

    try {
      // Auto-classify: if AI hasn't run yet, do it as part of the upload flow
      let activeResults = classificationResults;
      if (activeResults.size === 0 && aiImageClassificationService.isReady()) {
        try {
          activeResults = await startBatchClassification();
        } catch (err) {
          console.warn('Auto classification failed, uploading without AI labels:', err);
        }
      }

      setIsLoading(true);
      setError(null);

      // Initialize progress for all files
      const initialProgress = new Map<string, number>();
      selectedFiles.forEach(file => {
        const fileId = `${file.name}-${file.size}`;
        initialProgress.set(fileId, 0);
      });
      setUploadProgress(initialProgress);

      const newPhotos: PhotoItem[] = [];

      // Detect mobile device and adjust settings accordingly
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const MAX_CONCURRENT_UPLOADS = isMobile ? 1 : 2; // More conservative on mobile
      const PROCESSING_DELAY = isMobile ? 300 : 200; // Longer delay on mobile to prevent overheating

      // Process files in batches with concurrency control
      const processFile = async (file: File, index: number): Promise<void> => {
        const fileId = `${file.name}-${file.size}`;
        const result = activeResults.get(fileId) || {
          category: 'creative' as PhotoCategory,
          confidence: 0.5,
          allPredictions: [{ category: 'creative' as PhotoCategory, confidence: 0.5 }]
        };

        try {
          // Add delay between files to prevent CPU overheating
          if (index > 0) {
            await new Promise(resolve => setTimeout(resolve, PROCESSING_DELAY));
          }

          // Upload photo to Firebase Storage (with progress tracking)
          const imageUrl = await uploadPhotoToStorage(file, (progress) => {
            // Update upload progress
            setUploadProgress(prev => new Map(prev).set(fileId, progress));
          });

          // Prepare photo data
          const photoData: Omit<PhotoData, 'id'> = {
            category: result.category,
            title: `${t('admin_new_work')} - ${file.name.split('.')[0]}`,
            description: result ?
              t('admin_ai_classified_desc', { category: localizePhotoCategory(result.category, t) }) :
              t('admin_new_upload_desc'),
            imageUrl: imageUrl,
            date: new Date().toLocaleDateString(lang === 'zh' ? 'zh-TW' : 'en-US', { year: 'numeric', month: 'long' }),
            location: t('admin_edit_location'),
            camera: t('admin_edit_camera'),
            lens: t('admin_edit_lens'),
            settings: t('admin_edit_settings'),
            isAIClassified: activeResults.has(fileId),
            aiConfidence: result.confidence
          };

          // Save to Firestore
          const photoId = await savePhotoToFirestore(photoData);

          // Add to local state
          newPhotos.push({
            id: photoId,
            category: photoData.category as PhotoCategory,
            title: photoData.title,
            description: photoData.description,
            image: imageUrl,
            date: photoData.date,
            location: photoData.location,
            camera: photoData.camera,
            lens: photoData.lens,
            settings: photoData.settings,
            isAIClassified: photoData.isAIClassified,
            aiConfidence: photoData.aiConfidence
          });
        } catch (uploadError: any) {
          console.error(`Failed to upload file ${file.name}:`, uploadError);
          const errorMsg = uploadError?.message || `Upload ${file.name} failed`;
          setError(`${errorMsg}. ${t('admin_upload_firebase_error')}`);
        }
      };

      // Process files with concurrency control
      const processBatch = async (files: File[], startIndex: number): Promise<void> => {
        const batch = files.slice(startIndex, startIndex + MAX_CONCURRENT_UPLOADS);
        if (batch.length === 0) return;

        // Process batch concurrently
        await Promise.all(
          batch.map((file, batchIndex) =>
            processFile(file, startIndex + batchIndex)
          )
        );

        // Process next batch after delay
        if (startIndex + MAX_CONCURRENT_UPLOADS < files.length) {
          await new Promise(resolve => setTimeout(resolve, PROCESSING_DELAY));
          await processBatch(files, startIndex + MAX_CONCURRENT_UPLOADS);
        }
      };

      // Start processing from first file
      await processBatch(selectedFiles, 0);

      // Reload all photos
      await loadPhotos();

      // Reset state
      setSelectedFiles([]);
      setClassificationResults(new Map());
      setUploadProgress(new Map());

      // Show success message
      if (newPhotos.length > 0) {
        const unclassifiedCount = newPhotos.filter(p => !p.isAIClassified).length;
        if (unclassifiedCount > 0) {
          setSuccessMessage(t('admin_upload_success_with_unclassified', { total: newPhotos.length, unclassified: unclassifiedCount }));
        } else {
          setSuccessMessage(t('admin_upload_success_all', { total: newPhotos.length }));
        }
      } else {
        setError(t('admin_upload_no_success'));
      }

    } catch (err) {
      console.error('Photo upload failed:', err);
      setError(t('error_upload_photos'));
    } finally {
      setIsLoading(false);
    }
  }, [selectedFiles, classificationResults, startBatchClassification, loadPhotos, isAuthenticated, logout, onClose]);


  // Save edits
  const savePhotoEdit = useCallback(async () => {
    if (!editingPhoto) return;

    // Check authentication status
    if (!isAuthenticated) {
      setError(t('admin_need_login_edit'));
      logout();
      onClose();
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Update photo data in Firestore
      await updatePhotoInFirestore(String(editingPhoto.id), {
        category: editingPhoto.category,
        title: editingPhoto.title,
        description: editingPhoto.description,
        location: editingPhoto.location,
        camera: editingPhoto.camera,
        lens: editingPhoto.lens,
        settings: editingPhoto.settings
      });

      // Reload all photos
      await loadPhotos();
      setEditingPhoto(null);
      setSuccessMessage(t('admin_save_success'));

    } catch (err) {
      console.error('Photo update failed:', err);
      setError(t('error_update_photo'));
    } finally {
      setIsLoading(false);
    }
  }, [editingPhoto, loadPhotos, isAuthenticated, logout, onClose, t]);

  // Close the edit modal, confirming first when there are unsaved changes
  const requestCloseEdit = useCallback(() => {
    if (editingPhoto) {
      const original = photos.find(p => p.id === editingPhoto.id);
      const fields = ['title', 'description', 'category', 'location', 'camera', 'lens', 'settings'] as const;
      const isDirty = original ? fields.some(f => original[f] !== editingPhoto[f]) : false;
      if (isDirty && !window.confirm(t('admin_unsaved_confirm') || '你有未儲存的變更,確定要捨棄嗎?')) {
        return;
      }
    }
    setEditingPhoto(null);
  }, [editingPhoto, photos, t]);

  // Delete photo
  const deletePhoto = useCallback(async (photo: PhotoItem) => {
    // Check authentication status
    if (!isAuthenticated) {
      setError(t('admin_need_login_delete'));
      logout();
      onClose();
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Delete photo from Firebase
      await deletePhotoFromFirebase(String(photo.id), photo.image);

      // Reload all photos
      await loadPhotos();

      // Clear selection
      setSelectedPhotoIds(prev => {
        const next = new Set(prev);
        next.delete(photo.id);
        return next;
      });

      setSuccessMessage(t('admin_delete_success'));

    } catch (err) {
      console.error('Photo delete failed:', err);
      setError(t('error_delete_photo') + (err instanceof Error ? `: ${err.message}` : ''));
    } finally {
      setIsLoading(false);
    }
  }, [loadPhotos, t, isAuthenticated, logout, onClose]);

  // Batch delete photos
  const deleteSelectedPhotos = useCallback(async () => {
    if (selectedPhotoIds.size === 0) return;

    // Check authentication status
    if (!isAuthenticated) {
      setError(t('admin_need_login_delete'));
      logout();
      onClose();
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const photosToDelete = photos.filter(p => selectedPhotoIds.has(p.id));

      for (const photo of photosToDelete) {
        await deletePhotoFromFirebase(String(photo.id), photo.image);
      }

      // Reload all photos
      await loadPhotos();

      // Clear selection
      const deletedCount = selectedPhotoIds.size;
      setSelectedPhotoIds(new Set());
      setSuccessMessage(t('admin_batch_delete_success', { count: deletedCount }));

    } catch (err) {
      console.error('Batch delete failed:', err);
      setError(t('admin_batch_delete_failed'));
    } finally {
      setIsLoading(false);
    }
  }, [selectedPhotoIds, photos, loadPhotos, isAuthenticated, logout, onClose, t]);

  // Batch change category
  const batchChangeCategory = useCallback(async (newCategory: PhotoCategory) => {
    if (selectedPhotoIds.size === 0) return;

    if (!isAuthenticated) {
      setError(t('admin_need_login_edit'));
      logout();
      onClose();
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const photosToUpdate = photos.filter(p => selectedPhotoIds.has(p.id));

      for (const photo of photosToUpdate) {
        await updatePhotoInFirestore(String(photo.id), { category: newCategory });
      }

      await loadPhotos();

      const updatedCount = selectedPhotoIds.size;
      setSelectedPhotoIds(new Set());
      setShowCategoryMenu(false);
      setSuccessMessage(t('admin_category_changed_success', { count: updatedCount }));

    } catch (err) {
      console.error('Batch category change failed:', err);
      setError(t('admin_batch_category_failed'));
    } finally {
      setIsLoading(false);
    }
  }, [selectedPhotoIds, photos, loadPhotos, isAuthenticated, logout, onClose, t]);

  // Classify unclassified photos
  const classifyUnclassifiedPhotos = useCallback(async () => {
    // Check authentication status
    if (!isAuthenticated) {
      setError(t('admin_need_login_ai'));
      logout();
      onClose();
      return;
    }

    // Check if AI service is ready
    if (!aiImageClassificationService.isReady()) {
      setError(t('admin_ai_service_not_ready'));
      return;
    }

    // Get unclassified photos
    const unclassifiedPhotos = photos.filter(p => !p.isAIClassified);

    if (unclassifiedPhotos.length === 0) {
      setSuccessMessage(t('admin_all_classified'));
      return;
    }

    setIsClassifying(true);
    setError(null);

    try {
      console.log(`開始對 ${unclassifiedPhotos.length} 張未分類照片進行 AI 分類...`);

      // Load images from URLs
      const imageElements: HTMLImageElement[] = [];
      const photoIds: string[] = [];
      const photoMap = new Map<string, PhotoItem>(); // Map to track photo data

      for (let i = 0; i < unclassifiedPhotos.length; i++) {
        const photo = unclassifiedPhotos[i];
        if (!photo || !photo.image) {
          console.warn(`Photo ${photo?.id ?? i} has no image URL`);
          continue;
        }

        try {
          let imageUrl = photo.image;

          // Try to get a fresh download URL from Firebase Storage if the URL is from Firebase Storage
          if (photo.image.includes('firebasestorage.googleapis.com') && storage) {
            try {
              // Extract the file path from the URL
              const url = new URL(photo.image);
              const pathMatch = url.pathname.match(/\/o\/(.+)$/);

              if (pathMatch && pathMatch[1]) {
                const filePath = decodeURIComponent(pathMatch[1]);
                const imageRef = ref(storage, filePath);
                // Get a fresh download URL with proper CORS headers
                imageUrl = await getDownloadURL(imageRef);
                console.log(`Got fresh download URL for photo ${photo.id}`);
              }
            } catch (urlError) {
              console.warn(`Failed to get fresh URL for photo ${photo.id}, using original URL:`, urlError);
              // Continue with original URL
            }
          }

          // Try loading with CORS first
          let imageElement = new Image();
          imageElement.crossOrigin = 'anonymous';

          try {
            await new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(() => {
                reject(new Error('Image load timeout'));
              }, 30000);

              imageElement.onload = () => {
                clearTimeout(timeout);
                resolve();
              };
              imageElement.onerror = () => {
                clearTimeout(timeout);
                reject(new Error('CORS load failed'));
              };
              imageElement.src = imageUrl;
            });
          } catch (corsError) {
            // If CORS fails, try without CORS
            console.warn(`CORS load failed for photo ${photo.id}, trying without CORS...`);
            imageElement = new Image();
            // Don't set crossOrigin for fallback

            await new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(() => {
                reject(new Error('Image load timeout'));
              }, 30000);

              imageElement.onload = () => {
                clearTimeout(timeout);
                resolve();
              };
              imageElement.onerror = (err) => {
                clearTimeout(timeout);
                console.error(`Failed to load image for photo ${photo.id}:`, photo.image, err);
                reject(new Error(`Failed to load image: ${photo.image}`));
              };
              imageElement.src = imageUrl;
            });
          }

          imageElements.push(imageElement);
          photoIds.push(String(photo.id));
          photoMap.set(String(photo.id), photo);

          // Update progress
          setUploadProgress(prev => new Map(prev).set(String(photo.id), ((i + 1) / unclassifiedPhotos.length) * 50));
        } catch (err) {
          console.error(`Failed to load image for photo ${photo.id}:`, err);
          // Continue with other photos
        }
      }

      if (imageElements.length === 0) {
        setError(t('admin_ai_classification_error'));
        setIsClassifying(false);
        return;
      }

      console.log(`成功載入 ${imageElements.length} 張照片，開始 AI 分類...`);
      console.log('AI 服務狀態:', aiImageClassificationService.isReady());
      console.log('可用服務:', aiImageClassificationService.getAvailableServices());

      if (!aiImageClassificationService.isReady()) {
        throw new Error('AI 服務未就緒。請設定安全的 Vision API 後端代理（VITE_VISION_API_URL）。');
      }

      // Perform AI classification
      let classificationResults: ClassificationResult[];
      try {
        classificationResults = await aiImageClassificationService.classifyMultipleImages(imageElements);
        console.log(`AI 分類完成，獲得 ${classificationResults.length} 個結果`);
      } catch (classificationError) {
        console.error('AI 分類過程出錯:', classificationError);
        throw new Error(`AI 分類失敗: ${classificationError instanceof Error ? classificationError.message : String(classificationError)}`);
      }

      if (classificationResults.length !== imageElements.length) {
        console.warn(`分類結果數量 (${classificationResults.length}) 與圖片數量 (${imageElements.length}) 不匹配`);
      }

      // Update photos in Firestore
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < classificationResults.length && i < photoIds.length; i++) {
        const result = classificationResults[i];
        const photoId = photoIds[i];
        if (!result || !photoId) {
          failCount++;
          continue;
        }
        const photo = photoMap.get(photoId);

        if (photo && result && result.category) {
          try {
            // Ensure category is a valid string
            const category = (result.category && typeof result.category === 'string' && result.category.trim() !== '')
              ? result.category.trim()
              : null;

            if (!category) {
              console.warn(`Invalid category for photo ${photoId}:`, result.category);
              failCount++;
              continue;
            }

            await updatePhotoInFirestore(photoId, {
              category: category,
              isAIClassified: true,
              aiConfidence: result.confidence || 0.5,
              description: result.confidence && result.confidence > 0.5
                ? `${photo.description || ''} [${t('admin_ai_classification_note', { category: localizePhotoCategory(category, t) })}]`.trim()
                : photo.description
            });
            successCount++;
            console.log(`成功更新照片 ${photoId} 的分類為: ${result.category}`);

            // Update progress
            setUploadProgress(prev => new Map(prev).set(photoId, 50 + ((i + 1) / classificationResults.length) * 50));
          } catch (err) {
            console.error(`Failed to update photo ${photoId}:`, err);
            failCount++;
          }
        } else {
          console.warn(`照片 ${photoId} 的分類結果無效:`, result);
          failCount++;
        }
      }

      // Reload photos
      await loadPhotos();

      // Clear progress
      setTimeout(() => {
        setUploadProgress(new Map());
      }, 2000);

      if (successCount > 0) {
        const failedSuffix = failCount > 0 ? t('admin_ai_classify_failed_suffix', { count: failCount }) : '';
        setSuccessMessage(t('admin_ai_classify_success', { success: successCount, total: unclassifiedPhotos.length, failed: failedSuffix }));
      } else {
        setError(t('admin_ai_classify_error'));
      }

    } catch (err) {
      console.error('AI classification failed:', err);
      const errorMessage = err instanceof Error ? err.message : t('admin_ai_classify_error');
      setError(`${errorMessage}`);
    } finally {
      setIsClassifying(false);
    }
  }, [photos, isAuthenticated, logout, onClose, loadPhotos, t]);

  // Shared: classify a specific list of photos via AI and update Firestore
  const classifyPhotosById = useCallback(async (photosToClassify: PhotoItem[]) => {
    if (photosToClassify.length === 0) return;

    setIsClassifying(true);
    setError(null);

    try {
      const imageElements: HTMLImageElement[] = [];
      const photoIds: string[] = [];

      for (const photo of photosToClassify) {
        if (!photo?.image) continue;
        try {
          const imageElement = new Image();
          imageElement.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => {
            imageElement.onload = () => resolve();
            imageElement.onerror = () => reject(new Error(`Failed to load: ${photo.image}`));
            imageElement.src = photo.image;
          });
          imageElements.push(imageElement);
          photoIds.push(String(photo.id));
        } catch (err) {
          console.error(`Failed to load image for photo ${photo.id}:`, err);
        }
      }

      if (imageElements.length === 0) {
        setError(t('admin_ai_classification_error'));
        return;
      }

      const results = await aiImageClassificationService.classifyMultipleImages(imageElements);
      let successCount = 0;

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const photoId = photoIds[i];
        if (result && photoId) {
          try {
            await updatePhotoInFirestore(photoId, {
              category: result.category,
              isAIClassified: true,
              aiConfidence: result.confidence
            });
            successCount++;
          } catch (err) {
            console.error(`Failed to update photo ${photoId}:`, err);
          }
        }
      }

      await loadPhotos();
      setSuccessMessage(t('admin_ai_classify_selected_success', { success: successCount, total: photosToClassify.length }));
    } catch (err) {
      console.error('AI classification failed:', err);
      setError(t('admin_ai_classify_selected_error'));
    } finally {
      setIsClassifying(false);
    }
  }, [loadPhotos, t]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = photos.length;
    const byCategory = photos.reduce((acc, photo) => {
      acc[photo.category] = (acc[photo.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const aiClassified = photos.filter(p => p.isAIClassified).length;
    const needsReview = photos.filter(photo => getPhotoCompleteness(photo).missing > 0).length;
    const categoryCount = Object.values(byCategory).filter(count => count > 0).length;
    const unclassified = total - aiClassified;
    const complete = total - needsReview;
    return { total, byCategory, aiClassified, needsReview, categoryCount, unclassified, complete };
  }, [photos]);

  // Filter and sort photos
  const filteredPhotos = useMemo(() => {
    let result = [...photos];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(photo => {
        const displayPhoto = getDisplayPhoto(photo);
        return photo.title.toLowerCase().includes(query) ||
          displayPhoto.title.toLowerCase().includes(query) ||
          photo.description.toLowerCase().includes(query) ||
          displayPhoto.description.toLowerCase().includes(query) ||
          photo.location.toLowerCase().includes(query) ||
          displayPhoto.location.toLowerCase().includes(query) ||
          photo.category.toLowerCase().includes(query) ||
          displayPhoto.category.toLowerCase().includes(query);
      });
    }

    // Category filter
    if (filterCategory !== 'all') {
      result = result.filter(photo => photo.category === filterCategory);
    }

    // Workflow status filter
    if (statusFilter === 'needs-review') {
      result = result.filter(photo => getPhotoCompleteness(photo).missing > 0);
    } else if (statusFilter === 'unclassified') {
      result = result.filter(photo => !photo.isAIClassified);
    } else if (statusFilter === 'complete') {
      result = result.filter(photo => getPhotoCompleteness(photo).missing === 0);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
        case 'date':
        default:
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [photos, searchQuery, filterCategory, statusFilter, sortBy, sortOrder, getDisplayPhoto]);

  const hasActiveFilters = Boolean(searchQuery || filterCategory !== 'all' || statusFilter !== 'all');

  // Listen for tab switch and photo data changes, trigger scroll recalculation
  useEffect(() => {
    forceScrollRecalculation();
    // Extra delay execution to ensure content rendering is complete
    const timer = setTimeout(forceScrollRecalculation, 500);
    return () => clearTimeout(timer);
  }, [activeTab, photos.length, filteredPhotos.length, forceScrollRecalculation]);

  // Preview navigation - Previous
  const navigateToPrevPhoto = useCallback(() => {
    if (!previewPhoto) return;
    const currentIndex = filteredPhotos.findIndex(p => p.id === previewPhoto.id);
    if (currentIndex > 0) {
      const prevPhoto = filteredPhotos[currentIndex - 1];
      if (prevPhoto) {
        setPreviewPhoto(prevPhoto);
        setPreviewIndex(currentIndex - 1);
      }
    }
  }, [previewPhoto, filteredPhotos]);

  // Preview navigation - Next
  const navigateToNextPhoto = useCallback(() => {
    if (!previewPhoto) return;
    const currentIndex = filteredPhotos.findIndex(p => p.id === previewPhoto.id);
    if (currentIndex < filteredPhotos.length - 1) {
      const nextPhoto = filteredPhotos[currentIndex + 1];
      if (nextPhoto) {
        setPreviewPhoto(nextPhoto);
        setPreviewIndex(currentIndex + 1);
      }
    }
  }, [previewPhoto, filteredPhotos]);

  // Toggle photo selection
  const togglePhotoSelection = useCallback((photoId: string | number) => {
    setSelectedPhotoIds(prev => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
  }, []);

  // Select all/Deselect all
  const toggleSelectAll = useCallback(() => {
    setSelectedPhotoIds(prev => {
      if (prev.size === filteredPhotos.length) {
        return new Set();
      } else {
        return new Set(filteredPhotos.map(p => p.id));
      }
    });
  }, [filteredPhotos]);

  // Keyboard shortcuts support
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC to close panel
      if (e.key === 'Escape') {
        if (previewPhoto) {
          setPreviewPhoto(null);
        } else if (editingPhoto) {
          requestCloseEdit();
        } else {
          onClose();
        }
        return;
      }

      // Left/Right arrow navigation in preview mode
      if (previewPhoto) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          navigateToPrevPhoto();
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          navigateToNextPhoto();
          return;
        }
      }

      // Ctrl/Cmd + A Select all/Deselect all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        toggleSelectAll();
        return;
      }

      // Ctrl/Cmd + F Focus search box
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.querySelector('input[type="text"][placeholder*="Search"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      // Delete key to delete selected photos
      if (e.key === 'Delete' && selectedPhotoIds.size > 0) {
        e.preventDefault();
        setPhotoToDelete(null);
        setDeleteConfirmOpen(true);
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, previewPhoto, editingPhoto, selectedPhotoIds.size, onClose, toggleSelectAll, navigateToPrevPhoto, navigateToNextPhoto, requestCloseEdit]);

  // Automatically clear success/error messages
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [error]);

  // Remove selected file
  const removeSelectedFile = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    // Trigger scroll recalculation
    forceScrollRecalculation();
  }, [forceScrollRecalculation]);

  // Lock the portfolio behind the workspace and preserve its exact position.
  useEffect(() => {
    if (!isOpen) return undefined;

    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const previousBodyStyles = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollTop}px`;
    document.body.style.width = '100%';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyStyles.overflow;
      document.body.style.position = previousBodyStyles.position;
      document.body.style.top = previousBodyStyles.top;
      document.body.style.width = previousBodyStyles.width;
      document.documentElement.style.overflow = previousHtmlOverflow;
      window.scrollTo(0, scrollTop);
    };
  }, [isOpen]);

  // Check authentication status, close panel if not authenticated
  useEffect(() => {
    if (isOpen && !isAuthenticated) {
      onClose();
    }
  }, [isOpen, isAuthenticated, onClose]);

  if (!isOpen || !isAuthenticated) return null;

  return (
    <motion.div
      className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 admin-panel overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="admin-workspace-frame absolute inset-0 sm:inset-2 lg:inset-4 overflow-hidden"
        initial={{ scale: 0.94, y: 18 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 18 }}
      >
        <div className="admin-workspace-ambient" aria-hidden="true" />

        <aside className="admin-workspace-sidebar">
          <div className="admin-sidebar-brand">
            <div className="admin-sidebar-mark">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <p>LIEN STUDIO</p>
              <span>{t('admin_workspace')}</span>
            </div>
          </div>

          <nav className="admin-sidebar-nav" aria-label={t('admin_title')}>
            <button
              onClick={() => setActiveTab('manage')}
              className={activeTab === 'manage' ? 'is-active' : ''}
            >
              <FolderOpen className="w-4 h-4" />
              <span>{t('admin_library')}</span>
              <b>{photos.length}</b>
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={activeTab === 'upload' ? 'is-active' : ''}
            >
              <ImagePlus className="w-4 h-4" />
              <span>{t('admin_upload_new')}</span>
              {selectedFiles.length > 0 && <b className="is-accent">{selectedFiles.length}</b>}
            </button>
          </nav>

          <div className="admin-sidebar-overview">
            <p>{t('admin_overview')}</p>
            <div className="admin-sidebar-stat">
              <span>{t('admin_stat_total')}</span>
              <strong>{stats.total}</strong>
            </div>
            <div className="admin-sidebar-stat">
              <span>{t('admin_stat_ai')}</span>
              <strong>{stats.aiClassified}</strong>
            </div>
            <div className="admin-sidebar-stat is-warning">
              <span>{t('admin_needs_review')}</span>
              <strong>{stats.needsReview}</strong>
            </div>
          </div>

          <div className="admin-sidebar-footer">
            <div className="admin-cloud-status">
              <span className={firebaseUser ? 'is-online' : 'is-pending'} />
              <div>
                <strong>{firebaseUser ? t('admin_connected') : t('admin_firebase_not_connected')}</strong>
                <small>{firebaseUser?.isAnonymous ? t('admin_firebase_anonymous') : 'Firebase'}</small>
              </div>
            </div>
            <button onClick={runDiagnostics} disabled={isDiagnosing}>
              <Activity className={`w-4 h-4 ${isDiagnosing ? 'animate-pulse' : ''}`} />
              {t('admin_diagnostics')}
            </button>
            <button
              className="is-danger"
              onClick={() => {
                logout();
                onClose();
              }}
            >
              <LogOut className="w-4 h-4" />
              {t('admin_logout')}
            </button>
          </div>
        </aside>

        <section className="admin-workspace-main">
          <header className="admin-workspace-topbar">
            <div className="admin-mobile-brand">
              <Camera className="w-5 h-5" />
            </div>
            <div className="admin-topbar-copy">
              <span>{t('admin_workspace')} / {activeTab === 'manage' ? t('admin_library') : t('admin_upload_new')}</span>
              <h2>{activeTab === 'manage' ? t('admin_library') : t('admin_upload_new')}</h2>
              <p>{activeTab === 'manage' ? t('admin_library_subtitle') : t('admin_upload_subtitle')}</p>
            </div>
            <div className="admin-topbar-actions">
              {activeTab === 'manage' && (
                <>
                  <button onClick={loadPhotos} disabled={isLoading} aria-label={t('admin_refresh')}>
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  </button>
                  <button className="is-primary" onClick={scrollToUpload}>
                    <Plus className="w-4 h-4" />
                    <span>{t('admin_add_photo')}</span>
                  </button>
                </>
              )}
              <button
                className="admin-topbar-logout"
                onClick={() => {
                  logout();
                  onClose();
                }}
                aria-label={t('admin_logout')}
              >
                <LogOut className="w-4 h-4" />
              </button>
              <button onClick={onClose} aria-label={t('admin_close_preview')}>
                <X className="w-5 h-5" />
              </button>
            </div>
          </header>

          <div className="admin-mobile-tabs">
            <button onClick={() => setActiveTab('manage')} className={activeTab === 'manage' ? 'is-active' : ''}>
              <FolderOpen className="w-4 h-4" />
              {t('admin_manage_photos')}
            </button>
            <button onClick={() => setActiveTab('upload')} className={activeTab === 'upload' ? 'is-active' : ''}>
              <ImagePlus className="w-4 h-4" />
              {t('admin_upload_new')}
              {selectedFiles.length > 0 && <b>{selectedFiles.length}</b>}
            </button>
          </div>

          <div
            ref={scrollContainerRef}
            data-scrollable="true"
            className="admin-workspace-scroll admin-panel-scroll scrollable"
            style={{
              WebkitOverflowScrolling: 'touch',
              overscrollBehavior: 'contain',
              touchAction: 'pan-y',
            }}
          >
          {/* Photo management tab */}
          <AnimatePresence mode="wait">
            {activeTab === 'manage' && (
              <motion.div
                key="manage"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="admin-manage-view space-y-4 min-h-min"
              >
                {/* Diagnostic results display */}
                {diagnostics && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl border border-blue-500/20"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-sm font-medium text-white">{t('admin_diag_panel_title')}</h4>
                      <button
                        onClick={() => setDiagnostics(null)}
                        className="text-white/40 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-white/60">Firestore:</span>
                        <span className={diagnostics.isFirestoreAvailable ? 'text-green-400' : 'text-red-400'}>
                          {diagnostics.isFirestoreAvailable ? `✅ ${t('admin_diag_available')}` : `❌ ${t('admin_diag_unavailable')}`}
                        </span>
                        <span className="text-white/40">({diagnostics.firestorePhotoCount} {t('admin_photos_count')})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-white/60">Storage:</span>
                        <span className={diagnostics.isStorageAvailable ? 'text-green-400' : 'text-red-400'}>
                          {diagnostics.isStorageAvailable ? `✅ ${t('admin_diag_available')}` : `❌ ${t('admin_diag_unavailable')}`}
                        </span>
                        <span className="text-white/40">({diagnostics.storagePhotoCount} files)</span>
                      </div>
                      {diagnostics.errors.length > 0 && (
                        <div className="mt-2 p-2 bg-red-500/20 rounded text-red-300 text-xs">
                          <strong>{t('admin_diag_errors_label')}:</strong> {diagnostics.errors.join('; ')}
                        </div>
                      )}
                      {diagnostics.warnings.length > 0 && (
                        <div className="mt-2 p-2 bg-yellow-500/20 rounded text-yellow-300 text-xs">
                          <strong>{t('admin_diag_warnings_label')}:</strong> {diagnostics.warnings.join('; ')}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                <div className="admin-library-layout">
                  <div className="admin-library-column">
                    <div className="admin-metric-strip">
                      <div className="admin-metric-card">
                        <span><FileImage className="w-4 h-4" />{t('admin_stat_total')}</span>
                        <strong>{hasActiveFilters ? filteredPhotos.length : stats.total}</strong>
                        <small>{t('admin_photos_count')}</small>
                      </div>
                      <div className="admin-metric-card is-ai">
                        <span><Sparkles className="w-4 h-4" />{t('admin_stat_ai')}</span>
                        <strong>{stats.aiClassified}</strong>
                        <small>{Math.round((stats.aiClassified / Math.max(stats.total, 1)) * 100)}%</small>
                      </div>
                      <div className="admin-metric-card is-review">
                        <span><AlertCircle className="w-4 h-4" />{t('admin_needs_review')}</span>
                        <strong>{stats.needsReview}</strong>
                        <small>{stats.needsReview === 0 ? t('admin_complete') : t('admin_content_status')}</small>
                      </div>
                      <div className="admin-metric-card">
                        <span><Folder className="w-4 h-4" />{t('admin_categories_count')}</span>
                        <strong>{stats.categoryCount}</strong>
                        <small>{t('admin_all_categories')}</small>
                      </div>
                    </div>

                    {stats.total - stats.aiClassified > 0 && (
                      <button
                        onClick={classifyUnclassifiedPhotos}
                        disabled={isClassifying || isLoading}
                        className="admin-ai-queue-action"
                      >
                        <span><Sparkles className={`w-4 h-4 ${isClassifying ? 'animate-spin' : ''}`} /></span>
                        <div>
                          <strong>{t('admin_ai_classify_unclassified')}</strong>
                          <small>{stats.total - stats.aiClassified} {t('admin_photos_count')}</small>
                        </div>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}

                {/* Search and filter toolbar - More compact design */}
                <div className="admin-library-toolbar space-y-3">
                  {/* Search box and view toggle */}
                  <div className="admin-library-toolbar-row flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="admin-library-search relative flex-1 group min-w-0">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 group-focus-within:text-white transition-colors" />
                      <Input
                        type="text"
                        placeholder={t('admin_search_placeholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-10 h-10 bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-white/40 focus:ring-1 focus:ring-white/15 focus:bg-white/10 transition-all rounded-xl w-full"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10 transition-colors"
                        >
                          <XCircle className="w-4 h-4 text-white/40 hover:text-white" />
                        </button>
                      )}
                    </div>
                    <div className="admin-library-controls flex items-center gap-2 flex-shrink-0">
                      <div className="admin-view-toggle flex items-center bg-white/5 rounded-xl border border-white/10 p-1">
                        <button
                          onClick={() => setViewMode('grid')}
                          aria-label="Grid view"
                          className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'
                            }`}
                        >
                          <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setViewMode('list')}
                          aria-label="List view"
                          className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'
                            }`}
                        >
                          <List className="w-4 h-4" />
                        </button>
                      </div>
                      {/* Sort controls - merged into the same row */}
                      <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                        <SelectTrigger className="w-auto min-w-[100px] h-9 bg-white/5 border-white/10 text-white text-xs rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="date">{t('admin_sort_date')}</SelectItem>
                          <SelectItem value="title">{t('admin_sort_title')}</SelectItem>
                          <SelectItem value="category">{t('admin_sort_category')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <button
                        onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                        aria-label={sortOrder === 'asc' ? 'Sort ascending' : 'Sort descending'}
                        className="h-9 px-2 bg-white/5 border border-white/10 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
                      >
                        {sortOrder === 'asc' ? (
                          <SortAsc className="w-4 h-4" />
                        ) : (
                          <SortDesc className="w-4 h-4" />
                        )}
                      </button>
                      {/* Shortcut hint button - desktop only (hover feature) */}
                      <div className="relative hidden md:block">
                        <button
                          onMouseEnter={() => setShowShortcutsTooltip(true)}
                          onMouseLeave={() => setShowShortcutsTooltip(false)}
                          className="p-2 bg-white/5 border border-white/10 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-all"
                        >
                          <Keyboard className="w-4 h-4" />
                        </button>
                        <AnimatePresence>
                          {showShortcutsTooltip && (
                            <motion.div
                              initial={{ opacity: 0, y: 5, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 5, scale: 0.95 }}
                              className="absolute right-0 top-full mt-2 p-3 bg-black/90 backdrop-blur-xl rounded-xl border border-white/20 shadow-2xl z-50 min-w-[200px]"
                            >
                              <p className="text-white/80 text-xs font-medium mb-2">{t('admin_shortcuts')}</p>
                              <div className="space-y-1.5 text-xs">
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-white/60">⌘/Ctrl + A</span>
                                  <span className="text-white/80">{t('admin_shortcut_select_all')}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-white/60">⌘/Ctrl + F</span>
                                  <span className="text-white/80">{t('admin_shortcut_search')}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-white/60">Delete</span>
                                  <span className="text-white/80">{t('admin_shortcut_delete')}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-white/60">← →</span>
                                  <span className="text-white/80">{t('admin_prev_photo')}/{t('admin_next_photo')}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-white/60">Esc</span>
                                  <span className="text-white/80">{t('admin_shortcut_esc')}</span>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>

                  <div className="admin-workflow-filter" role="group" aria-label={t('admin_work_queue')}>
                    <span>{t('admin_work_queue')}</span>
                    <button
                      type="button"
                      className={statusFilter === 'all' ? 'is-active' : ''}
                      onClick={() => setStatusFilter('all')}
                    >
                      {t('admin_filter_all')} <b>{stats.total}</b>
                    </button>
                    <button
                      type="button"
                      className={statusFilter === 'needs-review' ? 'is-active is-warning' : ''}
                      onClick={() => setStatusFilter('needs-review')}
                    >
                      {t('admin_needs_review')} <b>{stats.needsReview}</b>
                    </button>
                    <button
                      type="button"
                      className={statusFilter === 'unclassified' ? 'is-active is-ai' : ''}
                      onClick={() => setStatusFilter('unclassified')}
                    >
                      {t('admin_filter_unclassified')} <b>{stats.unclassified}</b>
                    </button>
                    <button
                      type="button"
                      className={statusFilter === 'complete' ? 'is-active is-complete' : ''}
                      onClick={() => setStatusFilter('complete')}
                    >
                      {t('admin_filter_complete')} <b>{stats.complete}</b>
                    </button>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        className="admin-filter-reset"
                        onClick={() => {
                          setSearchQuery('');
                          setFilterCategory('all');
                          setStatusFilter('all');
                        }}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        {t('admin_clear_filters')}
                      </button>
                    )}
                  </div>

                  {/* Category quick filter tags */}
                  <div className="admin-category-filters flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    <span className="text-xs text-white/40 flex-shrink-0">{t('admin_filter_quick')}:</span>
                    <button
                      onClick={() => setFilterCategory('all')}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filterCategory === 'all'
                        ? 'bg-white/15 text-white border border-white/25'
                        : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-transparent'
                        }`}
                    >
                      {t('admin_all_categories')}
                      <span className="ml-1 opacity-60">({photos.length})</span>
                    </button>
                    {Object.entries(PHOTO_CATEGORIES).map(([key]) => {
                      const count = stats.byCategory[key] || 0;
                      if (count === 0) return null;
                      return (
                        <button
                          key={key}
                          onClick={() => setFilterCategory(key)}
                          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filterCategory === key
                            ? 'bg-gradient-to-r from-blue-500/30 to-purple-500/30 text-white border border-white/20'
                            : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-transparent'
                            }`}
                        >
                          {localizePhotoCategory(key, t)}
                          <span className="ml-1 opacity-60">({count})</span>
                        </button>
                      );
                    })}
                  </div>

                </div>

                {/* Photo list/grid view */}
                {isLoading ? (
                  /* Skeleton Loading effect */
                  <div className={`${viewMode === 'grid'
                    ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4'
                    : 'space-y-2'
                    }`}>
                    {Array.from({ length: 8 }).map((_, index) => (
                      <div
                        key={index}
                        className={`${viewMode === 'grid'
                          ? 'rounded-xl'
                          : 'flex items-center gap-3 p-3 rounded-xl min-h-[96px]'
                          } bg-white/5 border border-white/10 animate-pulse`}
                        style={viewMode === 'grid' ? { height: '140px', minHeight: '140px' } : undefined}
                      >
                        {viewMode === 'grid' ? (
                          <div className="w-full h-full bg-gradient-to-br from-white/10 to-white/5 rounded-xl" />
                        ) : (
                          <>
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-white/10 flex-shrink-0" />
                            <div className="flex-1 space-y-2">
                              <div className="h-4 bg-white/10 rounded w-3/4" />
                              <div className="h-3 bg-white/5 rounded w-1/2" />
                              <div className="h-3 bg-white/5 rounded w-1/3" />
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                ) : filteredPhotos.length === 0 ? (
                  <motion.div
                    className="flex flex-col items-center justify-center py-16 px-4"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="p-4 bg-white/5 rounded-2xl mb-4">
                      <ImageIcon className="w-12 h-12 text-white/30" />
                    </div>
                    <h4 className="text-lg font-medium text-white/70 mb-2">
                      {hasActiveFilters ? t('admin_no_results') : t('admin_no_photos')}
                    </h4>
                    <p className="text-sm text-white/40 text-center max-w-sm mb-4">
                      {hasActiveFilters
                        ? t('admin_adjust_filters')
                        : t('admin_no_photos_hint')}
                    </p>
                    {hasActiveFilters ? (
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setFilterCategory('all');
                          setStatusFilter('all');
                        }}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-white/70 text-sm transition-all"
                      >
                        {t('admin_clear_filters')}
                      </button>
                    ) : (
                      <LiquidGlassButton
                        onClick={scrollToUpload}
                        variant="primary"
                        size="sm"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        {t('admin_upload_first_photo')}
                      </LiquidGlassButton>
                    )}
                  </motion.div>
                ) : (
                  <>
                    {/* Select all toolbar - Simplified */}
                    <div className="admin-selection-row flex items-center justify-between py-2 px-1">
                      <button
                        onClick={toggleSelectAll}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors group"
                      >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${selectedPhotoIds.size === filteredPhotos.length && filteredPhotos.length > 0
                          ? 'bg-blue-500 border-blue-500'
                          : selectedPhotoIds.size > 0
                            ? 'bg-blue-500/50 border-blue-500'
                            : 'border-white/30 group-hover:border-white/50'
                          }`}>
                          {selectedPhotoIds.size > 0 && (
                            <CheckCircle className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <span className="text-sm text-white/70">
                          {selectedPhotoIds.size === filteredPhotos.length && filteredPhotos.length > 0
                            ? t('admin_deselect_all')
                            : selectedPhotoIds.size > 0
                              ? t('admin_selected_count', { count: selectedPhotoIds.size })
                              : t('admin_select_all')}
                        </span>
                      </button>

                      {/* Show selected count hint */}
                      {selectedPhotoIds.size > 0 && (
                        <span className="text-xs text-white/40">
                          {t('admin_use_bottom_toolbar')}
                        </span>
                      )}
                      {selectedPhotoIds.size === 0 && (
                        <span className="admin-result-count text-xs text-white/40">
                          {t('admin_showing')} {filteredPhotos.length} / {photos.length}
                        </span>
                      )}
                    </div>

                    <div
                      ref={photoListRef}
                      data-scrollable="true"
                      className={`admin-photo-collection scrollable ${viewMode === 'grid'
                        ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4'
                        : 'space-y-2'
                        }`}
                    >
                      {filteredPhotos.map((photo, index) => {
                        const isSelected = selectedPhotoIds.has(photo.id);
                        const isFocused = inspectorPhoto?.id === photo.id;
                        const completeness = getPhotoCompleteness(photo);
                        return (
                          <motion.div
                            key={photo.id}
                            className={`admin-photo-card group relative ${viewMode === 'grid'
                              ? 'rounded-xl overflow-hidden'
                              : 'flex items-center gap-3 p-3 rounded-xl min-h-[110px]'
                              } bg-white/5 border transition-all duration-200 cursor-pointer ${isSelected
                                ? 'is-selected border-blue-400 ring-2 ring-blue-400/30 bg-blue-500/10'
                                : isFocused
                                  ? 'is-focused border-emerald-300/60 ring-1 ring-emerald-300/30'
                                  : 'border-white/10 hover:border-white/20 hover:bg-white/[0.07]'
                              }`}
                            style={viewMode === 'grid' ? { aspectRatio: '4 / 3', minHeight: '150px' } : undefined}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.02 }}
                            onClick={(e) => {
                              const target = e.target as HTMLElement;
                              if (target.closest('.photo-select-checkbox') || target.closest('.photo-action-buttons')) {
                                return;
                              }
                              setInspectorPhoto(photo);
                              setPreviewIndex(index);
                              if (!window.matchMedia('(min-width: 1180px)').matches) {
                                setPreviewPhoto(photo);
                              }
                            }}
                          >
                            {/* Checkbox - Improved design */}
                            <div
                              className={`photo-select-checkbox absolute z-20 transition-all duration-200 ${viewMode === 'grid'
                                ? 'top-2 left-2'
                                : 'top-1/2 left-3 -translate-y-1/2'
                                } ${isSelected ? 'opacity-100' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100'}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePhotoSelection(photo.id);
                              }}
                            >
                              <div className={`w-6 h-6 rounded-lg flex items-center justify-center cursor-pointer transition-all shadow-lg ${isSelected
                                ? 'bg-blue-500 border-2 border-blue-400'
                                : 'bg-black/60 border-2 border-white/40 hover:border-white/60 backdrop-blur-sm'
                                }`}>
                                {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
                              </div>
                            </div>

                            {/* Grid view */}
                            {viewMode === 'grid' ? (
                              <>
                                <div className="absolute inset-0">
                                  <OptimizedImage
                                    src={photo.image}
                                    alt={getDisplayPhoto(photo).title}
                                    className="w-full h-full object-cover"
                                    priority={false}
                                  />
                                </div>
                                {/* Gradient overlay - Always show basic info */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent">
                                  <div className="admin-photo-info absolute bottom-0 left-0 right-0 p-2.5">
                                    <h4 className="text-white text-sm font-medium truncate mb-0.5">{getDisplayPhoto(photo).title}</h4>
                                    <div className="flex items-center gap-2">
                                      <span className="text-white/70 text-xs">{localizePhotoCategory(photo.category, t)}</span>
                                      {photo.isAIClassified && (
                                        <span className="flex items-center gap-0.5 text-blue-400 text-xs">
                                          <Sparkles className="w-3 h-3" />
                                        </span>
                                      )}
                                      <span
                                        className={`admin-photo-completeness ${completeness.missing === 0 ? 'is-complete' : ''}`}
                                        title={t('admin_content_status')}
                                      >
                                        {completeness.percent}%
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                {/* Selected state overlay */}
                                {isSelected && (
                                  <div className="admin-photo-selected-overlay absolute inset-0 pointer-events-none" />
                                )}
                              </>
                            ) : (
                              /* List view */
                              <>
                                <div className={`flex-shrink-0 ${isSelected ? 'ml-8' : 'ml-0 group-hover:ml-8'} transition-all duration-200`}>
                                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden">
                                    <OptimizedImage
                                      src={photo.image}
                                      alt={getDisplayPhoto(photo).title}
                                      className="w-full h-full object-cover"
                                      priority={false}
                                    />
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-white text-sm font-medium truncate">{getDisplayPhoto(photo).title}</h4>
                                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    <span className="px-2 py-0.5 bg-white/10 rounded-md text-white/70 text-xs">
                                      {localizePhotoCategory(photo.category, t)}
                                    </span>
                                    {photo.isAIClassified && (
                                      <span className="flex items-center gap-1 text-blue-400 text-xs">
                                        <Sparkles className="w-3 h-3" />
                                        AI
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 mt-1 text-white/40 text-xs min-w-0">
                                    <span className="truncate">{getDisplayPhoto(photo).location}</span>
                                    <span className="flex-shrink-0 whitespace-nowrap">{getDisplayPhoto(photo).date}</span>
                                  </div>
                                </div>
                              </>
                            )}

                            {/* Action buttons - Mobile optimized design */}
                            <div
                              className={`photo-action-buttons z-20 flex gap-2 transition-all duration-200 ${viewMode === 'grid'
                                ? 'absolute top-2 right-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100'
                                : 'flex-shrink-0 self-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100'
                                }`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => setEditingPhoto(photo)}
                                aria-label={t('admin_edit_info')}
                                className="p-2 sm:p-1.5 bg-black/70 hover:bg-black/90 backdrop-blur-sm rounded-lg text-white/90 hover:text-white transition-all touch-manipulation flex items-center justify-center"
                              >
                                <Edit3 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setPhotoToDelete(photo);
                                  setDeleteConfirmOpen(true);
                                }}
                                aria-label={t('admin_delete')}
                                className="p-2 sm:p-1.5 bg-red-500/70 hover:bg-red-500/90 backdrop-blur-sm rounded-lg text-white transition-all touch-manipulation flex items-center justify-center"
                              >
                                <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                              </button>
                            </div>

                            {/* Mobile long press hint - Grid view bottom */}
                            {viewMode === 'grid' && (
                              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent sm:hidden opacity-0 group-active:opacity-100 transition-opacity pointer-events-none">
                                <div className="flex justify-center gap-2">
                                  <span className="text-white/60 text-xs">{t('admin_swipe_to_operate')}</span>
                                </div>
                              </div>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Floating batch action toolbar */}
                <AnimatePresence>
                  {selectedPhotoIds.size > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      className="admin-batch-toolbar sticky bottom-0 left-0 right-0 mt-4 p-3 bg-gradient-to-r from-gray-900/95 to-black/95 backdrop-blur-xl rounded-xl border border-white/20 shadow-2xl z-30"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        {/* Left: Selected info */}
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 rounded-lg">
                            <CheckCircle2 className="w-4 h-4 text-blue-400" />
                            <span className="text-white font-medium text-sm">
                              {t('admin_selected_count', { count: selectedPhotoIds.size })}
                            </span>
                          </div>
                          <button
                            onClick={() => setSelectedPhotoIds(new Set())}
                            className="text-xs text-white/50 hover:text-white transition-colors"
                          >
                            {t('admin_clear_selection')}
                          </button>
                        </div>

                        {/* Right: Action buttons */}
                        <div className="flex items-center gap-2">
                          {/* Batch AI classify selected unclassified photos */}
                          {(() => {
                            const selectedUnclassified = photos.filter(p =>
                              selectedPhotoIds.has(p.id) && !p.isAIClassified
                            );
                            return selectedUnclassified.length > 0 ? (
                              <button
                                onClick={() => {
                                  setSelectedPhotoIds(new Set());
                                  classifyPhotosById(selectedUnclassified);
                                }}
                                className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-lg text-blue-300 text-sm transition-all"
                                disabled={isClassifying || isLoading}
                              >
                                <Sparkles className={`w-4 h-4 ${isClassifying ? 'animate-spin' : ''}`} />
                                <span className="hidden sm:inline">{t('admin_ai_classify_selected')}</span>
                                <span>({selectedUnclassified.length})</span>
                              </button>
                            ) : null;
                          })()}

                          {/* Batch change category */}
                          <div className="relative">
                            <button
                              onClick={() => setShowCategoryMenu(!showCategoryMenu)}
                              className="flex items-center gap-2 px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-purple-300 text-sm transition-all"
                            >
                              <Folder className="w-4 h-4" />
                              <span className="hidden sm:inline">{t('admin_batch_change_category')}</span>
                            </button>
                            <AnimatePresence>
                              {showCategoryMenu && (
                                <motion.div
                                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                  className="absolute bottom-full mb-2 right-0 p-2 bg-black/95 backdrop-blur-xl rounded-xl border border-white/20 shadow-2xl z-50 min-w-[150px]"
                                >
                                  <div className="space-y-1">
                                    {Object.entries(PHOTO_CATEGORIES).map(([key]) => (
                                      <button
                                        key={key}
                                        onClick={() => batchChangeCategory(key as PhotoCategory)}
                                        className="w-full text-left px-3 py-2 rounded-lg text-sm text-white/80 hover:text-white hover:bg-white/10 transition-all"
                                      >
                                        {localizePhotoCategory(key, t)}
                                      </button>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          {/* Batch delete */}
                          <button
                            onClick={() => {
                              setPhotoToDelete(null);
                              setDeleteConfirmOpen(true);
                            }}
                            className="flex items-center gap-2 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-400 text-sm transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="hidden sm:inline">{t('admin_delete')}</span>
                            <span>({selectedPhotoIds.size})</span>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                  </div>

                  <aside className={`admin-photo-inspector ${inspectorPhoto ? 'has-photo' : ''}`}>
                    <header>
                      <div>
                        <span>{t('admin_library')}</span>
                        <h3>{t('admin_inspector')}</h3>
                      </div>
                      {inspectorPhoto && (
                        <button onClick={() => setInspectorPhoto(null)} aria-label={t('admin_close_preview')}>
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </header>

                    {inspectorPhoto ? (() => {
                      const completeness = getPhotoCompleteness(inspectorPhoto);
                      return (
                        <div className="admin-inspector-content">
                          <button
                            className="admin-inspector-image"
                            onClick={() => {
                              setPreviewIndex(Math.max(0, filteredPhotos.findIndex(photo => photo.id === inspectorPhoto.id)));
                              setPreviewPhoto(inspectorPhoto);
                            }}
                            aria-label={t('admin_open_preview')}
                          >
                            <OptimizedImage
                              src={inspectorPhoto.image}
                              alt={getDisplayPhoto(inspectorPhoto).title}
                              className="w-full h-full object-cover"
                              priority={false}
                            />
                            <span><LayoutGrid className="w-4 h-4" />{t('admin_open_preview')}</span>
                          </button>

                          <div className="admin-inspector-heading">
                            <div className="admin-inspector-badges">
                              <span>{localizePhotoCategory(inspectorPhoto.category, t)}</span>
                              {inspectorPhoto.isAIClassified && <span className="is-ai"><Sparkles className="w-3 h-3" />AI</span>}
                            </div>
                            <h4>{getDisplayPhoto(inspectorPhoto).title}</h4>
                            <p>{getDisplayPhoto(inspectorPhoto).description || t('admin_missing_details', { count: 1 })}</p>
                          </div>

                          <section className="admin-completeness-card">
                            <div>
                              <span>{t('admin_content_status')}</span>
                              <strong>{completeness.percent}%</strong>
                            </div>
                            <div className="admin-completeness-track"><i style={{ width: `${completeness.percent}%` }} /></div>
                            <small>{completeness.missing === 0 ? t('admin_complete') : t('admin_missing_details', { count: completeness.missing })}</small>
                          </section>

                          <dl className="admin-inspector-meta">
                            <div><dt>{t('admin_label_location')}</dt><dd>{getDisplayPhoto(inspectorPhoto).location || '—'}</dd></div>
                            <div><dt>{t('admin_sort_date')}</dt><dd>{getDisplayPhoto(inspectorPhoto).date || '—'}</dd></div>
                            <div><dt>{t('admin_label_camera')}</dt><dd>{inspectorPhoto.camera || '—'}</dd></div>
                            <div><dt>{t('admin_label_lens')}</dt><dd>{inspectorPhoto.lens || '—'}</dd></div>
                            <div><dt>{t('admin_label_settings')}</dt><dd>{inspectorPhoto.settings || '—'}</dd></div>
                          </dl>

                          <div className="admin-inspector-actions">
                            <button className="is-primary" onClick={() => setEditingPhoto(inspectorPhoto)}>
                              <Edit3 className="w-4 h-4" />{t('admin_edit_info')}
                            </button>
                            <button onClick={() => {
                              setPreviewIndex(Math.max(0, filteredPhotos.findIndex(photo => photo.id === inspectorPhoto.id)));
                              setPreviewPhoto(inspectorPhoto);
                            }}>
                              <ImageIcon className="w-4 h-4" />{t('admin_open_preview')}
                            </button>
                            <button className="is-danger" onClick={() => {
                              setPhotoToDelete(inspectorPhoto);
                              setDeleteConfirmOpen(true);
                            }}>
                              <Trash2 className="w-4 h-4" />{t('admin_delete')}
                            </button>
                          </div>
                        </div>
                      );
                    })() : (
                      <div className="admin-inspector-empty">
                        <div><ImageIcon className="w-7 h-7" /></div>
                        <h4>{t('admin_inspector')}</h4>
                        <p>{t('admin_inspector_hint')}</p>
                      </div>
                    )}
                  </aside>
                </div>
              </motion.div>
            )}


            {/* Upload tab */}
            {activeTab === 'upload' && (
              <motion.div
                key="upload"
                ref={uploadSectionRef}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="admin-upload-view space-y-4 min-h-min"
              >
                <div className="admin-upload-steps" aria-label={t('admin_upload_new')}>
                  <div className={selectedFiles.length === 0 ? 'is-active' : 'is-complete'}>
                    <span>01</span>
                    <div><strong>{t('admin_upload_step_select')}</strong><small>{t('admin_select_photos')}</small></div>
                  </div>
                  <i aria-hidden="true" />
                  <div className={selectedFiles.length > 0 && !isLoading ? 'is-active' : classificationResults.size > 0 ? 'is-complete' : ''}>
                    <span>02</span>
                    <div><strong>{t('admin_upload_step_prepare')}</strong><small>{t('admin_ai_classify')}</small></div>
                  </div>
                  <i aria-hidden="true" />
                  <div className={isLoading ? 'is-active' : ''}>
                    <span>03</span>
                    <div><strong>{t('admin_upload_step_publish')}</strong><small>{t('admin_upload_to_portfolio')}</small></div>
                  </div>
                </div>

                {/* Upload area - Improved design */}
                <motion.div
                  className={`admin-upload-dropzone relative border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center transition-all duration-300 ${isDragging
                    ? 'border-green-400 bg-green-500/10 scale-[1.02]'
                    : 'border-white/20 hover:border-white/40 hover:bg-white/5'
                    }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={(event) => {
                    if ((event.target as HTMLElement).closest('button')) return;
                    fileInputRef.current?.click();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={t('admin_select_photos')}
                >
                  <div className="flex flex-col items-center gap-4">
                    <div className={`p-4 rounded-2xl transition-all duration-300 ${isDragging
                      ? 'bg-green-500/20 scale-110'
                      : 'bg-gradient-to-br from-green-500/20 to-emerald-500/20'
                      }`}>
                      <Upload className={`w-10 h-10 transition-all duration-300 ${isDragging ? 'text-green-400' : 'text-green-400/80'
                        }`} />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-lg font-medium text-white">{t('admin_drag_drop_title')}</h4>
                      <p className="text-white/50 text-sm max-w-sm">
                        {t('admin_drag_drop_hint')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-white/30 text-sm">
                      <span className="h-px w-12 bg-white/20"></span>
                      <span>{t('admin_or')}</span>
                      <span className="h-px w-12 bg-white/20"></span>
                    </div>
                    <LiquidGlassButton
                      onClick={() => fileInputRef.current?.click()}
                      variant="primary"
                      className="px-6 py-3"
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      {t('admin_select_photos')}
                    </LiquidGlassButton>
                    <p className="text-xs text-white/30">
                      {t('admin_supported_formats')}
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                </motion.div>

                {/* Selected file list - Improved design */}
                {selectedFiles.length > 0 && (
                  <motion.div
                    className="space-y-3"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {/* File list header and actions */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h4 className="text-white font-medium text-sm">{t('admin_selected_files')}</h4>
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full text-xs">
                          {selectedFiles.length}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedFiles([]);
                          setClassificationResults(new Map());
                        }}
                        className="text-xs text-white/50 hover:text-white transition-colors"
                      >
                        {t('admin_clear_all')}
                      </button>
                    </div>

                    {/* File list */}
                    <div
                      className="admin-upload-queue bg-white/5 rounded-xl border border-white/10 overflow-hidden optimized-file-list scrollable"
                      style={{
                        maxHeight: 'min(300px, 35vh)',
                        overflowY: 'auto',
                        WebkitOverflowScrolling: 'touch',
                      }}
                    >
                      <div className="divide-y divide-white/5">
                        {selectedFiles.map((file, index) => {
                          const fileId = `${file.name}-${file.size}`;
                          const result = classificationResults.get(fileId);
                          const progress = uploadProgress.get(fileId) || 0;

                          return (
                            <div key={index} className="flex items-center gap-3 p-3 hover:bg-white/5 transition-colors">
                              {/* Thumbnail */}
                              <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/10 flex-shrink-0">
                                {file.size > 10 * 1024 * 1024 ? (
                                  // For large files (>10MB), show placeholder instead of preview to avoid freezing
                                  <div className="w-full h-full flex items-center justify-center text-white/50">
                                    <Camera className="w-6 h-6" />
                                  </div>
                                ) : (
                                  <img
                                    src={URL.createObjectURL(file)}
                                    alt={file.name}
                                    className="w-full h-full object-cover"
                                    onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                                  />
                                )}
                              </div>

                              {/* File info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-white text-sm truncate">{file.name}</p>
                                  {/* Progress percentage */}
                                  {isLoading && (
                                    <span className="text-white/60 text-xs font-medium flex-shrink-0">
                                      {Math.round(progress)}%
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-white/40 text-xs">{formatFileSize(file.size)}</span>
                                  {result && (
                                    <span className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/20 rounded text-blue-400 text-xs">
                                      <Tag className="w-3 h-3" />
                                      {localizePhotoCategory(result.category, t)}
                                    </span>
                                  )}
                                </div>
                                {/* Enhanced Progress bar */}
                                {isLoading && (
                                  <div className="mt-2">
                                    <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                                      <div
                                        className={`h-full rounded-full transition-all duration-300 ease-out ${
                                          isClassifying
                                            ? 'bg-gradient-to-r from-purple-400 to-purple-500'
                                            : 'bg-gradient-to-r from-green-400 to-green-500'
                                        }`}
                                        style={{ width: `${progress}%` }}
                                      />
                                    </div>
                                    {progress > 0 && progress < 100 && (
                                      <p className="text-white/50 text-xs mt-1">
                                        {progress < 15 ? t('admin_upload_status_preparing') : progress < 95 ? t('admin_upload_status_uploading') : t('admin_upload_status_processing')}
                                      </p>
                                    )}
                                  </div>
                                )}
                                {isClassifying && !isLoading && (
                                  <div className="mt-2">
                                    <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                                      <div
                                        className="h-full rounded-full bg-gradient-to-r from-purple-400 to-purple-500 animate-pulse"
                                        style={{ width: `${progress}%` }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Status/Delete button */}
                              <div className="flex-shrink-0">
                                {result ? (
                                  <div className="p-1.5 bg-green-500/20 rounded-full">
                                    <CheckCircle className="w-4 h-4 text-green-400" />
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => removeSelectedFile(index)}
                                    className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                                  >
                                    <X className="w-4 h-4 text-white/40 hover:text-white" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Overall upload progress */}
                    {isLoading && selectedFiles.length > 0 && (() => {
                      const totalProgress = Array.from(uploadProgress.values()).reduce((sum, p) => sum + p, 0) / selectedFiles.length;
                      return (
                        <div className="p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-xl border border-green-500/20">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Upload className="w-4 h-4 text-green-400" />
                              <span className="text-white font-medium text-sm">{t('admin_total_upload_progress')}</span>
                            </div>
                            <span className="text-green-400 font-bold text-sm">
                              {Math.round(totalProgress)}%
                            </span>
                          </div>
                          <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-300 ease-out"
                              style={{ width: `${totalProgress}%` }}
                            />
                          </div>
                          <p className="text-white/50 text-xs mt-2">
                            {t('admin_uploading_photos', { count: selectedFiles.length })}
                          </p>
                        </div>
                      );
                    })()}

                    {/* Action buttons - Fixed at bottom */}
                    <div className="admin-upload-actions flex flex-col sm:flex-row gap-2 p-4 bg-gradient-to-r from-white/5 to-white/[0.02] rounded-xl border border-white/10">
                      {/* AI Classification button */}
                      <LiquidGlassButton
                        onClick={startBatchClassification}
                        variant="secondary"
                        className="flex-1 py-3"
                        disabled={isClassifying || isLoading}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <Sparkles className={`w-4 h-4 ${isClassifying ? 'animate-spin' : ''}`} />
                          <span>
                            {isClassifying ? t('admin_ai_analyzing') : t('admin_ai_classify')}
                          </span>
                          {classificationResults.size > 0 && (
                            <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">
                              {classificationResults.size}/{selectedFiles.length}
                            </span>
                          )}
                        </div>
                      </LiquidGlassButton>

                      {/* Upload button */}
                      <LiquidGlassButton
                        onClick={confirmAndAddPhotos}
                        variant="primary"
                        className="flex-1 py-3 bg-gradient-to-r from-green-500/30 to-emerald-500/30 hover:from-green-500/40 hover:to-emerald-500/40"
                        disabled={isLoading || isClassifying}
                      >
                        <div className="flex items-center justify-center gap-2">
                          {isLoading ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Upload className="w-4 h-4" />
                          )}
                          <span>
                            {isLoading ? t('admin_uploading') : t('admin_upload_to_portfolio')}
                          </span>
                        </div>
                      </LiquidGlassButton>
                    </div>

                    {/* Auto-classify hint */}
                    {classificationResults.size === 0 && aiImageClassificationService.isReady() && (
                      <p className="text-center text-xs text-white/40">
                        {t('admin_auto_classify_hint') || '未分類的照片會在上傳時自動進行 AI 分類'}
                      </p>
                    )}

                    {/* AI Status Indicator */}
                    <div className="flex items-center justify-center gap-4 text-xs text-white/40">
                      <div className="flex items-center gap-1.5">
                        <span>Google Cloud Vision API</span>
                        {aiImageClassificationService.isReady() ? (
                          <>
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            <span className="text-green-400">{t('admin_ready')}</span>
                          </>
                        ) : (
                          <>
                            <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                            <span className="text-red-400">{t('admin_not_set')}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Success/Error message */}
                <AnimatePresence>
                  {successMessage && (
                    <motion.div
                      className="flex items-center gap-3 p-4 bg-green-500/20 border border-green-500/30 rounded-xl"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      <div className="p-2 bg-green-500/20 rounded-full">
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                      </div>
                      <span className="text-green-300 font-medium">{successMessage}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      className="flex items-center gap-3 p-4 bg-red-500/20 border border-red-500/30 rounded-xl"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      <div className="p-2 bg-red-500/20 rounded-full">
                        <AlertCircle className="w-5 h-5 text-red-400" />
                      </div>
                      <span className="text-red-300 font-medium">{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        </section>

        {/* Delete confirmation dialog */}
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent className="bg-card/95 backdrop-blur-xl border-white/20">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">
                {photoToDelete ? t('admin_confirm_delete') : t('admin_confirm_batch_delete')}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-white/70">
                {photoToDelete
                  ? t('admin_delete_single_confirm', { title: photoToDelete.title })
                  : selectedPhotoIds.size > 0
                    ? t('admin_delete_batch_confirm', { count: selectedPhotoIds.size })
                    : t('admin_no_selected')
                }
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                {t('admin_cancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (photoToDelete) {
                    await deletePhoto(photoToDelete);
                    setPhotoToDelete(null);
                  } else {
                    await deleteSelectedPhotos();
                  }
                  setDeleteConfirmOpen(false);
                }}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                {t('admin_confirm_delete_btn')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Photo preview dialog */}
        <AnimatePresence>
          {previewPhoto && (
            <motion.div
              className="admin-preview-overlay fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-60 p-2 sm:p-4"
              style={{
                zIndex: 9999,
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewPhoto(null)}
            >
              {/* Left navigation arrow */}
              {previewIndex > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateToPrevPhoto();
                  }}
                  className="admin-preview-arrow is-prev absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-50 p-2 sm:p-3 bg-black/60 hover:bg-black/80 rounded-full transition-all group"
                  aria-label={t('admin_prev_photo')}
                >
                  <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8 text-white/70 group-hover:text-white transition-colors" />
                </button>
              )}

              {/* Right navigation arrow */}
              {previewIndex < filteredPhotos.length - 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateToNextPhoto();
                  }}
                  className="admin-preview-arrow is-next absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-50 p-2 sm:p-3 bg-black/60 hover:bg-black/80 rounded-full transition-all group"
                  aria-label={t('admin_next_photo')}
                >
                  <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8 text-white/70 group-hover:text-white transition-colors" />
                </button>
              )}

              <motion.div
                className="admin-preview-dialog relative w-full max-w-[95vw] sm:max-w-[90vw] md:max-w-3xl lg:max-w-4xl xl:max-w-5xl max-h-[90vh] sm:max-h-[85vh] bg-card/95 backdrop-blur-xl border border-white/20 rounded-xl overflow-hidden flex flex-col"
                style={{
                  width: '100%',
                  maxWidth: '95vw',
                  maxHeight: '90vh',
                }}
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Top toolbar */}
                <div className="admin-preview-toolbar absolute top-2 sm:top-4 left-0 right-0 z-50 flex items-center justify-between px-2 sm:px-4">
                  {/* Photo index */}
                  <div className="px-3 py-1.5 bg-black/60 rounded-full text-white/80 text-sm">
                    {t('admin_photo_of', { current: previewIndex + 1, total: filteredPhotos.length })}
                  </div>
                  {/* Close button */}
                  <button
                    onClick={() => setPreviewPhoto(null)}
                    className="p-2 sm:p-3 bg-black/70 rounded-full hover:bg-black/90 transition-colors"
                    aria-label={t('admin_close_preview')}
                  >
                    <X className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </button>
                </div>
                {/* Image display area - image-first: takes most of the dialog */}
                <div
                  className="admin-preview-image relative bg-black flex items-center justify-center overflow-hidden"
                  style={{
                    width: '100%',
                    maxHeight: '62vh',
                    minHeight: '240px',
                    height: 'auto',
                  }}
                >
                  {previewPhoto.image ? (
                    <>
                      <img
                        src={previewPhoto.image}
                        alt={getDisplayPhoto(previewPhoto).title}
                        className="object-contain"
                        style={{
                          display: 'block',
                          margin: '0 auto',
                          maxWidth: '100%',
                          maxHeight: '62vh',
                          width: 'auto',
                          height: 'auto',
                          objectFit: 'contain',
                        }}
                        onLoad={() => {}}
                        onError={(e) => {
                          console.error('Image load failed:', previewPhoto.image);
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const errorDiv = target.nextElementSibling as HTMLElement;
                          if (errorDiv) {
                            errorDiv.style.display = 'flex';
                          }
                        }}
                      />
                      <div
                        className="absolute inset-0 flex items-center justify-center text-white/50 hidden"
                        style={{ display: 'none' }}
                      >
                        <div className="text-center">
                          <p className="mb-2">{t('admin_image_load_failed')}</p>
                          <p className="text-xs text-white/30 break-all max-w-md">{previewPhoto.image}</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center text-white/50 py-20">
                      <div className="text-center">
                        <p className="mb-2">{t('admin_image_url_missing')}</p>
                        <p className="text-xs text-white/30">{t('admin_check_photo_data')}</p>
                      </div>
                    </div>
                  )}
                </div>
                {/* Info panel - compact metadata strip */}
                <div
                  className="admin-preview-info p-4 sm:p-5 space-y-3 overflow-y-auto flex-1"
                  style={{
                    maxHeight: '32vh',
                    touchAction: 'pan-y',
                    WebkitOverflowScrolling: 'touch',
                  }}
                >
                  {/* Title row with category chip + AI badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg sm:text-xl font-bold text-white mb-1 truncate">{getDisplayPhoto(previewPhoto).title}</h3>
                      {getDisplayPhoto(previewPhoto).description && (
                        <p className="text-white/60 text-xs sm:text-sm line-clamp-2">{getDisplayPhoto(previewPhoto).description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className="px-3 py-1 rounded-full text-xs text-white/85 border border-white/20"
                        style={{ background: 'rgba(255,255,255,0.08)' }}
                      >
                        {localizePhotoCategory(previewPhoto.category, t)}
                      </span>
                      {previewPhoto.isAIClassified && (
                        <span
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs text-white/75 border border-white/15"
                          style={{ background: 'rgba(255,255,255,0.05)' }}
                          title={t('admin_ai_classification')}
                        >
                          <Sparkles className="w-3 h-3" />
                          AI
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Metadata chips: location / date / camera / lens / settings */}
                  <div className="flex flex-wrap gap-2 text-xs">
                    {[
                      { label: t('admin_label_location'), value: getDisplayPhoto(previewPhoto).location },
                      { label: t('admin_label_camera'), value: previewPhoto.camera },
                      { label: t('admin_label_lens'), value: previewPhoto.lens },
                      { label: t('admin_label_settings'), value: previewPhoto.settings },
                      { label: t('admin_sort_date'), value: getDisplayPhoto(previewPhoto).date },
                    ].filter(item => item.value).map(item => (
                      <span
                        key={item.label}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10"
                        style={{ background: 'rgba(255,255,255,0.05)' }}
                      >
                        <span className="text-white/45">{item.label}</span>
                        <span className="text-white/85">{item.value}</span>
                      </span>
                    ))}
                  </div>

                  {/* Actions: edit + delete */}
                  <div className="flex gap-2 pt-1">
                    <LiquidGlassButton
                      onClick={() => {
                        // Close preview first, then open edit
                        const photoToEdit = previewPhoto;
                        setPreviewPhoto(null);
                        // Use setTimeout to ensure preview modal is fully closed before opening edit
                        setTimeout(() => {
                          setEditingPhoto(photoToEdit);
                        }, 300);
                      }}
                      variant="primary"
                      size="sm"
                      className="flex-1 sm:flex-initial"
                    >
                      <Edit3 className="w-4 h-4 mr-2" />
                      {t('admin_edit_info')}
                    </LiquidGlassButton>
                    <button
                      onClick={() => {
                        const photoToRemove = previewPhoto;
                        setPreviewPhoto(null);
                        setPhotoToDelete(photoToRemove);
                        setDeleteConfirmOpen(true);
                      }}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 rounded-[24px] text-red-300 text-sm transition-all touch-manipulation"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>{t('admin_delete')}</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Photo edit modal */}
        <AnimatePresence>
          {editingPhoto && (
            <motion.div
              className="admin-edit-overlay fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 modal"
              data-scrollable="true"
              style={{
                zIndex: 10000,
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={requestCloseEdit}
            >
              <motion.div
                className="admin-edit-dialog bg-card/95 backdrop-blur-xl border border-white/20 rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 max-w-[95vw] sm:max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  touchAction: 'pan-y',
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                <div className="admin-edit-header flex items-center justify-between mb-3 sm:mb-4">
                  <h3 className="text-base sm:text-lg lg:text-xl font-medium text-white">{t('admin_edit_photo_info')}</h3>
                  <LiquidGlassButton
                    size="sm"
                    variant="secondary"
                    onClick={requestCloseEdit}
                    className="p-1.5 sm:p-2 rounded-full"
                  >
                    <X className="w-4 h-4 sm:w-5 sm:h-5" />
                  </LiquidGlassButton>
                </div>

                {/* Photo being edited - context preview */}
                {editingPhoto.image && (
                  <div className="admin-edit-context relative mb-4 rounded-xl overflow-hidden border border-white/10" style={{ height: '120px' }}>
                    <img
                      src={editingPhoto.image}
                      alt={getDisplayPhoto(editingPhoto).title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
                    <div className="absolute flex items-center justify-between gap-2" style={{ bottom: 8, left: 12, right: 12 }}>
                      <span className="text-white/90 text-xs truncate drop-shadow">{getDisplayPhoto(editingPhoto).title}</span>
                      <span
                        className="px-2 py-0.5 rounded-full text-xs text-white/85 border border-white/20 flex-shrink-0"
                        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
                      >
                        {localizePhotoCategory(editingPhoto.category, t)}
                      </span>
                    </div>
                  </div>
                )}

                <div className="admin-edit-form space-y-3 sm:space-y-4">
                  <div>
                    <label className="block text-white/80 text-xs sm:text-sm mb-1.5 sm:mb-2">{t('admin_label_title')}</label>
                    <input
                      type="text"
                      value={editingPhoto.title}
                      onChange={(e) => setEditingPhoto({ ...editingPhoto, title: e.target.value })}
                      className="w-full px-2.5 sm:px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 text-sm focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/15 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-white/80 text-xs sm:text-sm mb-1.5 sm:mb-2">{t('admin_label_description')}</label>
                    <textarea
                      value={editingPhoto.description}
                      onChange={(e) => setEditingPhoto({ ...editingPhoto, description: e.target.value })}
                      rows={3}
                      className="w-full px-2.5 sm:px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 text-sm focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/15 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-white/80 text-xs sm:text-sm mb-1.5 sm:mb-2">{t('admin_label_category')}</label>
                      <select
                        value={editingPhoto.category}
                        onChange={(e) => setEditingPhoto({ ...editingPhoto, category: e.target.value as PhotoCategory })}
                        className="w-full px-2.5 sm:px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/15 transition-colors"
                      >
                        {Object.entries(PHOTO_CATEGORIES).map(([key]) => (
                          <option key={key} value={key} className="bg-gray-800">
                            {localizePhotoCategory(key, t)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-white/80 text-xs sm:text-sm mb-1.5 sm:mb-2">{t('admin_label_shooting_location')}</label>
                      <input
                        type="text"
                        value={editingPhoto.location}
                        onChange={(e) => setEditingPhoto({ ...editingPhoto, location: e.target.value })}
                        className="w-full px-2.5 sm:px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 text-sm focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/15 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-white/80 text-xs sm:text-sm mb-1.5 sm:mb-2">{t('admin_label_camera')}</label>
                      <input
                        type="text"
                        value={editingPhoto.camera}
                        onChange={(e) => setEditingPhoto({ ...editingPhoto, camera: e.target.value })}
                        className="w-full px-2.5 sm:px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 text-sm focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/15 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-white/80 text-xs sm:text-sm mb-1.5 sm:mb-2">{t('admin_label_lens')}</label>
                      <input
                        type="text"
                        value={editingPhoto.lens}
                        onChange={(e) => setEditingPhoto({ ...editingPhoto, lens: e.target.value })}
                        className="w-full px-2.5 sm:px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 text-sm focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/15 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-white/80 text-xs sm:text-sm mb-1.5 sm:mb-2">{t('admin_label_settings')}</label>
                      <input
                        type="text"
                        value={editingPhoto.settings}
                        onChange={(e) => setEditingPhoto({ ...editingPhoto, settings: e.target.value })}
                        className="w-full px-2.5 sm:px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 text-sm focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/15 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="admin-edit-actions flex flex-col sm:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4">
                    <LiquidGlassButton
                      onClick={savePhotoEdit}
                      className="flex-1"
                      size="sm"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {t('admin_save_changes')}
                    </LiquidGlassButton>
                    <LiquidGlassButton
                      onClick={requestCloseEdit}
                      variant="secondary"
                      className="px-4 sm:px-6"
                      size="sm"
                    >
                      {t('admin_cancel')}
                    </LiquidGlassButton>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
