import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, PanInfo, useDragControls, useMotionValue, useTransform } from 'motion/react';
import { X, Download, Share2, Info, ChevronLeft, ChevronRight, ChevronUp, Copy, Check, Facebook, Twitter, Instagram, MessageCircle, Send, ZoomIn, ZoomOut, RotateCcw, Camera, Aperture, MapPin, Calendar } from 'lucide-react';
import { LiquidGlassButton } from '@/components/common/LiquidGlassButton';
import { ImageWithFallback } from '@/components/ui/ImageWithFallback';
import { useI18n } from '@/i18n';
import { addComment, subscribeToComments, Comment } from '@/services/commentService';
import { localizePhoto } from '@/utils/photoLocalization';
import { Photo } from '@/types/photo';
import { photoUrl } from '@/services/photoViewing';

interface PhotoViewerProps {
  isOpen: boolean;
  onClose: () => void;
  photo: Photo | null;
  onNext?: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
  onDownload: (photo: Photo) => void | Promise<void>;
  isDownloading?: boolean;
  isDownloaded?: boolean;
}

export function PhotoViewer({
  isOpen,
  onClose,
  photo,
  onNext,
  onPrevious,
  hasNext = false,
  hasPrevious = false,
  onDownload,
  isDownloading = false,
  isDownloaded = false
}: PhotoViewerProps) {
  const { t, lang } = useI18n();
  const displayPhoto = useMemo(
    () => photo ? localizePhoto(photo, lang, t) : null,
    [photo, lang, t],
  );

  // Placeholder values that should not be displayed as real metadata
  const isMeaningful = (v?: string) => !!v && v !== '待編輯' && v !== 'Pending Edit';

  const [showShareMenu, setShowShareMenu] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentAuthor, setCommentAuthor] = useState('');
  const [commentContent, setCommentContent] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showChrome, setShowChrome] = useState(true);
  const [showSwipeHint, setShowSwipeHint] = useState(true);
  const [isCompactViewer, setIsCompactViewer] = useState(false);

  // Gesture operation state
  const [imageScale, setImageScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const imageRef = useRef<HTMLDivElement>(null);
  const sheetDragControls = useDragControls();
  const dragX = useMotionValue(0);
  const dragOpacity = useTransform(dragX, [-200, 0, 200], [0.5, 1, 0.5]);

  // Gesture swipe to switch photos
  const handleDragEnd = useCallback((_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 100;
    const velocity = info.velocity.x;
    const offset = info.offset.x;

    if (imageScale > 1) return; // Do not switch when zoomed in

    if (offset < -threshold || velocity < -500) {
      // Swipe left - Next photo
      if (hasNext && onNext) {
        onNext();
      }
    } else if (offset > threshold || velocity > 500) {
      // Swipe right - Previous photo
      if (hasPrevious && onPrevious) {
        onPrevious();
      }
    }

    // Reset drag position
    dragX.set(0);
  }, [hasNext, hasPrevious, onNext, onPrevious, imageScale, dragX]);

  // Double click to zoom in/out
  const handleDoubleClick = useCallback(() => {
    setImageScale(prev => prev === 1 ? 2 : 1);
  }, []);

  // Reset zoom
  const resetZoom = useCallback(() => {
    setImageScale(1);
  }, []);

  const handleSheetDragEnd = useCallback((info: PanInfo) => {
    if (!isCompactViewer) return;

    if (info.offset.y > 110 || info.velocity.y > 900) {
      onClose();
      return;
    }

    if (info.offset.y < -55 || info.velocity.y < -650) {
      setShowDetails(true);
    }
  }, [isCompactViewer, onClose]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 639px), (pointer: coarse)');
    const updateViewerMode = () => setIsCompactViewer(mediaQuery.matches);
    updateViewerMode();
    mediaQuery.addEventListener?.('change', updateViewerMode);
    return () => mediaQuery.removeEventListener?.('change', updateViewerMode);
  }, []);
  // Load original high-resolution image
  useEffect(() => {
    if (photo && photo.image) {
      setImageScale(1);
      setShowChrome(true);
      setShowSwipeHint(true);
      // Try to load original image (remove possible thumbnail parameters)
      const imageUrl = photo.image.split('?')[0] ?? photo.image; // Remove query parameters
      const img = new Image();
      img.onload = () => {
        setOriginalImageUrl(imageUrl);
      };
      img.onerror = () => {
        // If original image load fails, use original URL
        setOriginalImageUrl(photo.image);
      };
      img.src = imageUrl;
    }
  }, [photo]);

  useEffect(() => {
    if (!isOpen || !isCompactViewer) return;
    const timer = window.setTimeout(() => setShowSwipeHint(false), 4200);
    return () => window.clearTimeout(timer);
  }, [isOpen, isCompactViewer, photo?.id]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
      setShowShareMenu(false);
      setLinkCopied(false);
      setShowComments(false);
      setShowDetails(false);
      setShowChrome(true);
      setCommentAuthor('');
      setCommentContent('');
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Listen for comment changes
  useEffect(() => {
    if (!photo || !isOpen) return;

    const unsubscribe = subscribeToComments(photo.id, (newComments) => {
      setComments(newComments);
    });

    return () => {
      unsubscribe();
    };
  }, [photo, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          if (hasPrevious && onPrevious) onPrevious();
          break;
        case 'ArrowRight':
          if (hasNext && onNext) onNext();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onNext, onPrevious, hasNext, hasPrevious]);

  if (!photo || !displayPhoto) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleDownload = () => onDownload(photo);

  // Copy link to clipboard
  const handleCopyLink = async () => {
    try {
      const url = photoUrl(photo.id);
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  // Submit comment
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!photo) return;

    // Validation
    if (!commentContent.trim()) {
      alert(t('comment_empty'));
      return;
    }

    if (!commentAuthor.trim()) {
      alert(t('comment_author_empty'));
      return;
    }

    setIsSubmittingComment(true);

    try {
      await addComment(photo.id, commentAuthor, commentContent);
      setCommentContent('');
      // Do not clear author name, convenient for user to continue commenting
      alert(t('comment_success'));
    } catch (error) {
      console.error('Comment submission failed:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`${t('comment_error')}\n\n${errorMessage}`);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Share to social media
  const handleShare = (platform: 'facebook' | 'twitter' | 'instagram') => {
    if (!photo) return;

    try {
      const url = encodeURIComponent(photoUrl(photo.id));
      const title = encodeURIComponent(displayPhoto.title);
      // Detect if mobile device
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      let appUrl = '';
      let webUrl = '';

      switch (platform) {
        case 'facebook':
          // Facebook App Protocol (iOS and Android)
          appUrl = isMobile
            ? `fb://share?href=${url}`
            : `https://www.facebook.com/sharer/sharer.php?u=${url}`;
          // Facebook Web Share
          webUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
          break;
        case 'twitter':
          // Twitter/X App Protocol
          const tweetText = `${title} ${url}`;
          appUrl = isMobile
            ? `twitter://post?message=${encodeURIComponent(tweetText)}`
            : `https://twitter.com/intent/tweet?url=${url}&text=${title}`;
          // Twitter/X Web Share
          webUrl = `https://twitter.com/intent/tweet?url=${url}&text=${title}`;
          break;
        case 'instagram':
          // Instagram App Protocol (Open App)
          if (isMobile) {
            // Mobile: Try to open Instagram app
            appUrl = 'instagram://app';
            // Jump directly to app, fails if not installed
            window.location.href = appUrl;
            // Set timeout, if app not opened, hint user
            setTimeout(() => {
              alert(t('photo_share_instagram_hint') || 'Please share this photo manually on Instagram. If Instagram is installed, select the photo in the app to share.');
            }, 1000);
          } else {
            // Desktop: Hint user
            alert(t('photo_share_instagram_hint') || 'Please share this photo manually on Instagram.');
          }
          setShowShareMenu(false);
          return;
      }

      if (appUrl && webUrl) {
        if (isMobile) {
          // Mobile: Jump directly to app
          // If app installed, opens app; if not, system handles or shows error
          // Set timeout fallback: if app not installed, fallback to web share after 1.5s
          let appOpened = false;

          // Listen for page visibility change (page hides when app opens)
          const handleVisibilityChange = () => {
            if (document.hidden) {
              appOpened = true;
              document.removeEventListener('visibilitychange', handleVisibilityChange);
              document.removeEventListener('blur', handleVisibilityChange);
            }
          };

          document.addEventListener('visibilitychange', handleVisibilityChange);
          document.addEventListener('blur', handleVisibilityChange);

          // Try to open app
          window.location.href = appUrl;

          // Set timeout fallback: if app not opened, fallback to web share
          setTimeout(() => {
            if (!appOpened) {
              // Remove listeners
              document.removeEventListener('visibilitychange', handleVisibilityChange);
              document.removeEventListener('blur', handleVisibilityChange);
              // Fallback to web share
              window.location.href = webUrl;
            }
          }, 1500);
        } else {
          // Desktop: Use web share directly
          const webWindow = window.open(webUrl, '_blank', 'width=600,height=400,scrollbars=yes,resizable=yes');
          if (!webWindow) {
            // If popup blocked, try direct navigation
            window.location.href = webUrl;
          }
        }

        setShowShareMenu(false);
      }
    } catch (error) {
      console.error('Share failed:', error);
      alert(t('photo_share_error'));
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="photo-viewer-root fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={handleBackdropClick}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/95 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal Content */}
          <motion.div
            className="photo-viewer-shell relative w-full h-full max-w-[100vw] sm:max-w-[95vw] sm:max-h-[95vh] mx-auto my-auto flex flex-col bg-black/40 backdrop-blur-xl rounded-none sm:rounded-2xl lg:rounded-3xl border-0 sm:border border-white/20 overflow-hidden"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <motion.button
              className={`photo-viewer-chrome absolute top-3 right-3 lg:top-4 lg:right-4 z-50 p-2 lg:p-3 rounded-full liquid-glass-dark liquid-glass-interactive text-white ${showChrome ? '' : 'is-hidden'}`}
              onClick={onClose}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <X className="w-5 h-5 lg:w-6 lg:h-6" />
            </motion.button>

            {/* Navigation Arrows - Only shown in image area */}
            {hasPrevious && (
              <motion.button
                className={`photo-viewer-chrome photo-viewer-arrow absolute left-2 lg:left-4 top-1/2 -translate-y-1/2 z-40 p-2 lg:p-3 rounded-full liquid-glass-dark liquid-glass-interactive text-white ${showChrome ? '' : 'is-hidden'}`}
                onClick={onPrevious}
                whileHover={{ scale: 1.1, x: -5 }}
                whileTap={{ scale: 0.9 }}
              >
                <ChevronLeft className="w-5 h-5 lg:w-6 lg:h-6" />
              </motion.button>
            )}

            {hasNext && (
              <motion.button
                className={`photo-viewer-chrome photo-viewer-arrow absolute right-2 lg:right-4 top-1/2 -translate-y-1/2 z-40 p-2 lg:p-3 rounded-full liquid-glass-dark liquid-glass-interactive text-white ${showChrome ? '' : 'is-hidden'}`}
                onClick={onNext}
                whileHover={{ scale: 1.1, x: 5 }}
                whileTap={{ scale: 0.9 }}
              >
                <ChevronRight className="w-5 h-5 lg:w-6 lg:h-6" />
              </motion.button>
            )}

            {/* Image Container - Responsive height adjustment + Gesture support */}
            <motion.div
              ref={imageRef}
              className="flex-1 flex items-center justify-center p-2 sm:p-3 lg:p-6 min-h-0 cursor-grab active:cursor-grabbing"
              style={{
                minHeight: '200px',
                x: dragX,
                opacity: dragOpacity
              }}
              drag={imageScale === 1 ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragStart={() => setIsDragging(true)}
              onDragEnd={(e, info) => {
                setIsDragging(false);
                handleDragEnd(e, info);
              }}
            >
              <motion.div
                className="relative w-full h-full flex items-center justify-center"
                initial={{ scale: 0.8 }}
                animate={{ scale: imageScale }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                onDoubleClick={handleDoubleClick}
                onClick={() => {
                  if (!isDragging && isCompactViewer) setShowChrome(current => !current);
                }}
              >
                <ImageWithFallback
                  src={originalImageUrl || photo.image}
                  alt={displayPhoto.title}
                  className="max-w-full max-h-full w-auto h-auto object-contain rounded-lg sm:rounded-xl lg:rounded-2xl shadow-2xl select-none"
                  style={{
                    maxHeight: '100%',
                    maxWidth: '100%',
                    pointerEvents: isDragging ? 'none' : 'auto'
                  }}
                />

                {/* Swipe hint - Only shown on mobile */}
                <AnimatePresence>
                  {showSwipeHint && showChrome && !isDragging && imageScale === 1 && (
                    <motion.div
                      className="viewer-swipe-hint absolute bottom-4 left-1/2 -translate-x-1/2 items-center gap-2 px-4 py-2 liquid-glass-dark rounded-full text-white/70 text-xs"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: 1, duration: 0.5 }}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>{t('photo_swipe_hint')}</span>
                      <ChevronRight className="w-4 h-4" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </motion.div>

            {/* Zoom controls - Desktop */}
            <motion.div
              className="photo-viewer-chrome hidden sm:flex absolute right-4 flex-col gap-2 z-40"
              style={{ top: 80 }}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <motion.button
                className="p-2 rounded-full liquid-glass-dark liquid-glass-interactive text-white"
                onClick={() => setImageScale(prev => Math.min(prev + 0.5, 3))}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                title={t('photo_zoom_in')}
              >
                <ZoomIn className="w-5 h-5" />
              </motion.button>
              <motion.button
                className="p-2 rounded-full liquid-glass-dark liquid-glass-interactive text-white"
                onClick={() => setImageScale(prev => Math.max(prev - 0.5, 1))}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                title={t('photo_zoom_out')}
              >
                <ZoomOut className="w-5 h-5" />
              </motion.button>
              {imageScale !== 1 && (
                <motion.button
                  className="p-2 rounded-full liquid-glass-dark liquid-glass-interactive text-white"
                  onClick={resetZoom}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  title={t('photo_zoom_reset')}
                >
                  <RotateCcw className="w-5 h-5" />
                </motion.button>
              )}
            </motion.div>

            {/* Photo Information Panel - Compact, image-first design */}
            <motion.div
              className="photo-viewer-sheet w-full bg-gradient-to-t from-black/95 via-black/90 to-black/80 backdrop-blur-xl border-t border-white/10 p-4 sm:p-5 lg:p-6 text-white overflow-y-auto"
              drag={isCompactViewer ? 'y' : false}
              dragControls={sheetDragControls}
              dragListener={false}
              dragConstraints={{ top: -60, bottom: 160 }}
              dragElastic={{ top: 0.08, bottom: 0.35 }}
              dragSnapToOrigin
              onDragEnd={(_, info) => handleSheetDragEnd(info)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="max-w-5xl mx-auto space-y-4">
                <button
                  type="button"
                  className="photo-viewer-sheet-handle"
                  aria-label={showDetails ? t('photo_description_title') : t('photo_description_title')}
                  onPointerDown={(event) => {
                    if (isCompactViewer) sheetDragControls.start(event);
                  }}
                  onClick={() => setShowDetails(current => !current)}
                >
                  <span />
                </button>
                {/* Compact title bar: title + meta chips + details toggle */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg sm:text-xl lg:text-2xl font-artistic font-tc-optimize mb-2 text-white leading-tight">
                      {displayPhoto.title}
                    </h2>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="px-3 py-1 rounded-full text-xs font-medium text-white/85 border border-white/20"
                        style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)' }}
                      >
                        {displayPhoto.category}
                      </span>
                      {displayPhoto.date && (
                        <span className="flex items-center gap-1 text-white/55 text-xs">
                          <Calendar className="w-3.5 h-3.5" />
                          {displayPhoto.date}
                        </span>
                      )}
                      {isMeaningful(displayPhoto.location) && (
                        <span className="flex items-center gap-1 text-white/55 text-xs">
                          <MapPin className="w-3.5 h-3.5" />
                          {displayPhoto.location}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Details toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDetails(!showDetails);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs text-white/70 hover:text-white border border-white/15 hover:border-white/30 transition-colors flex-shrink-0 touch-manipulation"
                    style={{ background: 'rgba(255,255,255,0.06)' }}
                    aria-expanded={showDetails}
                  >
                    <Info className="w-4 h-4" />
                    <span>{t('photo_description_title')}</span>
                    <motion.span animate={{ rotate: showDetails ? 180 : 0 }} transition={{ duration: 0.25 }}>
                      <ChevronUp className="w-3.5 h-3.5" />
                    </motion.span>
                  </button>
                </div>

                {/* Expandable details: description + EXIF */}
                <AnimatePresence>
                  {showDetails && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-3">
                        {displayPhoto.description && (
                          <p className="text-white/80 font-tc-optimize leading-relaxed text-sm sm:text-base">
                            {displayPhoto.description}
                          </p>
                        )}
                        {/* EXIF strip */}
                        {(isMeaningful(displayPhoto.camera) || isMeaningful(displayPhoto.lens) || isMeaningful(displayPhoto.settings)) && (
                          <div className="flex flex-wrap gap-2">
                            {isMeaningful(displayPhoto.camera) && (
                              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/70 border border-white/10" style={{ background: 'rgba(255,255,255,0.05)' }}>
                                <Camera className="w-3.5 h-3.5 text-white/50" />
                                {displayPhoto.camera}
                              </span>
                            )}
                            {isMeaningful(displayPhoto.lens) && (
                              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/70 border border-white/10" style={{ background: 'rgba(255,255,255,0.05)' }}>
                                <Aperture className="w-3.5 h-3.5 text-white/50" />
                                {displayPhoto.lens}
                              </span>
                            )}
                            {isMeaningful(displayPhoto.settings) && (
                              <span className="px-3 py-1.5 rounded-lg text-xs font-mono text-white/70 border border-white/10" style={{ background: 'rgba(255,255,255,0.05)' }}>
                                {displayPhoto.settings}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-3 border-t border-white/15 relative z-10">
                  {/* Download button - Only shown on desktop */}
                  <div
                      className="flex flex-1 relative z-10"
                      onTouchStart={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      <LiquidGlassButton
                        onClick={(e) => {
                          e?.preventDefault();
                          e?.stopPropagation();
                          if (!isDownloading) {
                            handleDownload();
                          }
                        }}
                        className="w-full min-h-[40px] sm:min-h-[36px] touch-manipulation"
                        disabled={isDownloading}
                        size="sm"
                      >
                        {isDownloading ? (
                          <motion.div
                            className="w-4 h-4"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          >
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                          </motion.div>
                        ) : isDownloaded ? (
                          <>
                            <Check className="w-4 h-4 mr-1.5 flex-shrink-0" />
                            <span className="text-xs whitespace-nowrap">{t('photo_downloaded') || 'Downloaded'}</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4 mr-1.5 flex-shrink-0" />
                            <span className="text-xs whitespace-nowrap">{t('photo_download') || 'Download'}</span>
                          </>
                        )}
                      </LiquidGlassButton>
                  </div>

                  {/* Share button - Shown on both mobile and desktop */}
                  <motion.div className="relative flex-1 z-20">
                    <LiquidGlassButton
                      variant="secondary"
                      className="w-full min-h-[40px] sm:min-h-[36px] relative z-20 touch-manipulation"
                      onClick={(e) => {
                        e?.preventDefault();
                        e?.stopPropagation();
                        setShowShareMenu(!showShareMenu);
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                      }}
                      size="sm"
                    >
                      <Share2 className="w-4 h-4 mr-1.5 flex-shrink-0" />
                      <span className="text-xs whitespace-nowrap">{t('photo_share') || 'Share'}</span>
                    </LiquidGlassButton>

                    {/* Share Menu - Independent popup, shown next to button */}
                    <AnimatePresence>
                      {showShareMenu && (
                        <>
                          {/* Backdrop, click to close menu */}
                          <motion.div
                            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setShowShareMenu(false);
                            }}
                            onTouchStart={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setShowShareMenu(false);
                            }}
                          />
                          {/* Independent popup - Responsive position: bottom on mobile, top on desktop to avoid overlap */}
                          <motion.div
                            className="absolute bottom-full left-0 mb-2 sm:left-auto sm:right-0 sm:mb-2 z-[101] w-[calc(100vw-2rem)] max-w-[280px] sm:w-[320px] liquid-glass-dialog rounded-2xl"
                            style={{
                              transformOrigin: 'bottom center'
                            }}
                            initial={{
                              opacity: 0,
                              scale: 0.85,
                              y: 20
                            }}
                            animate={{
                              opacity: 1,
                              scale: 1,
                              y: 0
                            }}
                            exit={{
                              opacity: 0,
                              scale: 0.85,
                              y: 20
                            }}
                            transition={{
                              type: 'spring',
                              stiffness: 400,
                              damping: 30,
                              duration: 0.3
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                          >
                            {/* Title bar */}
                            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <Share2 className="w-5 h-5" />
                                <span>{t('photo_share') || 'Share Photo'}</span>
                              </h3>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setShowShareMenu(false);
                                }}
                                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors touch-manipulation"
                              >
                                <X className="w-5 h-5 text-white" />
                              </button>
                            </div>

                            {/* Share options */}
                            <div className="p-4 space-y-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleCopyLink();
                                  setShowShareMenu(false);
                                }}
                                onTouchStart={(e) => {
                                  e.stopPropagation();
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white/10 active:bg-white/20 hover:bg-white/15 transition-all text-white text-sm font-medium min-h-[52px] cursor-pointer touch-manipulation group"
                              >
                                {linkCopied ? (
                                  <>
                                    <div className="p-2 rounded-lg bg-green-500/20 group-hover:bg-green-500/30 transition-colors">
                                      <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                                    </div>
                                    <span className="flex-1 text-left">{t('photo_link_copied') || 'Link Copied'}</span>
                                  </>
                                ) : (
                                  <>
                                    <div className="p-2 rounded-lg bg-white/10 group-hover:bg-white/20 transition-colors">
                                      <Copy className="w-5 h-5 flex-shrink-0" />
                                    </div>
                                    <span className="flex-1 text-left">{t('photo_copy_link') || 'Copy Link'}</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleShare('facebook');
                                }}
                                onTouchStart={(e) => {
                                  e.stopPropagation();
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white/10 active:bg-white/20 hover:bg-white/15 transition-all text-white text-sm font-medium min-h-[52px] cursor-pointer touch-manipulation group"
                              >
                                <div className="p-2 rounded-lg bg-blue-500/20 group-hover:bg-blue-500/30 transition-colors">
                                  <Facebook className="w-5 h-5 text-blue-400 flex-shrink-0" />
                                </div>
                                <span className="flex-1 text-left">Facebook</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleShare('twitter');
                                }}
                                onTouchStart={(e) => {
                                  e.stopPropagation();
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white/10 active:bg-white/20 hover:bg-white/15 transition-all text-white text-sm font-medium min-h-[52px] cursor-pointer touch-manipulation group"
                              >
                                <div className="p-2 rounded-lg bg-sky-500/20 group-hover:bg-sky-500/30 transition-colors">
                                  <Twitter className="w-5 h-5 text-blue-300 flex-shrink-0" />
                                </div>
                                <span className="flex-1 text-left">Twitter</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleShare('instagram');
                                }}
                                onTouchStart={(e) => {
                                  e.stopPropagation();
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white/10 active:bg-white/20 hover:bg-white/15 transition-all text-white text-sm font-medium min-h-[52px] cursor-pointer touch-manipulation group"
                              >
                                <div className="p-2 rounded-lg bg-pink-500/20 group-hover:bg-pink-500/30 transition-colors">
                                  <Instagram className="w-5 h-5 text-pink-400 flex-shrink-0" />
                                </div>
                                <span className="flex-1 text-left">Instagram</span>
                              </button>
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </div>

                {/* Comments area */}
                <div className="pt-3 border-t border-white/10 mt-3">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowComments(!showComments);
                    }}
                    className="flex items-center gap-2 text-white hover:text-white transition-colors mb-3 w-full text-left py-2 px-2 -mx-2 rounded-lg hover:bg-white/5 active:bg-white/10 touch-manipulation"
                  >
                    <MessageCircle className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm sm:text-base font-medium">
                      {t('comment_title')} {comments.length > 0 && `(${comments.length})`}
                    </span>
                  </button>

                  <AnimatePresence>
                    {showComments && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-4"
                      >
                        {/* Comment form */}
                        <form onSubmit={handleSubmitComment} className="space-y-2">
                          <input
                            type="text"
                            value={commentAuthor}
                            onChange={(e) => setCommentAuthor(e.target.value)}
                            placeholder={t('comment_author_placeholder')}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
                            disabled={isSubmittingComment}
                          />
                          <textarea
                            value={commentContent}
                            onChange={(e) => setCommentContent(e.target.value)}
                            placeholder={t('comment_placeholder')}
                            rows={3}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 text-sm focus:outline-none focus:ring-2 focus:ring-white/30 resize-none"
                            disabled={isSubmittingComment}
                          />
                          <LiquidGlassButton
                            type="submit"
                            disabled={isSubmittingComment || !commentContent.trim() || !commentAuthor.trim()}
                            size="sm"
                            className="w-full"
                          >
                            {isSubmittingComment ? (
                              <motion.div
                                className="w-4 h-4"
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                              >
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                              </motion.div>
                            ) : (
                              <>
                                <Send className="w-4 h-4 mr-1.5" />
                                <span>{t('comment_submit')}</span>
                              </>
                            )}
                          </LiquidGlassButton>
                        </form>

                        {/* Comments list */}
                        <div className="space-y-3 max-h-[250px] sm:max-h-[200px] overflow-y-auto">
                          {comments.length === 0 ? (
                            <p className="text-white/50 text-sm text-center py-4">
                              {t('comment_no_comments')}
                            </p>
                          ) : (
                            comments.map((comment) => (
                              <motion.div
                                key={comment.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white/5 rounded-lg p-3 border border-white/10"
                              >
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <span className="text-white font-medium text-sm">{comment.author}</span>
                                  {comment.createdAt && (
                                    <span className="text-white/50 text-xs whitespace-nowrap">
                                      {new Date(comment.createdAt.toMillis()).toLocaleDateString(lang === 'zh' ? 'zh-TW' : 'en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </span>
                                  )}
                                </div>
                                <p className="text-white/80 text-sm break-words">{comment.content}</p>
                              </motion.div>
                            ))
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
