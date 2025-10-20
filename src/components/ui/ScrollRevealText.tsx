
import { motion } from 'motion/react';

interface ScrollRevealTextProps {
  text: string;
  className?: string;
  lineClassName?: string;
  delayPerLineMs?: number;
}

// Split text by punctuation, while keeping punctuation
function splitBySentences(input: string): string[] {
  const regex = /(.*?[。！!？?；;：:])(\s|$)|([^。！!？?；;：:]+$)/g;
  const sentences: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(input)) !== null) {
    const part = (match[1] ?? match[3] ?? '').trim();
    if (part) sentences.push(part);
  }
  return sentences.length > 0 ? sentences : [input];
}

export function ScrollRevealText({ text, className, lineClassName, delayPerLineMs = 120 }: ScrollRevealTextProps) {
  const lines = splitBySentences(text);

  return (
    <div className={className}>
      {lines.map((line, index) => (
        <motion.p
          key={`${index}-${line}`}
          className={lineClassName}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: (index * delayPerLineMs) / 1000 }}
          viewport={{ once: true, margin: '-10% 0px -10% 0px' }}
        >
          {line}
        </motion.p>
      ))}
    </div>
  );
}

export default ScrollRevealText;
