import { useEffect, useRef, useState } from 'react';
import {
  motion,
  MotionValue,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { LiquidGlassButton } from '@/components/common/LiquidGlassButton';
import { useI18n } from '@/i18n';

function TypewriterText({ text }: { text: string }) {
  const prefersReducedMotion = useReducedMotion();
  const [displayedText, setDisplayedText] = useState(prefersReducedMotion ? text : '');

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayedText(text);
      return;
    }

    setDisplayedText('');
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setDisplayedText(text.slice(0, index));
      if (index >= text.length) window.clearInterval(timer);
    }, 42);

    return () => window.clearInterval(timer);
  }, [prefersReducedMotion, text]);

  return <>{displayedText}</>;
}

function ExhibitionLight({ x, y }: { x: MotionValue<number>; y: MotionValue<number> }) {
  const lightX = useSpring(useTransform(x, value => 50 + value * 18), { stiffness: 55, damping: 28 });
  const lightY = useSpring(useTransform(y, value => 42 + value * 14), { stiffness: 55, damping: 28 });
  const light = useMotionTemplate`radial-gradient(circle at ${lightX}% ${lightY}%, rgba(225, 244, 240, 0.13) 0%, rgba(167, 211, 209, 0.045) 25%, transparent 57%)`;

  return <motion.div className="exhibition-hero-light" style={{ background: light }} aria-hidden="true" />;
}

interface HeroSectionProps {
  photoCount?: number;
  categoryCount?: number;
}

export function HeroSection({ photoCount, categoryCount }: HeroSectionProps) {
  const { t, lang } = useI18n();
  const prefersReducedMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement | null>(null);
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const [hasFinePointer, setHasFinePointer] = useState(false);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  });
  const contentY = useTransform(scrollYProgress, [0, 1], ['0%', '22%']);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.72], [1, 0]);

  useEffect(() => {
    const pointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    const updatePointerMode = () => setHasFinePointer(pointerQuery.matches);
    updatePointerMode();
    pointerQuery.addEventListener?.('change', updatePointerMode);

    const handlePointerMove = (event: MouseEvent) => {
      if (!pointerQuery.matches || !sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      pointerX.set((event.clientX - rect.left - rect.width / 2) / rect.width);
      pointerY.set((event.clientY - rect.top - rect.height / 2) / rect.height);
    };

    window.addEventListener('mousemove', handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      pointerQuery.removeEventListener?.('change', updatePointerMode);
    };
  }, [pointerX, pointerY]);

  const scrollToPortfolio = () => {
    document.querySelector('#portfolio')?.scrollIntoView({ behavior: 'smooth' });
  };

  const titleParts = lang === 'zh'
    ? ['光影', '之旅']
    : ['Journey of', 'Light'];

  return (
    <section ref={sectionRef} id="home" className="exhibition-hero relative min-h-screen overflow-hidden">
      <div className="exhibition-hero-shade" aria-hidden="true" />
      {hasFinePointer && !prefersReducedMotion && <ExhibitionLight x={pointerX} y={pointerY} />}

      <div className="exhibition-hero-frame" aria-hidden="true">
        <span className="exhibition-frame-index">01</span>
        <span className="exhibition-frame-name">LIEN · PHOTOGRAPHY</span>
        <span className="exhibition-frame-year">MMXXVI</span>
      </div>

      <motion.div
        className="exhibition-hero-content"
        style={prefersReducedMotion ? undefined : { y: contentY, opacity: contentOpacity }}
      >
        <motion.div
          className="exhibition-kicker"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15 }}
        >
          <span className="exhibition-kicker-line" />
          <span>LIEN · PHOTOGRAPHY</span>
        </motion.div>

        <motion.h1
          className="exhibition-title"
          initial={{ opacity: 0, y: 34 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.05, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <span>{titleParts[0]}</span>
          <span className="exhibition-title-accent">{titleParts[1]}</span>
        </motion.h1>

        <motion.div
          className="exhibition-intro-grid"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, delay: 0.55 }}
        >
          <p className="exhibition-curatorial-note">
            <TypewriterText text={`${t('hero_desc_1')} ${t('hero_desc_2')}`} />
          </p>

          <div className="exhibition-ticket liquid-glass">
            <div>
              <span>{t('stat_photos')}</span>
              <strong>{String(photoCount || '—').padStart(2, '0')}</strong>
            </div>
            <div>
              <span>{t('stat_categories')}</span>
              <strong>{String(categoryCount || '—').padStart(2, '0')}</strong>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="exhibition-hero-actions"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.78 }}
        >
          <LiquidGlassButton onClick={scrollToPortfolio} size="lg" className="exhibition-enter-button">
            <span>{t('hero_explore')}</span>
            <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
          </LiquidGlassButton>

          <button
            type="button"
            className="exhibition-index-link"
            onClick={() => {
              document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            {t('hero_contact')}
          </button>
        </motion.div>
      </motion.div>

      <motion.button
        type="button"
        className="exhibition-scroll-cue"
        onClick={scrollToPortfolio}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1.1 }}
        aria-label={t('hero_scroll_hint')}
      >
        <span>{t('hero_scroll_hint')}</span>
        <motion.span animate={{ y: [0, 7, 0] }} transition={{ duration: 2.2, repeat: Infinity }}>
          <ArrowDown className="w-4 h-4" aria-hidden="true" />
        </motion.span>
      </motion.button>
    </section>
  );
}
