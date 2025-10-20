import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Phone, MapPin, Send, CheckCircle, AlertCircle, User, MessageSquare, Sparkles, Loader2 } from 'lucide-react';
import { LiquidGlassButton } from '@/components/common/LiquidGlassButton';
import { useI18n } from '@/i18n';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { sendContactEmail, sendContactEmailFallback, ContactFormData } from '@/services/emailService';

interface FormData {
  name: string;
  email: string;
  phone: string;
  topic: string;
  message: string;
}

const contactInfo = [
  {
    icon: Phone,
    titleKey: 'contact_phone_title',
    content: '+886 966003288',
    descriptionKey: 'contact_phone_desc',
    href: 'tel:+886966003288'
  },
  {
    icon: Mail,
    titleKey: 'contact_email_title',
    content: 'ian921030@gmail.com',
    descriptionKey: 'contact_email_desc',
    href: 'mailto:ian921030@gmail.com'
  },
  {
    icon: MapPin,
    titleKey: 'contact_footprint_title',
    contentKey: 'contact_footprint_location',
    descriptionKey: 'contact_footprint_desc',
    href: 'https://www.google.com/maps/search/?api=1&query=Taiwan',
    external: true
  }
];

const topicOptions = [
  'topic_technique',
  'topic_share',
  'topic_location',
  'topic_equipment',
  'topic_post',
  'topic_other'
];

// Form input validation
interface ValidationErrors {
  name?: string;
  email?: string;
  phone?: string;
  topic?: string;
  message?: string;
}

export function ContactSection() {
  const { t } = useI18n();
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    topic: '',
    message: ''
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Validate email format
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Validate phone format
  const validatePhone = (phone: string): boolean => {
    const phoneRegex = /^[0-9+\-\s()]{8,}$/;
    return phoneRegex.test(phone);
  };

  // Real-time validation
  const validateField = (name: string, value: string): string | undefined => {
    switch (name) {
      case 'name':
        if (!value.trim()) return t('form_error_name_required');
        if (value.trim().length < 2) return t('form_error_name_short');
        break;
      case 'email':
        if (!value.trim()) return t('form_error_email_required');
        if (!validateEmail(value)) return t('form_error_email_invalid');
        break;
      case 'phone':
        if (value.trim() && !validatePhone(value)) return t('form_error_phone_invalid');
        break;
      case 'message':
        if (!value.trim()) return t('form_error_message_required');
        break;
    }
    return undefined;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all required fields
    const errors: ValidationErrors = {};
    const fields = ['name', 'email', 'message'] as const;

    fields.forEach(field => {
      const error = validateField(field, formData[field]);
      if (error) errors[field] = error;
    });

    if (formData.phone.trim()) {
      const phoneError = validateField('phone', formData.phone);
      if (phoneError) errors.phone = phoneError;
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      // Scroll to first error field
      const firstErrorField = fields.find(f => errors[f]);
      if (firstErrorField && formRef.current) {
        const element = formRef.current.querySelector(`[name="${firstErrorField}"]`);
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Try sending with EmailJS
      let emailSent = false;

      try {
        emailSent = await sendContactEmail(formData as ContactFormData);
      } catch (error) {
        console.log('EmailJS failed, trying fallback method...');
        // If EmailJS fails, use fallback method
        emailSent = await sendContactEmailFallback(formData as ContactFormData);
      }

      if (emailSent) {
        setIsSubmitted(true);
        setValidationErrors({});
        // Reset form
        setTimeout(() => {
          setIsSubmitted(false);
          setFormData({
            name: '',
            email: '',
            phone: '',
            topic: '',
            message: ''
          });
        }, 5000);
      } else {
        setSubmitError(t('error_send_failed'));
      }
    } catch (error) {
      console.error('Email sending error:', error);
      setSubmitError(t('error_send_failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Real-time validation (clear only if error exists)
    if (validationErrors[name as keyof ValidationErrors]) {
      const error = validateField(name, value);
      setValidationErrors(prev => ({
        ...prev,
        [name]: error
      }));
    }
  };

  // Validate on blur
  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFocusedField(null);
    const error = validateField(name, value);
    setValidationErrors(prev => ({
      ...prev,
      [name]: error
    }));
  };

  // On focus
  const handleFocus = (fieldName: string) => {
    setFocusedField(fieldName);
  };

  return (
    <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8 scroll-mt-16 md:scroll-mt-20">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <SectionHeader title={t('contact_title')} intro={t('contact_intro')} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
          {/* Contact Info */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h3 className="text-white font-artistic font-tc-optimize mb-8">{t('contact_info')}</h3>

            <div className="space-y-6 mb-12">
              {contactInfo.map((info, index) => (
                <motion.a
                  key={info.titleKey}
                  href={info.href}
                  target={info.external ? '_blank' : undefined}
                  rel={info.external ? 'noopener noreferrer' : undefined}
                  className="flex items-start space-x-3 sm:space-x-4 p-4 sm:p-6 contact-card glass-noise"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <motion.div
                    className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-white/10 rounded-full flex items-center justify-center"
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.6 }}
                  >
                    <info.icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </motion.div>
                  <div>
                    <h4 className="text-white font-tc-optimize mb-1">{t(info.titleKey)}</h4>
                    <p className="text-white/90 font-tc-optimize mb-1">{info.contentKey ? t(info.contentKey) : info.content}</p>
                    <p className="text-white/60 font-tc-optimize">{t(info.descriptionKey)}</p>
                  </div>
                </motion.a>
              ))}
            </div>

            {/* Working Hours */}


          </motion.div>


          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <div className="contact-form-glass liquid-glass glass-noise rounded-3xl p-4 sm:p-6 lg:p-8">
              <h3 className="text-white font-artistic font-tc-optimize mb-6">{t('contact_title')}</h3>

              {isSubmitted ? (
                <motion.div
                  className="text-center py-12"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, type: "spring" }}
                >
                  {/* Success animation */}
                  <motion.div
                    className="relative inline-flex items-center justify-center w-20 h-20 mb-6"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                  >
                    {/* Background halo */}
                    <motion.div
                      className="absolute inset-0 bg-green-500/20 rounded-full"
                      animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.5, 0.2, 0.5]
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    />
                    <motion.div
                      className="relative bg-gradient-to-br from-green-400 to-emerald-500 rounded-full p-4"
                      initial={{ rotate: -180, scale: 0 }}
                      animate={{ rotate: 0, scale: 1 }}
                      transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                    >
                      <CheckCircle className="h-10 w-10 text-white" />
                    </motion.div>
                  </motion.div>

                  <motion.h4
                    className="text-white text-xl font-medium mb-3"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    {t('form_success_title')}
                  </motion.h4>
                  <motion.p
                    className="text-white/70 max-w-sm mx-auto"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    {t('form_success_desc')}
                  </motion.p>

                  {/* Countdown indicator */}
                  <motion.p
                    className="text-white/40 text-sm mt-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                  >
                    {t('form_success_countdown')}
                  </motion.p>
                </motion.div>
              ) : (
                <form ref={formRef} onSubmit={handleSubmit} className="contact-form-fields space-y-4 sm:space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {/* Name input */}
                    <motion.div
                      animate={{
                        scale: focusedField === 'name' ? 1.02 : 1
                      }}
                      transition={{ duration: 0.2 }}
                    >
                      <label className="flex items-center gap-2 text-white/90 mb-2 text-sm font-medium">
                        <User className="w-4 h-4" />
                        {t('form_name')}
                      </label>
                      <input
                        type="text"
                        name="name"
                        autoComplete="name"
                        required
                        value={formData.name}
                        onChange={handleInputChange}
                        onFocus={() => handleFocus('name')}
                        onBlur={handleBlur}
                        className={`w-full px-4 py-3.5 sm:py-3 bg-white/10 border rounded-xl text-white text-base placeholder-white/50 focus:outline-none transition-all duration-300 touch-manipulation ${validationErrors.name
                          ? 'border-red-400/60 focus:border-red-400 focus:ring-2 focus:ring-red-400/20'
                          : focusedField === 'name'
                            ? 'border-white/45 ring-2 ring-white/15'
                            : 'border-white/20 focus:border-white/40 focus:ring-2 focus:ring-white/15'
                          }`}
                        placeholder={t('ph_name')}
                      />
                      <AnimatePresence>
                        {validationErrors.name && (
                          <motion.p
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="text-red-400 text-xs mt-1.5 flex items-center gap-1"
                          >
                            <AlertCircle className="w-3 h-3" />
                            {validationErrors.name}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </motion.div>

                    {/* Phone input */}
                    <motion.div
                      animate={{
                        scale: focusedField === 'phone' ? 1.02 : 1
                      }}
                      transition={{ duration: 0.2 }}
                    >
                      <label className="flex items-center gap-2 text-white/90 mb-2 text-sm font-medium">
                        <Phone className="w-4 h-4" />
                        {t('form_phone')}
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        autoComplete="tel"
                        inputMode="tel"
                        value={formData.phone}
                        onChange={handleInputChange}
                        onFocus={() => handleFocus('phone')}
                        onBlur={handleBlur}
                        className={`w-full px-4 py-3.5 sm:py-3 bg-white/10 border rounded-xl text-white text-base placeholder-white/50 focus:outline-none transition-all duration-300 touch-manipulation ${validationErrors.phone
                          ? 'border-red-400/60 focus:border-red-400 focus:ring-2 focus:ring-red-400/20'
                          : focusedField === 'phone'
                            ? 'border-white/45 ring-2 ring-white/15'
                            : 'border-white/20 focus:border-white/40 focus:ring-2 focus:ring-white/15'
                          }`}
                        placeholder={t('ph_phone')}
                      />
                      <AnimatePresence>
                        {validationErrors.phone && (
                          <motion.p
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="text-red-400 text-xs mt-1.5 flex items-center gap-1"
                          >
                            <AlertCircle className="w-3 h-3" />
                            {validationErrors.phone}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </div>

                  {/* Email input */}
                  <motion.div
                    animate={{
                      scale: focusedField === 'email' ? 1.01 : 1
                    }}
                    transition={{ duration: 0.2 }}
                  >
                    <label className="flex items-center gap-2 text-white/90 mb-2 text-sm font-medium">
                      <Mail className="w-4 h-4" />
                      {t('form_email')}
                    </label>
                    <input
                      type="email"
                      name="email"
                      autoComplete="email"
                      inputMode="email"
                      required
                      value={formData.email}
                      onChange={handleInputChange}
                      onFocus={() => handleFocus('email')}
                      onBlur={handleBlur}
                      className={`w-full px-4 py-3.5 sm:py-3 bg-white/10 border rounded-xl text-white text-base placeholder-white/50 focus:outline-none transition-all duration-300 touch-manipulation ${validationErrors.email
                        ? 'border-red-400/60 focus:border-red-400 focus:ring-2 focus:ring-red-400/20'
                        : focusedField === 'email'
                          ? 'border-white/45 ring-2 ring-white/15'
                          : 'border-white/20 focus:border-white/40 focus:ring-2 focus:ring-white/15'
                        }`}
                      placeholder={t('ph_email')}
                    />
                    <AnimatePresence>
                      {validationErrors.email && (
                        <motion.p
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="text-red-400 text-xs mt-1.5 flex items-center gap-1"
                        >
                          <AlertCircle className="w-3 h-3" />
                          {validationErrors.email}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  {/* Topic selection */}
                  <motion.div
                    animate={{
                      scale: focusedField === 'topic' ? 1.01 : 1
                    }}
                    transition={{ duration: 0.2 }}
                  >
                    <label className="flex items-center gap-2 text-white/90 mb-2 text-sm font-medium">
                      <Sparkles className="w-4 h-4" />
                      {t('form_topic')}
                    </label>
                    <select
                      name="topic"
                      value={formData.topic}
                      autoComplete="off"
                      onChange={handleInputChange}
                      onFocus={() => handleFocus('topic')}
                      onBlur={handleBlur}
                      className={`w-full px-4 py-3.5 sm:py-3 bg-white/10 border rounded-xl text-white text-base focus:outline-none transition-all duration-300 touch-manipulation ${validationErrors.topic
                        ? 'border-red-400/60 focus:border-red-400 focus:ring-2 focus:ring-red-400/20'
                        : focusedField === 'topic'
                          ? 'border-white/45 ring-2 ring-white/15'
                          : 'border-white/20 focus:border-white/40 focus:ring-2 focus:ring-white/15'
                        }`}
                    >
                      <option value="" className="bg-gray-900">{t('form_topic_placeholder')}</option>
                      {topicOptions.map((topic) => (
                        <option key={topic} value={topic} className="bg-gray-900">
                          {t(topic)}
                        </option>
                      ))}
                    </select>
                    <AnimatePresence>
                      {validationErrors.topic && (
                        <motion.p
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="text-red-400 text-xs mt-1.5 flex items-center gap-1"
                        >
                          <AlertCircle className="w-3 h-3" />
                          {validationErrors.topic}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  {/* Message input */}
                  <motion.div
                    animate={{
                      scale: focusedField === 'message' ? 1.01 : 1
                    }}
                    transition={{ duration: 0.2 }}
                  >
                    <label className="flex items-center gap-2 text-white/90 mb-2 text-sm font-medium">
                      <MessageSquare className="w-4 h-4" />
                      {t('form_message')}
                    </label>
                    <textarea
                      name="message"
                      required
                      rows={4}
                      value={formData.message}
                      onChange={handleInputChange}
                      onFocus={() => handleFocus('message')}
                      onBlur={handleBlur}
                      aria-invalid={!!validationErrors.message}
                      className={`w-full px-4 py-3.5 sm:py-3 bg-white/10 border rounded-xl text-white text-base placeholder-white/50 focus:outline-none transition-all duration-300 resize-none touch-manipulation ${validationErrors.message
                        ? 'border-red-400/60 focus:border-red-400 focus:ring-2 focus:ring-red-400/20'
                        : focusedField === 'message'
                          ? 'border-white/45 ring-2 ring-white/15'
                          : 'border-white/20 focus:border-white/40 focus:ring-2 focus:ring-white/15'
                        }`}
                      placeholder={t('ph_message')}
                    />
                    <AnimatePresence>
                      {validationErrors.message && (
                        <motion.p
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="text-red-400 text-xs mt-1.5 flex items-center gap-1"
                        >
                          <AlertCircle className="w-3 h-3" />
                          {validationErrors.message}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  {submitError && (
                    <motion.div
                      className="flex items-center space-x-2 p-4 bg-red-500/20 border border-red-500/30 rounded-2xl text-red-300"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <AlertCircle className="h-5 w-5 flex-shrink-0" />
                      <span className="text-sm">{submitError}</span>
                    </motion.div>
                  )}

                  <motion.div
                    whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
                    whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
                  >
                    <LiquidGlassButton
                      size="lg"
                      className="w-full relative overflow-hidden"
                      type="submit"
                      disabled={isSubmitting}
                    >
                      <AnimatePresence mode="wait">
                        {isSubmitting ? (
                          <motion.div
                            key="loading"
                            className="flex items-center justify-center gap-2"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                          >
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>{t('form_sending')}</span>
                          </motion.div>
                        ) : (
                          <motion.div
                            key="default"
                            className="flex items-center justify-center gap-2"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                          >
                            <Send className="h-5 w-5" />
                            <span>{t('contact_submit')}</span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </LiquidGlassButton>
                  </motion.div>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
