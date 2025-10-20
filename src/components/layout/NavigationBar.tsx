import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useSpring, useMotionValue, useScroll } from 'motion/react';
import { Home, Images, UserRound, Mail, Settings } from 'lucide-react';
import { LiquidGlassButton } from '@/components/common/LiquidGlassButton';
import { useI18n } from '@/i18n';

export function NavigationBar() {
  const { lang, setLang, t } = useI18n();

  const [isScrolled, setIsScrolled] = useState(false);
  const [isExhibitionNavHidden, setIsExhibitionNavHidden] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const lastScrollYRef = useRef(0);

  // Page scroll progress bar
  const { scrollYProgress } = useScroll();
  const scrollProgress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });

  // Smooth cursor glow for nav - motion values only, no re-render per mousemove
  const cursorX = useMotionValue(0);
  const cursorY = useMotionValue(0);
  const smoothX = useSpring(cursorX, { stiffness: 200, damping: 30 });
  const smoothY = useSpring(cursorY, { stiffness: 200, damping: 30 });

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setIsScrolled(currentScrollY > 20);

      const portfolioSection = document.getElementById('portfolio');
      if (portfolioSection && window.innerWidth >= 768) {
        const portfolioRect = portfolioSection.getBoundingClientRect();
        const isInsideExhibition = portfolioRect.top < 110 && portfolioRect.bottom > 120;
        const isMovingDown = currentScrollY > lastScrollYRef.current + 5;
        const isMovingUp = currentScrollY < lastScrollYRef.current - 5;

        if (isInsideExhibition && isMovingDown) setIsExhibitionNavHidden(true);
        if (!isInsideExhibition || isMovingUp) setIsExhibitionNavHidden(false);
      } else {
        setIsExhibitionNavHidden(false);
      }
      lastScrollYRef.current = currentScrollY;

      const sections = ['home', 'portfolio', 'about', 'contact'];
      const scrollPosition = window.scrollY + 100;

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = document.getElementById(sections[i]!);
        if (section) {
          const offsetTop = section.offsetTop;
          if (scrollPosition >= offsetTop) {
            const sectionKey = `nav_${sections[i]}`;
            setActiveItem(sectionKey);
            break;
          }
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientY < 86) setIsExhibitionNavHidden(false);
      if (navRef.current) {
        const rect = navRef.current.getBoundingClientRect();
        cursorX.set(e.clientX - rect.left);
        cursorY.set(e.clientY - rect.top);
      }
    };

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('mousemove', handleMouseMove);
    handleScroll();
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [cursorX, cursorY]);

  const navItems = [
    { key: 'nav_home', href: '#home', icon: Home },
    { key: 'nav_portfolio', href: '#portfolio', icon: Images },
    { key: 'nav_about', href: '#about', icon: UserRound },
    { key: 'nav_contact', href: '#contact', icon: Mail }
  ];

  const [activeItem, setActiveItem] = useState(navItems[0]!.key);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  const onPointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    const container = scrollRef.current;
    if (!container) return;
    isDraggingRef.current = true;
    container.classList.add('cursor-grabbing');
    const pageX = 'touches' in e ? (e.touches[0]?.pageX || 0) : (e as React.MouseEvent).pageX;
    startXRef.current = pageX - container.offsetLeft;
    scrollLeftRef.current = container.scrollLeft;
  };

  const onPointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    const container = scrollRef.current;
    if (!container || !isDraggingRef.current) return;
    const pageX = 'touches' in e ? (e.touches[0]?.pageX || 0) : (e as React.MouseEvent).pageX;
    const x = pageX - container.offsetLeft;
    const walk = (x - startXRef.current) * 1;
    container.scrollLeft = scrollLeftRef.current - walk;
  };

  const onPointerUp = () => {
    const container = scrollRef.current;
    if (!container) return;
    isDraggingRef.current = false;
    container.classList.remove('cursor-grabbing');
  };

  const scrollToSection = (href: string) => {
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      <motion.nav
        ref={navRef}
        className={`site-navigation fixed top-0 left-0 right-0 z-50 overflow-hidden ${isScrolled ? 'is-scrolled' : ''} ${isExhibitionNavHidden ? 'is-exhibition-hidden' : ''}`}
        initial={{ y: -100 }}
        animate={{ y: isExhibitionNavHidden ? -92 : 0, opacity: isExhibitionNavHidden ? 0 : 1 }}
        transition={{ duration: isExhibitionNavHidden ? 0.45 : 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={{
          transition: 'background-color 0.5s ease, backdrop-filter 0.5s ease, border-color 0.5s ease, box-shadow 0.5s ease',
        }}
      >
        {/* Scroll progress bar */}
        <motion.div
          className="navigation-scroll-progress absolute bottom-0 left-0 right-0 h-[2px] origin-left pointer-events-none"
          style={{
            scaleX: scrollProgress,
            background: 'linear-gradient(90deg, rgba(255,255,255,0.15), rgba(255,255,255,0.55), rgba(255,255,255,0.8))',
            opacity: isScrolled ? 1 : 0,
            transition: 'opacity 0.5s ease',
          }}
        />

        {/* Subtle cursor glow inside nav */}
        {isScrolled && (
            <motion.div
              className="navigation-cursor-glow absolute pointer-events-none rounded-full"
            style={{
              x: smoothX,
              y: smoothY,
              width: 200,
              height: 200,
              translateX: '-50%',
              translateY: '-50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)',
            }}
          />
        )}

        <div className="navigation-content max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 md:h-16">
            {/* Logo */}
            <motion.a
              href="#home"
              className="flex-shrink-0"
              whileHover={{ scale: 1.05 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              <div className="flex items-center space-x-3">
                <motion.img
                  src="/logo.png"
                  alt="LIEN Photography Blog"
                  className="h-10 md:h-14 lg:h-16 w-auto select-none"
                  draggable={false}
                  whileHover={{
                    filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.25))',
                  }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </motion.a>

            {/* Desktop Navigation */}
            <div className="hidden md:block">
              <motion.div
                className="desktop-liquid-nav ml-10 relative rounded-full"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                style={{
                  perspective: "1000px",
                  transformStyle: "preserve-3d"
                }}
              >
                {/* Nav pill background - liquid glass capsule, visible when scrolled */}
                <motion.div
                  className="desktop-liquid-nav-surface absolute inset-0 rounded-full liquid-glass"
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4 }}
                />

                <div
                  ref={scrollRef}
                  className="relative overflow-x-auto whitespace-nowrap no-scrollbar cursor-grab select-none"
                  style={{ scrollbarWidth: 'none' as any }}
                  onMouseDown={onPointerDown}
                  onMouseMove={onPointerMove}
                  onMouseLeave={onPointerUp}
                  onMouseUp={onPointerUp}
                  onTouchStart={onPointerDown}
                  onTouchMove={onPointerMove}
                  onTouchEnd={onPointerUp}
                >
                  <div className="flex items-center px-1.5 py-1 space-x-1 relative">
                    {navItems.map((item, index) => {
                      const isActive = activeItem === item.key;
                      const isHovered = hoveredItem === item.key;
                      return (
                        <motion.button
                          key={item.key}
                          onClick={() => {
                            setActiveItem(item.key);
                            scrollToSection(item.href);
                          }}
                          onHoverStart={() => setHoveredItem(item.key)}
                          onHoverEnd={() => setHoveredItem(null)}
                          className="relative z-10 px-3 py-1.5 rounded-full text-xs transition-colors duration-300"
                          initial={{ opacity: 0, y: -10 }}
                          animate={{
                            opacity: 1,
                            y: 0,
                            color: isActive ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.65)',
                          }}
                          whileHover={{ y: -2 }}
                          transition={{ delay: index * 0.06, type: 'spring', stiffness: 400, damping: 25 }}
                        >
                          {/* Hover / Active background pill */}
                          <AnimatePresence>
                            {(isActive || isHovered) && (
                              <motion.span
                                layoutId={isActive ? 'nav-active' : undefined}
                                className="desktop-nav-item-surface absolute inset-0 rounded-full"
                                style={{
                                  background: isActive
                                    ? 'linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.075))'
                                    : 'linear-gradient(180deg, rgba(255,255,255,0.09), rgba(255,255,255,0.035))',
                                  border: isActive
                                    ? '1px solid rgba(255,255,255,0.28)'
                                    : '1px solid rgba(255,255,255,0.12)',
                                  boxShadow: isActive
                                    ? '0 8px 24px rgba(0,0,0,0.2), 0 0 20px rgba(178,238,239,0.09), inset 0 1px 0 rgba(255,255,255,0.38), inset 0 -1px 0 rgba(255,255,255,0.08)'
                                    : 'inset 0 1px 0 rgba(255,255,255,0.18)',
                                }}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ duration: 0.2 }}
                              />
                            )}
                          </AnimatePresence>

                          <motion.span
                            className="relative"
                            animate={isActive ? {
                              textShadow: "0 0 12px rgba(255,255,255,0.5), 0 0 24px rgba(255,255,255,0.2)",
                              scale: 1.03,
                            } : {
                              textShadow: "0 0 0px rgba(255,255,255,0)",
                              scale: 1,
                            }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                          >
                            {t(item.key)}
                          </motion.span>

                          {/* Active dot indicator */}
                          {isActive && (
                            <motion.span
                              className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white/70"
                              layoutId="nav-dot"
                              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                            />
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Language toggle; management is intentionally kept out of visitor navigation. */}
            <div className="hidden md:flex items-center ml-3 gap-2">
              <LiquidGlassButton
                size="sm"
                variant="secondary"
                onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
                className="px-3"
              >
                {lang === 'zh' ? 'EN' : 'ZH'}
              </LiquidGlassButton>
              <LiquidGlassButton
                size="sm"
                variant="secondary"
                onClick={() => window.dispatchEvent(new CustomEvent('openAdminPanel'))}
                className="navigation-admin-button px-3"
              >
                <Settings className="w-4 h-4 mr-1.5" aria-hidden="true" />
                Admin
              </LiquidGlassButton>
            </div>
          </div>
        </div>
      </motion.nav>

      <motion.nav
        className="mobile-bottom-navigation md:hidden"
        aria-label={t('quick_links')}
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
      >
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeItem === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setActiveItem(item.key);
                scrollToSection(item.href);
              }}
              className={`mobile-bottom-navigation-item ${isActive ? 'is-active' : ''}`}
              aria-label={t(item.key)}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="mobile-bottom-navigation-icon">
                {isActive && <motion.span layoutId="mobile-nav-active" className="mobile-bottom-navigation-highlight" />}
                <Icon aria-hidden="true" />
              </span>
              <span className="mobile-bottom-navigation-label">{t(item.key)}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('openAdminPanel'))}
          className="mobile-bottom-navigation-item mobile-bottom-navigation-utility mobile-bottom-navigation-utility-start"
          aria-label={lang === 'zh' ? '開啟照片後台' : 'Open photo admin'}
        >
          <span className="mobile-bottom-navigation-icon">
            <Settings aria-hidden="true" />
          </span>
        </button>

        <button
          type="button"
          onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
          className="mobile-bottom-navigation-item mobile-bottom-navigation-utility"
          aria-label={lang === 'zh' ? 'Switch to English' : '切換為中文'}
        >
          <span className="mobile-bottom-navigation-icon">
            <span className="mobile-bottom-navigation-language" aria-hidden="true">
              {lang === 'zh' ? 'EN' : '中'}
            </span>
          </span>
        </button>
      </motion.nav>
    </>
  );
}
