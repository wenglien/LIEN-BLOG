import { useEffect, useState, useCallback, Suspense, lazy } from 'react';
import { motion, useSpring, useMotionValue } from 'motion/react';
import { VideoBackground } from './components/media/VideoBackground';
import { NavigationBar } from './components/layout/NavigationBar';
import { HeroSection } from './components/sections/HeroSection';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { getAllPhotos } from './services/photoService';
import { PerformanceMonitor } from './components/system/PerformanceMonitor';
import { ErrorBoundary } from './components/system/ErrorBoundary';
import { Photo } from './types/photo';
import { BackgroundMusic } from './components/media/BackgroundMusic';
import { BackToTop } from './components/layout/BackToTop';
import { MobileScrollWorld } from './components/media/MobileScrollWorld';

// Lazy load non-critical components
const PortfolioSection = lazy(() => import('./components/gallery/PortfolioSection').then(module => ({ default: module.PortfolioSection })));
const AboutSection = lazy(() => import('./components/sections/AboutSection').then(module => ({ default: module.AboutSection })));
const ContactSection = lazy(() => import('./components/sections/ContactSection').then(module => ({ default: module.ContactSection })));
const Footer = lazy(() => import('./components/layout/Footer').then(module => ({ default: module.Footer })));
const AdminPanel = lazy(() => import('./components/admin/AdminPanel').then(module => ({ default: module.AdminPanel })));
const AuthModal = lazy(() => import('./components/admin/AuthModal').then(module => ({ default: module.AuthModal })));

function AppContent() {
  const { isAuthenticated, isAuthModalOpen, setAuthModalOpen, login } = useAuth();
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [useMobileScrollWorld, setUseMobileScrollWorld] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  // Track whether the user was trying to open admin panel before auth
  const [adminPanelPending, setAdminPanelPending] = useState(false);

  // When authentication completes and admin panel was pending, open it
  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 767px)');
    const updateMobileExperience = () => setUseMobileScrollWorld(mobileQuery.matches);
    mobileQuery.addEventListener?.('change', updateMobileExperience);
    return () => mobileQuery.removeEventListener?.('change', updateMobileExperience);
  }, []);

  useEffect(() => {
    if (isAuthenticated && adminPanelPending && !isAuthModalOpen) {
      setIsAdminPanelOpen(true);
      setAdminPanelPending(false);
    }
  }, [isAuthenticated, adminPanelPending, isAuthModalOpen]);

  // Initialize with default photos for immediate display
  const defaultPhotos: Photo[] = [
    {
      id: '1',
      category: 'creative',
      title: 'Creative Perspective',
      description: 'Breaking traditional creative photography boundaries with unique composition and color combinations, creating stunning visual effects. This work blends fashion and art elements, showcasing the infinite possibilities of photography.',
      image: '/assets/images/DSC03846-portfolio.jpg',
      date: 'February 2024',
      location: 'Taichung Creative Park',
      camera: 'Sony A7R IV',
      lens: '24-70mm f/2.8 GM',
      settings: 'f/4.0, 1/60s, ISO 800'
    },
    {
      id: '2',
      category: 'landscape',
      title: 'Mountain Secrets',
      description: 'Exploring Taiwan\'s hidden natural beauty, this work captures the sea of clouds between mountain ranges at dawn. Through long exposure, it captures the changing light, showcasing nature\'s grandeur and tranquility.',
      image: '/assets/images/background-poster.jpg',
      date: 'January 2024',
      location: 'Alishan National Forest Recreation Area',
      camera: 'Nikon D850',
      lens: '14-24mm f/2.8G',
      settings: 'f/8.0, 30s, ISO 100'
    }
  ];

  const [portfolioPhotos, setPortfolioPhotos] = useState<Photo[]>(defaultPhotos);

  // Load photo data - Optimized loading strategy
  const loadPhotos = useCallback(async () => {
    try {


      // Default photos are already set in initial state for immediate display

      // Asynchronously load Firebase photos
      try {
        const firebasePhotos = await getAllPhotos();
        console.log('Number of photos loaded from Firebase:', firebasePhotos.length);

        if (firebasePhotos.length > 0) {
          // Update to Firebase photos
          console.log('Updating portfolio photos, count:', firebasePhotos.length);
          setPortfolioPhotos(firebasePhotos);
        } else {
          console.warn('No photos in Firebase, using default photos');
          // Keep default photos
        }
      } catch (firebaseError) {
        console.warn('Failed to load Firebase photos, using default photos:', firebaseError);
        // Keep default photos
      }
    } catch (error) {
      console.error('Failed to load photos:', error);
    } finally {

    }
  }, []);

  // Fetch Firebase photos shortly after the first render.
  useEffect(() => {
    const timer = setTimeout(() => {
      loadPhotos();
    }, 100);
    return () => clearTimeout(timer);
  }, [loadPhotos]);

  useEffect(() => {
    // Ensure smooth scrolling
    document.documentElement.style.scrollBehavior = 'smooth';

    // Listen for admin panel open event
    const handleOpenAdminPanel = () => {
      if (isAuthenticated) {
        setIsAdminPanelOpen(true);
      } else {
        setAdminPanelPending(true);
        setAuthModalOpen(true);
      }
    };

    window.addEventListener('openAdminPanel', handleOpenAdminPanel);

    return () => {
      document.documentElement.style.scrollBehavior = 'auto';
      window.removeEventListener('openAdminPanel', handleOpenAdminPanel);
    };
  }, [isAuthenticated, setAuthModalOpen]);

  // Global cursor glow
  const cursorX = useMotionValue(-300);
  const cursorY = useMotionValue(-300);
  const smoothX = useSpring(cursorX, { stiffness: 80, damping: 20 });
  const smoothY = useSpring(cursorY, { stiffness: 80, damping: 20 });
  const [isCursorVisible, setIsCursorVisible] = useState(false);
  const [hasFinePointer, setHasFinePointer] = useState(false);

  useEffect(() => {
    const pointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    const updatePointerMode = () => setHasFinePointer(pointerQuery.matches);
    updatePointerMode();

    const handleMouseMove = (e: MouseEvent) => {
      if (!pointerQuery.matches) return;
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
      setIsCursorVisible(true);
    };
    const handleMouseLeave = () => setIsCursorVisible(false);
    window.addEventListener('mousemove', handleMouseMove);
    document.documentElement.addEventListener('mouseleave', handleMouseLeave);
    pointerQuery.addEventListener?.('change', updatePointerMode);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.documentElement.removeEventListener('mouseleave', handleMouseLeave);
      pointerQuery.removeEventListener?.('change', updatePointerMode);
    };
  }, [cursorX, cursorY]);

  return (
    <div className="min-h-screen text-foreground">
      {/* Global cursor glow effect */}
      {hasFinePointer && <motion.div
        className="fixed pointer-events-none z-[9999] rounded-full"
        style={{
          x: smoothX,
          y: smoothY,
          translateX: '-50%',
          translateY: '-50%',
          width: 500,
          height: 500,
          background: 'radial-gradient(circle, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.015) 30%, transparent 70%)',
          opacity: isCursorVisible ? 1 : 0,
          transition: 'opacity 0.5s ease',
          mixBlendMode: 'screen',
        }}
      />}

      {/* Dynamic Video Background */}
      <VideoBackground>
            {/* Main Content */}
            <NavigationBar />

            <main>
              {useMobileScrollWorld ? (
                <MobileScrollWorld />
              ) : (
                <HeroSection
                  photoCount={portfolioPhotos.length}
                  categoryCount={new Set(portfolioPhotos.map(p => p.category)).size}
                />
              )}

              <Suspense fallback={<div className="py-20 flex items-center justify-center"><div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" /></div>}>
                <PortfolioSection photos={portfolioPhotos} />
              </Suspense>

              <motion.div
                className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent mx-8"
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                transition={{ duration: 1 }}
                viewport={{ once: true }}
              />

              <Suspense fallback={<div className="py-20 flex items-center justify-center"><div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" /></div>}>
                <AboutSection />
              </Suspense>

              <Suspense fallback={<div className="py-20 flex items-center justify-center"><div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" /></div>}>
                <ContactSection />
              </Suspense>
            </main>

            <Suspense fallback={<div className="py-8 flex items-center justify-center"><div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" /></div>}>
              <Footer />
            </Suspense>

      </VideoBackground>

      {/* Auth Modal */}
      <Suspense fallback={null}>
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => {
            setAuthModalOpen(false);
            setAdminPanelPending(false);
          }}
          onAuthSuccess={login}
        />
      </Suspense>

      {/* Admin Panel */}
      {isAuthenticated && (
        <Suspense fallback={null}>
          <AdminPanel
            isOpen={isAdminPanelOpen}
            onClose={() => setIsAdminPanelOpen(false)}
            onPhotosUpdate={setPortfolioPhotos}
            existingPhotos={portfolioPhotos}
          />
        </Suspense>
      )}

      {/* Back to top button */}
      <BackToTop />

      {/* Background music remains visitor-controlled. */}
      <BackgroundMusic isVisible={true} />

      {/* Performance Monitor - Only display in development environment */}
      {process.env.NODE_ENV === 'development' && <PerformanceMonitor />}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
