import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, Image as ImageIcon, MapPin, Calendar, Rows3, Grid3X3 } from 'lucide-react';
import { PhotoViewer } from './PhotoViewer';
import { useI18n } from '@/i18n';
import { OptimizedImage } from './OptimizedImage';
import { localizePhoto, localizePhotoCategory } from '@/utils/photoLocalization';
import { Photo } from '@/types/photo';
import { downloadPhoto, photoIdFromLocation, setPhotoLocation } from '@/services/photoViewing';

type PhotoOrientation = 'portrait' | 'landscape' | 'square';

interface PortfolioSectionProps {
  photos: Photo[];
}

const PAGE_SIZE = 12;
const UNSUPPORTED_BROWSER_IMAGE = /\.(?:dng|cr2|cr3|nef|arw|orf|rw2)(?:\?|$)/i;

export function PortfolioSection({ photos }: PortfolioSectionProps) {
  const { t, lang } = useI18n();
  const [activeCategory, setActiveCategory] = useState('all');
  const [viewMode, setViewMode] = useState<'exhibition' | 'index'>('exhibition');
  const [downloadingItems, setDownloadingItems] = useState<Set<string | number>>(new Set());
  const [downloadedItems, setDownloadedItems] = useState<Set<string | number>>(new Set());
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  // Photos whose image failed to load - hidden from the public grid
  const [brokenIds, setBrokenIds] = useState<Set<string | number>>(new Set());
  // Pagination: how many photos are rendered
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  // Natural image ratios drive the editorial grid without requiring extra photo metadata.
  const [photoOrientations, setPhotoOrientations] = useState<Record<string, PhotoOrientation>>({});
  // Deep link (#photo-<id>) consumed flag
  const deepLinkConsumedRef = React.useRef(false);
  const portfolioIntroRef = React.useRef<HTMLDivElement>(null);
  const portfolioIntroFrameRef = React.useRef<number | null>(null);
  const portfolioTransitionTimersRef = React.useRef<number[]>([]);

  // Simulate initial loading state
  useEffect(() => {
    const timer = setTimeout(() => setIsInitialLoading(false), 800);
    return () => clearTimeout(timer);
  }, [photos]);

  // Use useMemo to optimize filtering logic; broken images are excluded
  const filteredItems = useMemo(() => {
    const byCategory = activeCategory === 'all'
      ? photos
      : photos.filter(item => item.category === activeCategory);
    return byCategory.filter(item => !brokenIds.has(item.id) && !UNSUPPORTED_BROWSER_IMAGE.test(item.image));
  }, [photos, activeCategory, brokenIds]);

  // Currently rendered page of photos
  const visibleItems = useMemo(
    () => filteredItems.slice(0, visibleCount),
    [filteredItems, visibleCount]
  );

  const introPhoto = filteredItems[0]?.image || photos[0]?.image || '/assets/images/background-poster.jpg';

  useEffect(() => {
    const intro = portfolioIntroRef.current;
    if (!intro) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let laidOutWidth = window.innerWidth;

    const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
    const smoothstep = (from: number, to: number, value: number) => {
      const x = clamp((value - from) / Math.max(0.0001, to - from));
      return x * x * (3 - 2 * x);
    };

    const update = () => {
      portfolioIntroFrameRef.current = null;

      if (window.innerWidth >= 768 || motionQuery.matches) {
        intro.style.removeProperty('--portfolio-world-progress');
        intro.style.removeProperty('--portfolio-world-rail-shift');
        intro.style.removeProperty('--portfolio-world-media-opacity');
        intro.style.removeProperty('--portfolio-world-media-scale');
        intro.style.removeProperty('--portfolio-world-media-blur');
        intro.style.removeProperty('--portfolio-world-copy-opacity');
        intro.style.removeProperty('--portfolio-world-copy-y');
        intro.style.removeProperty('--portfolio-world-controls-opacity');
        intro.style.removeProperty('--portfolio-world-controls-y');
        intro.style.removeProperty('--portfolio-world-veil');
        intro.style.removeProperty('--portfolio-world-chrome-opacity');
        const stage = intro.querySelector<HTMLElement>('.portfolio-scroll-world__stage');
        stage?.style.removeProperty('position');
        stage?.style.removeProperty('top');
        return;
      }

      const introTop = window.scrollY + intro.getBoundingClientRect().top;
      const scrollRange = Math.max(1, intro.offsetHeight - window.innerHeight);
      const distance = window.scrollY - introTop;
      const progress = clamp(distance / scrollRange);
      const stage = intro.querySelector<HTMLElement>('.portfolio-scroll-world__stage');
      const controlsEntrance = smoothstep(0.14, 0.4, progress);
      const exit = smoothstep(0.78, 1, progress);
      const mediaEntrance = smoothstep(0.03, 0.56, progress);

      intro.style.setProperty('--portfolio-world-progress', String(progress));
      intro.style.setProperty('--portfolio-world-rail-shift', `${(1 - progress) * -100}%`);
      if (stage) {
        if (distance <= 0) {
          stage.style.position = 'absolute';
          stage.style.top = '0px';
        } else if (distance >= scrollRange) {
          stage.style.position = 'absolute';
          stage.style.top = `${scrollRange}px`;
        } else {
          stage.style.position = 'fixed';
          stage.style.top = '0px';
        }
      }
      intro.style.setProperty('--portfolio-world-media-opacity', String((0.07 + mediaEntrance * 0.38) * (1 - exit * 0.68)));
      intro.style.setProperty('--portfolio-world-media-scale', String(1.13 - progress * 0.1));
      intro.style.setProperty('--portfolio-world-media-blur', `${Math.max(1, 8 - progress * 7)}px`);
      intro.style.setProperty('--portfolio-world-copy-opacity', String(1 - smoothstep(0.56, 0.82, progress)));
      intro.style.setProperty('--portfolio-world-copy-y', `${-progress * 18}px`);
      intro.style.setProperty('--portfolio-world-controls-opacity', String(controlsEntrance * (1 - exit)));
      intro.style.setProperty('--portfolio-world-controls-y', `${(1 - controlsEntrance) * 24 - exit * 14}px`);
      intro.style.setProperty('--portfolio-world-veil', String(exit * 0.88));
      intro.style.setProperty('--portfolio-world-chrome-opacity', String(1 - exit));
    };

    const requestUpdate = () => {
      if (portfolioIntroFrameRef.current === null) {
        portfolioIntroFrameRef.current = window.requestAnimationFrame(update);
      }
    };

    const onResize = () => {
      // Ignore iOS URL-bar height changes; width changes still recompose the stage.
      if (window.innerWidth === laidOutWidth) return;
      laidOutWidth = window.innerWidth;
      requestUpdate();
    };

    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', onResize);
    motionQuery.addEventListener?.('change', requestUpdate);
    requestUpdate();

    return () => {
      if (portfolioIntroFrameRef.current !== null) {
        window.cancelAnimationFrame(portfolioIntroFrameRef.current);
      }
      window.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', onResize);
      motionQuery.removeEventListener?.('change', requestUpdate);
      const stage = intro.querySelector<HTMLElement>('.portfolio-scroll-world__stage');
      stage?.style.removeProperty('position');
      stage?.style.removeProperty('top');
    };
  }, []);

  useEffect(() => () => {
    portfolioTransitionTimersRef.current.forEach(timer => window.clearTimeout(timer));
    portfolioTransitionTimersRef.current = [];
  }, []);

  // Reset pagination when switching category
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeCategory]);

  // Open photo from share deep link (#photo-<id>) once data is available
  useEffect(() => {
    if (deepLinkConsumedRef.current) return;
    const requestedPhotoId = photoIdFromLocation();
    if (!requestedPhotoId) {
      deepLinkConsumedRef.current = true;
      return;
    }
    const target = photos.find(photo => String(photo.id) === requestedPhotoId);
    if (target) {
      deepLinkConsumedRef.current = true;
      setSelectedPhoto(target);
      setIsViewerOpen(true);
      document.querySelector('#portfolio')?.scrollIntoView();
    }
  }, [photos]);

  const portfolioCategories = useMemo(
    () => ['all', ...Array.from(new Set(photos.map(photo => photo.category)))],
    [photos],
  );

  // Use useMemo to optimize category statistics
  const categoryStats = useMemo(() => {
    const stats = new Map<string, number>([['all', photos.length]]);

    photos.forEach(photo => {
      stats.set(photo.category, (stats.get(photo.category) ?? 0) + 1);
    });

    return stats;
  }, [photos]);

  // Use useCallback to optimize functions
  const getCategoryCount = useCallback((categoryId: string) => {
    return categoryStats.get(categoryId) || 0;
  }, [categoryStats]);

  const visibleCategories = useMemo(
    () => portfolioCategories.filter(category => category === 'all' || getCategoryCount(category) > 0),
    [portfolioCategories, getCategoryCount]
  );

  const rememberPhotoOrientation = useCallback((id: string | number, image: HTMLImageElement) => {
    if (!image.naturalWidth || !image.naturalHeight) return;
    const ratio = image.naturalWidth / image.naturalHeight;
    const orientation: PhotoOrientation = ratio > 1.18 ? 'landscape' : ratio < 0.88 ? 'portrait' : 'square';
    const key = String(id);

    setPhotoOrientations(current => current[key] === orientation
      ? current
      : { ...current, [key]: orientation });
  }, []);

  // Use useCallback to optimize download function
  const downloadImage = useCallback(async (item: Photo) => {
    if (downloadingItems.has(item.id)) return;

    setDownloadingItems(prev => new Set(prev).add(item.id));

    try {
      await downloadPhoto(item, `${localizePhoto(item, lang, t).title}-LIEN-Photography.jpg`);

      // Show download success state
      setDownloadedItems(prev => new Set(prev).add(item.id));
      setTimeout(() => {
        setDownloadedItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(item.id);
          return newSet;
        });
      }, 2000);

    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setDownloadingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(item.id);
        return newSet;
      });
    }
  }, [downloadingItems, lang, t]);

  const openPhotoViewer = (photo: Photo) => {
    setSelectedPhoto(photo);
    setIsViewerOpen(true);
    // Keep URL shareable - matches the viewer's copy-link format
    setPhotoLocation(photo.id);
  };

  const closePhotoViewer = () => {
    setIsViewerOpen(false);
    setSelectedPhoto(null);
    setPhotoLocation(null);
  };

  const goToNextPhoto = () => {
    if (!selectedPhoto) return;
    const currentIndex = filteredItems.findIndex(item => item.id === selectedPhoto.id);
    const nextIndex = (currentIndex + 1) % filteredItems.length;
    const next = filteredItems[nextIndex] || null;
    setSelectedPhoto(next);
    if (next) setPhotoLocation(next.id);
  };

  const goToPreviousPhoto = () => {
    if (!selectedPhoto) return;
    const currentIndex = filteredItems.findIndex(item => item.id === selectedPhoto.id);
    const prevIndex = currentIndex === 0 ? filteredItems.length - 1 : currentIndex - 1;
    const prev = filteredItems[prevIndex] || null;
    setSelectedPhoto(prev);
    if (prev) setPhotoLocation(prev.id);
  };

  const getCurrentPhotoIndex = () => {
    if (!selectedPhoto) return -1;
    return filteredItems.findIndex(item => item.id === selectedPhoto.id);
  };

  const transitionIntoGallery = (commit: () => void) => {
    const intro = portfolioIntroRef.current;
    const gallery = document.querySelector<HTMLElement>('.portfolio-gallery-content');
    const useCinematicTransition = !!intro
      && window.innerWidth < 768
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!useCinematicTransition || !intro) {
      commit();
      return;
    }

    portfolioTransitionTimersRef.current.forEach(timer => window.clearTimeout(timer));
    portfolioTransitionTimersRef.current = [];
    intro.classList.add('is-committing-selection');

    const commitTimer = window.setTimeout(() => {
      commit();
      window.requestAnimationFrame(() => {
        if (!gallery) return;
        const galleryTop = window.scrollY + gallery.getBoundingClientRect().top;
        window.scrollTo({ top: Math.max(0, galleryTop - 56), behavior: 'smooth' });
      });

      const cleanupTimer = window.setTimeout(() => {
        intro.classList.remove('is-committing-selection');
      }, 950);
      portfolioTransitionTimersRef.current.push(cleanupTimer);
    }, 180);

    portfolioTransitionTimersRef.current.push(commitTimer);
  };

  return (
    <section id="portfolio" className="exhibition-section scroll-mt-16 md:scroll-mt-20">
      <div className="exhibition-section-halo" aria-hidden="true" />
      <div ref={portfolioIntroRef} className="portfolio-scroll-world">
        <div className="portfolio-scroll-world__stage">
          <div className="portfolio-scroll-world__media" aria-hidden="true">
            <AnimatePresence initial={false} mode="sync">
              <motion.img
                key={introPhoto}
                src={introPhoto}
                alt=""
                decoding="async"
                loading="eager"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
              />
            </AnimatePresence>
          </div>
          <div className="portfolio-scroll-world__grade" aria-hidden="true" />
          <div className="portfolio-scroll-world__veil" aria-hidden="true" />
          <div className="portfolio-scroll-world__rail" aria-hidden="true">
            <span>01</span>
            <i />
            <span>{String(visibleCategories.length).padStart(2, '0')}</span>
          </div>

          <div className="portfolio-scroll-world__content max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-10">
            <div className="portfolio-scroll-world__copy">
              <motion.header
                className="exhibition-room-header"
                initial={{ opacity: 0, y: 35 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                viewport={{ once: true, amount: 0.35 }}
              >
                <div>
                  <p className="exhibition-room-label">LIEN · PHOTOGRAPHY</p>
                  <h2>{t('portfolio_title')}</h2>
                </div>
                <p className="exhibition-room-intro">{t('portfolio_intro')}</p>
              </motion.header>
            </div>

            <div className="portfolio-scroll-world__controls">
              <div className="exhibition-toolbar">
                <div className="exhibition-mode-switch liquid-glass" role="group" aria-label={t('portfolio_title')}>
                  <button
                    type="button"
                    className={viewMode === 'exhibition' ? 'is-active' : ''}
                    onClick={() => transitionIntoGallery(() => setViewMode('exhibition'))}
                    aria-pressed={viewMode === 'exhibition'}
                  >
                    <Rows3 aria-hidden="true" />
                    {t('exhibition_view')}
                  </button>
                  <button
                    type="button"
                    className={viewMode === 'index' ? 'is-active' : ''}
                    onClick={() => transitionIntoGallery(() => setViewMode('index'))}
                    aria-pressed={viewMode === 'index'}
                  >
                    <Grid3X3 aria-hidden="true" />
                    {t('exhibition_index')}
                  </button>
                </div>

                <div className="exhibition-category-scroll" aria-label={t('portfolio_title')}>
                  {visibleCategories.map(category => {
                    const isActive = activeCategory === category;
                    return (
                      <button
                        type="button"
                        key={category}
                        onClick={() => transitionIntoGallery(() => setActiveCategory(category))}
                        className={isActive ? 'is-active' : ''}
                      >
                        <span>{category === 'all' ? t('cat_all') : localizePhotoCategory(category, t)}</span>
                        <span>{String(getCategoryCount(category)).padStart(2, '0')}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="portfolio-scroll-world__progress" aria-hidden="true">
            <span />
          </div>
        </div>
      </div>

      <div className="portfolio-gallery-content max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-10 relative z-10">
        <AnimatePresence mode="wait">
          {!isInitialLoading && filteredItems.length === 0 && (
            <motion.div
              className="exhibition-empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ImageIcon className="w-10 h-10" />
              <p>{t('portfolio_empty_msg')}</p>
              <span>{t('portfolio_empty_hint')}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {viewMode === 'exhibition' ? (
          <motion.div className="exhibition-gallery">
            {visibleItems.map((item, index) => {
              const displayItem = localizePhoto(item, lang, t);
              const pieceNumber = String(index + 1).padStart(2, '0');

              return (
                <React.Fragment key={item.id}>
                  <motion.article
                    className={`exhibition-piece exhibition-piece-${index % 6} orientation-${photoOrientations[String(item.id)] || 'landscape'}`}
                    initial={{ opacity: 0, y: 70 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                    viewport={{ once: true, amount: 0.12 }}
                  >
                  <button
                    type="button"
                    className="exhibition-piece-frame group"
                    onClick={() => openPhotoViewer(item)}
                    aria-label={`${t('portfolio_view_photo')}: ${displayItem.title}`}
                  >
                    <OptimizedImage
                      src={item.image}
                      alt={displayItem.title}
                      className="exhibition-piece-image"
                      priority={index < 3}
                      sizes="(max-width: 767px) 100vw, 82vw"
                      onLoad={event => rememberPhotoOrientation(item.id, event.currentTarget)}
                      onError={() => setBrokenIds(prev => new Set(prev).add(item.id))}
                    />
                    <span className="exhibition-piece-wash" aria-hidden="true" />
                    <span className="exhibition-piece-focus" aria-hidden="true">
                      <Eye />
                    </span>
                    <span className="exhibition-piece-number">{pieceNumber}</span>
                  </button>

                  <div className="exhibition-piece-caption">
                    <div>
                      <span className="exhibition-piece-label">{t('exhibition_piece')} {pieceNumber}</span>
                      <h3>{displayItem.title}</h3>
                    </div>
                    <div className="exhibition-piece-meta">
                      {displayItem.location && <span>{displayItem.location}</span>}
                      {displayItem.date && <span>{displayItem.date}</span>}
                    </div>
                  </div>
                  </motion.article>
                </React.Fragment>
              );
            })}
          </motion.div>
        ) : (
          <motion.div className="portfolio-editorial-grid exhibition-index-grid">
            {visibleItems.map((item, index) => {
              const displayItem = localizePhoto(item, lang, t);
              return (
                <motion.article
                  key={item.id}
                  className={`photo-glass-card portfolio-editorial-card group cursor-pointer overflow-hidden rounded-2xl bg-white/5 border border-white/10 transition-all duration-500 orientation-${photoOrientations[String(item.id)] || 'portrait'}`}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.42, delay: Math.min(index * 0.035, 0.24) }}
                  onClick={() => openPhotoViewer(item)}
                >
                  <OptimizedImage
                    src={item.image}
                    alt={displayItem.title}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 rounded-2xl"
                    priority={index < 6}
                    sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw"
                    onLoad={event => rememberPhotoOrientation(item.id, event.currentTarget)}
                    onError={() => setBrokenIds(prev => new Set(prev).add(item.id))}
                  />
                  <div className="photo-card-scrim absolute inset-0 pointer-events-none rounded-2xl" />
                  <div className="photo-info-glass absolute bottom-0 left-0 right-0 p-4 sm:p-5 text-white z-10">
                    <h3 className="font-artistic font-tc-optimize text-base sm:text-lg line-clamp-1 mb-1">{displayItem.title}</h3>
                    <p className="text-white/80 text-xs sm:text-sm line-clamp-2">{displayItem.description}</p>
                    {(displayItem.location || displayItem.date) && (
                      <div className="flex items-center gap-3 mt-2 text-white/60 text-[11px]">
                        {displayItem.location && <span className="flex items-center gap-1 min-w-0"><MapPin className="w-3 h-3" /><span className="truncate">{displayItem.location}</span></span>}
                        {displayItem.date && <span className="flex items-center gap-1 flex-shrink-0"><Calendar className="w-3 h-3" />{displayItem.date}</span>}
                      </div>
                    )}
                  </div>
                  <div className="absolute top-4 right-4 z-10 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
                    <span className="w-11 h-11 flex items-center justify-center rounded-full liquid-glass text-white"><Eye className="w-5 h-5" /></span>
                  </div>
                </motion.article>
              );
            })}
          </motion.div>
        )}

        {/* Load more */}
        {!isInitialLoading && filteredItems.length > visibleCount && (
          <motion.div
            className="text-center mt-20"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            <button
              onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
              className="px-6 py-3 rounded-full text-sm text-white/80 hover:text-white border border-white/20 hover:border-white/35 transition-colors touch-manipulation liquid-glass"
              style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(16px)' }}
            >
              {t('portfolio_view_more')}
              <span className="text-white/45"> · {filteredItems.length - visibleCount}</span>
            </button>
          </motion.div>
        )}

        {/* Collection count caption */}
        {!isInitialLoading && filteredItems.length > 0 && (
          <motion.div
            className="flex items-center justify-center gap-3 mt-12"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            viewport={{ once: true }}
          >
            <div className="h-px w-10 bg-gradient-to-r from-transparent to-white/25" />
            <span className="text-white/45 text-xs tracking-widest">
              {Math.min(visibleCount, filteredItems.length)} / {filteredItems.length} {t('portfolio_photos_count')}
            </span>
            <div className="h-px w-10 bg-gradient-to-l from-transparent to-white/25" />
          </motion.div>
        )}
      </div>

      {/* Photo Viewer Modal */}
      <PhotoViewer
        isOpen={isViewerOpen}
        onClose={closePhotoViewer}
        photo={selectedPhoto}
        onNext={goToNextPhoto}
        onPrevious={goToPreviousPhoto}
        hasNext={getCurrentPhotoIndex() < filteredItems.length - 1}
        hasPrevious={getCurrentPhotoIndex() > 0}
        onDownload={downloadImage}
        isDownloading={selectedPhoto ? downloadingItems.has(selectedPhoto.id) : false}
        isDownloaded={selectedPhoto ? downloadedItems.has(selectedPhoto.id) : false}
      />

    </section>
  );
}
