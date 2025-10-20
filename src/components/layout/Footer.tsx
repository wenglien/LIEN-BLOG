import { motion } from 'motion/react';
import { ArrowUpRight, Instagram, Linkedin, Mail, Phone, Settings } from 'lucide-react';
import { useI18n } from '@/i18n';

const socialLinks = [
  { icon: Instagram, href: 'https://www.instagram.com/_92_me_/?hl=zh-tw', label: 'Instagram', external: true },
  { icon: Linkedin, href: 'https://www.linkedin.com/in/weng-li-en', label: 'LinkedIn', external: true },
  { icon: Mail, href: 'mailto:ian921030@gmail.com', label: 'Email', external: false },
];

const quickLinks = [
  { nameKey: 'footer_home', href: '#home' },
  { nameKey: 'footer_portfolio', href: '#portfolio' },
  { nameKey: 'footer_about', href: '#about' },
  { nameKey: 'footer_contact', href: '#contact' },
];

export function Footer() {
  const { t } = useI18n();
  const currentYear = new Date().getFullYear();

  const scrollToSection = (href: string) => {
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer className="site-footer art-footer">
      <div className="art-footer-atmosphere" aria-hidden="true">
        <span className="art-footer-glow" />
        <span className="art-footer-grain" />
        <span className="art-footer-monogram">LIEN</span>
      </div>

      <div className="art-footer-inner">
        <motion.div
          className="art-footer-heading"
          initial={{ opacity: 0, y: 36 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ once: true, amount: 0.25 }}
        >
          <div className="art-footer-heading-meta">
            <span>LIEN · PHOTOGRAPHY</span>
            <span>TAIWAN — {currentYear}</span>
          </div>

          <div className="art-footer-brand-row">
            <div className="art-footer-brand-copy">
              <p className="art-footer-kicker">PHOTOGRAPHY NOTES</p>
              <p className="art-footer-intro">{t('footer_brand_intro')}</p>
            </div>

            <motion.a
              href="mailto:ian921030@gmail.com"
              className="art-footer-contact-cta"
              whileHover={{ scale: 1.025 }}
              whileTap={{ scale: 0.98 }}
            >
              <span>
                <small>{t('cta_contact')}</small>
                <strong>ian921030@gmail.com</strong>
              </span>
              <ArrowUpRight aria-hidden="true" />
            </motion.a>
          </div>
        </motion.div>

        <motion.div
          className="art-footer-directory"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.75, delay: 0.12 }}
          viewport={{ once: true, amount: 0.25 }}
        >
          <nav className="art-footer-nav" aria-label={t('quick_links')}>
            {quickLinks.map((link, index) => (
              <a
                key={link.nameKey}
                href={link.href}
                onClick={(event) => {
                  event.preventDefault();
                  scrollToSection(link.href);
                }}
              >
                <span className="art-footer-nav-index">0{index + 1}</span>
                <span className="art-footer-nav-label">{t(link.nameKey)}</span>
                <ArrowUpRight aria-hidden="true" />
              </a>
            ))}
          </nav>

          <div className="art-footer-contact-list">
            <a href="tel:+886966003288">
              <Phone aria-hidden="true" />
              <span>+886 966 003 288</span>
            </a>
            <span className="art-footer-location">TAIWAN</span>
          </div>

          <div className="art-footer-socials" aria-label="Social media">
            {socialLinks.map((social) => (
              <motion.a
                key={social.label}
                href={social.href}
                target={social.external ? '_blank' : undefined}
                rel={social.external ? 'noopener noreferrer' : undefined}
                aria-label={social.label}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.94 }}
              >
                <social.icon aria-hidden="true" />
                <span>{social.label}</span>
              </motion.a>
            ))}
          </div>
        </motion.div>

        <div className="art-footer-baseline">
          <p>© {currentYear} LIEN PHOTOGRAPHY</p>

          <div className="art-footer-policies">
            <a href="/privacy-policy.html">{t('footer_privacy')}</a>
            <a href="/terms-of-service.html">{t('footer_terms')}</a>
            <a href="/cookie-policy.html">{t('footer_cookies')}</a>
          </div>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('openAdminPanel'))}
            className="art-footer-admin"
            aria-label="Admin login"
          >
            <Settings aria-hidden="true" />
            <span>Admin</span>
          </button>
        </div>
      </div>
    </footer>
  );
}
