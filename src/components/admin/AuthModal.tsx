import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Eye, EyeOff, X, AlertCircle, CheckCircle } from 'lucide-react';
import { LiquidGlassButton } from '@/components/common/LiquidGlassButton';
import { useI18n } from '@/i18n';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (password: string) => Promise<void>;
}

export function AuthModal({ isOpen, onClose, onAuthSuccess }: AuthModalProps) {
  const { t } = useI18n();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await onAuthSuccess(password);
      setSuccess(true);
      setTimeout(handleClose, 500);
    } catch (error: any) {
      console.error('Login error:', error);
      setError(error?.code === 'auth/invalid-credential' ? t('auth_password_error') : error?.message || t('auth_login_failed'));
      setSuccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setPassword('');
    setError('');
    setSuccess(false);
    setShowPassword(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <motion.div
      className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal"
      data-scrollable="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={success || isLoading ? undefined : handleClose}
    >
      <motion.div
        className="liquid-glass-dialog rounded-3xl p-8 max-w-md w-full"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title and Close Button */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-red-500/20 to-orange-500/20 rounded-xl">
              <Lock className="w-6 h-6 text-red-400" />
            </div>
            <h2 className="text-2xl font-artistic font-tc-optimize text-white">{t('auth_title')}</h2>
          </div>
          <LiquidGlassButton
            size="sm"
            variant="secondary"
            onClick={handleClose}
            className="p-2 rounded-full"
          >
            <X className="w-5 h-5" />
          </LiquidGlassButton>
        </div>

        {/* Success State */}
        <AnimatePresence>
          {success && (
            <motion.div
              className="flex items-center gap-3 p-4 bg-green-500/20 border border-green-500/30 rounded-xl mb-6"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-green-300">{t('auth_success')}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              className="flex items-center gap-3 p-4 bg-red-500/20 border border-red-500/30 rounded-xl mb-6"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <AlertCircle className="w-5 h-5 text-red-400" />
              <span className="text-red-300">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-white/80 text-sm mb-2">
              {t('auth_password_placeholder')}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth_password_placeholder')}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent"
                disabled={isLoading || success}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white/80 transition-colors"
                disabled={isLoading || success}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <LiquidGlassButton
              type="submit"
              disabled={!password || isLoading || success}
              className="flex-1"
            >
              {isLoading ? (
                <motion.div
                  className="w-5 h-5"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                </motion.div>
              ) : success ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <Lock className="w-5 h-5" />
              )}
              <span className="ml-2">
                {isLoading ? t('auth_submit') + '...' : success ? t('auth_success') : t('auth_submit')}
              </span>
            </LiquidGlassButton>

            <LiquidGlassButton
              type="button"
              onClick={handleClose}
              variant="secondary"
              className="px-6"
              disabled={isLoading || success}
            >
              {t('admin_cancel')}
            </LiquidGlassButton>
          </div>
        </form>

        {/* Hint Info */}
        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <p className="text-blue-300 text-sm text-center">
            🔒 {t('auth_restricted_area')}
          </p>
          <p className="text-blue-400/70 text-xs text-center mt-1">
            {t('auth_contact_admin')}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
