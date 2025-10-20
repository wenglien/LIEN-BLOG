/**
 * Image compression utility
 */

interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeMB?: number;
  forceResize?: boolean; // Force resize to unified dimensions
  targetWidth?: number; // Target width
  targetHeight?: number; // Target height
}

/**
 * Compress image file
 * @param file Original image file
 * @param options Compression options
 * @returns Compressed Blob
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<Blob> {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.85,
    maxSizeMB = 2,
    forceResize = false,
    targetWidth = 1920,
    targetHeight = 1920
  } = options;

  // Check file size first - reject files larger than 10MB to prevent browser freezing
  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > 10) {
    throw new Error(`File too large for compression (${fileSizeMB.toFixed(2)}MB). Maximum size is 10MB.`);
  }

  // Add small delay before compression to prevent CPU overheating
  // Use requestIdleCallback if available, otherwise use setTimeout
  if (typeof requestIdleCallback !== 'undefined') {
    await new Promise(resolve => {
      requestIdleCallback(() => resolve(undefined), { timeout: 100 });
    });
  } else {
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  return new Promise((resolve, reject) => {
    // For large files, use createImageBitmap for better performance
    // Check file size to decide which method to use
    const fileSizeMB = file.size / (1024 * 1024);
    const useImageBitmap = fileSizeMB > 5 && typeof createImageBitmap !== 'undefined';

    if (useImageBitmap) {
      // Use createImageBitmap for large files (more memory efficient)
      createImageBitmap(file)
        .then((imageBitmap) => {
          // Calculate new dimensions
          let width = imageBitmap.width;
          let height = imageBitmap.height;

          if (forceResize) {
            // Force resize to unified dimensions (maintain aspect ratio, only scale down)
            const ratio = Math.min(targetWidth / width, targetHeight / height);
            // Only scale down, do not scale up
            if (ratio < 1) {
              width = Math.round(width * ratio);
              height = Math.round(height * ratio);
            }
          } else if (width > maxWidth || height > maxHeight) {
            // Only limit max dimensions
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          // Create Canvas with optimized settings
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d', {
            willReadFrequently: false,
            alpha: true
          });
          if (!ctx) {
            imageBitmap.close();
            reject(new Error('Cannot create Canvas context'));
            return;
          }

          // Set image quality - use medium quality for faster processing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'medium';

          // Draw image bitmap
          ctx.drawImage(imageBitmap, 0, 0, width, height);
          imageBitmap.close(); // Free memory

          // Convert to Blob
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Image compression failed'));
                return;
              }

              // Check file size, if still too large, reduce quality further
              const sizeMB = blob.size / (1024 * 1024);
              if (sizeMB > maxSizeMB) {
                // Recursive compression, reduce quality
                const newQuality = Math.max(0.3, quality - 0.1);
                compressImage(file, { ...options, quality: newQuality })
                  .then(resolve)
                  .catch(reject);
              } else {
                resolve(blob);
              }
            },
            file.type || 'image/jpeg',
            quality
          );
        })
        .catch((error) => {
          console.warn('createImageBitmap failed, falling back to FileReader:', error);
          // Fallback to FileReader method
          readWithFileReader();
        });
    } else {
      // Use FileReader for smaller files (traditional method)
      readWithFileReader();
    }

    function readWithFileReader() {
      const reader = new FileReader();

      reader.onload = (e) => {
        const img = new Image();

        img.onload = () => {
          // Calculate new dimensions
          let width = img.width;
          let height = img.height;

          if (forceResize) {
            // Force resize to unified dimensions (maintain aspect ratio, only scale down)
            const ratio = Math.min(targetWidth / width, targetHeight / height);
            // Only scale down, do not scale up
            if (ratio < 1) {
              width = Math.round(width * ratio);
              height = Math.round(height * ratio);
            }
            // If original is smaller than target, keep original size
          } else if (width > maxWidth || height > maxHeight) {
            // Only limit max dimensions
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          // Create Canvas with optimized settings
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d', {
            willReadFrequently: false, // Optimize for write operations
            alpha: true
          });
          if (!ctx) {
            reject(new Error('Cannot create Canvas context'));
            return;
          }

          // Set image quality - use medium quality for faster processing and less CPU load
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'medium'; // Changed from 'high' to reduce CPU load

          // Use willReadFrequently optimization hint
          // Draw image with optimized settings
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to Blob
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Image compression failed'));
                return;
              }

              // Check file size, if still too large, reduce quality further
              const sizeMB = blob.size / (1024 * 1024);
              if (sizeMB > maxSizeMB) {
                // Recursive compression, reduce quality
                const newQuality = Math.max(0.3, quality - 0.1);
                compressImage(file, { ...options, quality: newQuality })
                  .then(resolve)
                  .catch(reject);
              } else {
                resolve(blob);
              }
            },
            file.type || 'image/jpeg',
            quality
          );
        };

        img.onerror = () => {
          reject(new Error('Image load failed'));
        };

        img.src = e.target?.result as string;
      };

      reader.onerror = () => {
        reject(new Error('File read failed'));
      };

      reader.readAsDataURL(file);
    }
  });
}

/**
 * Convert Blob to File
 */
export function blobToFile(blob: Blob, fileName: string, mimeType: string): File {
  return new File([blob], fileName, { type: mimeType });
}

/**
 * Get file size (MB)
 */
export function getFileSizeMB(file: File | Blob): number {
  return file.size / (1024 * 1024);
}

/**
 * Format file size display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}
