import { useEffect, useState } from 'react';

interface PerformanceMetrics {
  fcp: number; // First Contentful Paint
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  ttfb: number; // Time to First Byte
}

export function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show performance monitor in development environment
    if (process.env.NODE_ENV !== 'development') return;

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();

      entries.forEach((entry) => {
        if (entry.entryType === 'paint') {
          if (entry.name === 'first-contentful-paint') {
            setMetrics(prev => ({
              ...prev,
              fcp: Math.round(entry.startTime)
            } as PerformanceMetrics));
          }
        }

        if (entry.entryType === 'largest-contentful-paint') {
          setMetrics(prev => ({
            ...prev,
            lcp: Math.round(entry.startTime)
          } as PerformanceMetrics));
        }

        if (entry.entryType === 'first-input') {
          setMetrics(prev => ({
            ...prev,
            fid: Math.round((entry as any).processingStart - entry.startTime)
          } as PerformanceMetrics));
        }

        if (entry.entryType === 'layout-shift') {
          if (!(entry as any).hadRecentInput) {
            setMetrics(prev => ({
              ...prev,
              cls: (prev?.cls || 0) + (entry as any).value
            } as PerformanceMetrics));
          }
        }
      });
    });

    // Monitor various performance metrics
    observer.observe({ entryTypes: ['paint', 'largest-contentful-paint', 'first-input', 'layout-shift'] });

    // Get TTFB
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigation) {
      setMetrics(prev => ({
        ...prev,
        ttfb: Math.round(navigation.responseStart - navigation.requestStart)
      } as PerformanceMetrics));
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  // Keyboard shortcut to toggle performance monitor
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        setIsVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  if (!isVisible || !metrics) return null;

  const getScoreColor = (value: number, thresholds: { good: number; poor: number }) => {
    if (value <= thresholds.good) return 'text-green-400';
    if (value <= thresholds.poor) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 backdrop-blur-sm text-white p-4 rounded-lg text-xs font-mono z-50 max-w-xs">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold">Performance Monitor</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-white/60 hover:text-white"
        >
          ×
        </button>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between">
          <span>FCP:</span>
          <span className={getScoreColor(metrics.fcp, { good: 1800, poor: 3000 })}>
            {metrics.fcp}ms
          </span>
        </div>

        <div className="flex justify-between">
          <span>LCP:</span>
          <span className={getScoreColor(metrics.lcp, { good: 2500, poor: 4000 })}>
            {metrics.lcp}ms
          </span>
        </div>

        <div className="flex justify-between">
          <span>FID:</span>
          <span className={getScoreColor(metrics.fid, { good: 100, poor: 300 })}>
            {metrics.fid}ms
          </span>
        </div>

        <div className="flex justify-between">
          <span>CLS:</span>
          <span className={getScoreColor(metrics.cls * 1000, { good: 100, poor: 250 })}>
            {(metrics.cls * 1000).toFixed(2)}
          </span>
        </div>

        <div className="flex justify-between">
          <span>TTFB:</span>
          <span className={getScoreColor(metrics.ttfb, { good: 800, poor: 1800 })}>
            {metrics.ttfb}ms
          </span>
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-white/20 text-xs text-white/60">
        Press Ctrl+Shift+P to toggle
      </div>
    </div>
  );
}
