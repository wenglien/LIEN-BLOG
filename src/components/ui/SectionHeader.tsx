import { motion } from 'motion/react';
import { ScrollRevealText } from './ScrollRevealText';

interface SectionHeaderProps {
  title: string;
  intro?: string;
}

// Unified section header: decorative eyebrow line + brush-style title + reveal intro
export function SectionHeader({ title, intro }: SectionHeaderProps) {
  return (
    <motion.div
      className="section-header-prism text-center mb-16"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      viewport={{ once: true }}
    >
      {/* Eyebrow decorative line - echoes hero */}
      <motion.div
        className="flex items-center justify-center gap-4 mb-5"
        initial={{ opacity: 0, scaleX: 0 }}
        whileInView={{ opacity: 1, scaleX: 1 }}
        transition={{ duration: 0.8, delay: 0.1 }}
        viewport={{ once: true }}
      >
        <div className="h-px w-12 bg-gradient-to-r from-transparent to-white/35" />
        <div className="w-1 h-1 rounded-full bg-white/50" />
        <div className="h-px w-12 bg-gradient-to-l from-transparent to-white/35" />
      </motion.div>

      <h2
        className="text-white font-tc-optimize text-3xl sm:text-4xl mb-4"
        style={{ lineHeight: '2.2', letterSpacing: '0.15em' }}
      >
        {title}
      </h2>

      {intro && (
        <ScrollRevealText
          text={intro}
          className="max-w-2xl mx-auto space-y-2"
          lineClassName="text-white/70 font-serif font-tc-optimize"
        />
      )}
    </motion.div>
  );
}
