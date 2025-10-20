
import { motion } from 'motion/react';
import { LiquidGlassButton } from '@/components/common/LiquidGlassButton';
import { useI18n } from '@/i18n';
import { ScrollRevealText } from '@/components/ui/ScrollRevealText';

export function AboutSection() {
  const { t } = useI18n();

  return (
    <section id="about" className="about-section py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden scroll-mt-16 md:scroll-mt-20">
      {/* Background ambient blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute blob-1"
          style={{
            top: '20%',
            left: '-5%',
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.025) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
        <div
          className="absolute blob-2"
          style={{
            bottom: '10%',
            right: '0%',
            width: 250,
            height: 250,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.02) 0%, transparent 70%)',
            filter: 'blur(50px)',
          }}
        />
      </div>

      <div className="max-w-4xl mx-auto relative">
        <div className="grid grid-cols-1 items-center">
          {/* Left Content */}
          <motion.div
            className="about-copy-glass liquid-glass glass-noise"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <motion.h2
              className="text-white font-tc-optimize text-4xl mb-2 section-title-line"
              style={{ lineHeight: '2.2', letterSpacing: '0.15em' }}
              whileInView={{
                textShadow: ['0 0 0px rgba(255,255,255,0)', '0 0 30px rgba(255,255,255,0.2)', '0 0 0px rgba(255,255,255,0)']
              }}
              transition={{ duration: 2, delay: 0.5 }}
              viewport={{ once: true }}
            >
              {t('about_title_1')}
            </motion.h2>
            <h3 className="text-white/80 font-artistic font-tc-optimize text-2xl mb-8">{t('about_title_2')}</h3>

            <ScrollRevealText
              text={`${t('about_p1')} ${t('about_p2')}`}
              className="space-y-3"
              lineClassName="text-white/80 font-serif font-tc-optimize"
            />

            <motion.div
              className="mt-8"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              viewport={{ once: true }}
            >
              <LiquidGlassButton
                onClick={() => {
                  const element = document.querySelector('#contact');
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                size="lg"
              >
                {t('about_cta')}
              </LiquidGlassButton>
            </motion.div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
