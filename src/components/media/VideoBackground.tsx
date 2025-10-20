import React, { useRef, useState, useEffect, useCallback } from 'react';
const primaryVideo = '/assets/videos/background.mp4';
const primaryMobileVideo = '/assets/videos/background-mobile.mp4';
const secondaryVideo = '/assets/videos/background2.mp4';
const secondaryMobileVideo = '/assets/videos/background2-mobile.mp4';
const backgroundPoster = '/assets/images/background-poster.jpg';

interface VideoBackgroundProps {
  children?: React.ReactNode;
}

export function VideoBackground({ children }: VideoBackgroundProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoRef2 = useRef<HTMLVideoElement | null>(null);
  const [showSecond, setShowSecond] = useState(false);
  const [useStaticBackground, setUseStaticBackground] = useState(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches || !!connection?.saveData;
  });

  const [isSecondVideoLoaded, setIsSecondVideoLoaded] = useState(false);

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMode = () => {
      const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
      setUseStaticBackground(motionQuery.matches || !!connection?.saveData);
    };
    motionQuery.addEventListener?.('change', updateMode);
    return () => motionQuery.removeEventListener?.('change', updateMode);
  }, []);

  // Optimize video loading - load second video only when needed
  useEffect(() => {
    if (videoRef.current) {
      if (!showSecond) {
        videoRef.current.play().catch(() => { });
      } else {
        videoRef.current.pause();
      }
    }
    if (videoRef2.current && isSecondVideoLoaded) {
      if (showSecond) {
        videoRef2.current.play().catch(() => { });
      } else {
        videoRef2.current.pause();
      }
    }
  }, [showSecond, isSecondVideoLoaded]);

  // Use throttling to optimize scroll events
  const throttledScrollHandler = useCallback(() => {
    const trigger = window.innerHeight * 0.8;
    const shouldShowSecond = window.scrollY > trigger;

    if (shouldShowSecond !== showSecond) {
      setShowSecond(shouldShowSecond);

      // Load second video only when needed
      if (shouldShowSecond && !isSecondVideoLoaded) {
        setIsSecondVideoLoaded(true);
      }
    }
  }, [showSecond, isSecondVideoLoaded]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const onScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(throttledScrollHandler, 16); // 60fps
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      clearTimeout(timeoutId);
    };
  }, [throttledScrollHandler]);


  return (
    <div className="relative min-h-screen">
      <div className="fixed inset-0 z-0 overflow-hidden">
        {useStaticBackground ? (
          <div
            className="cinematic-static-background absolute inset-0"
            style={{ backgroundImage: `url("${backgroundPoster}")` }}
            aria-hidden="true"
          />
        ) : <>
        {/* First video */}
        <video
          ref={videoRef}
          className="cinematic-video cinematic-video--primary absolute inset-0 w-full h-full object-cover"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster={backgroundPoster}
          aria-hidden="true"
          onCanPlay={(event) => {
            if (!showSecond) event.currentTarget.play().catch(() => { });
          }}

          style={{ opacity: showSecond ? 0 : 1, transition: 'opacity 1200ms ease-in-out' }}
        >
          <source media="(max-width: 767px)" src={primaryMobileVideo} type="video/mp4" />
          <source src={primaryVideo} type="video/mp4" />
        </video>

        {/* Second video - Lazy load */}
        {isSecondVideoLoaded && (
            <video
              ref={videoRef2}
              className="cinematic-video cinematic-video--secondary absolute inset-0 w-full h-full object-cover"
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              aria-hidden="true"
              onCanPlay={(event) => {
                if (showSecond) event.currentTarget.play().catch(() => { });
              }}
            style={{ opacity: showSecond ? 1 : 0, transition: 'opacity 1200ms ease-in-out' }}
          >
            <source media="(max-width: 767px)" src={secondaryMobileVideo} type="video/mp4" />
            <source src={secondaryVideo} type="video/mp4" />
          </video>
        )}
        </>}

        {/* Cinematic color grade: preserves the footage while creating a stable glass canvas. */}
        <div className="cinematic-video-grade absolute inset-0 pointer-events-none" />
        <div className="cinematic-video-chromatic absolute inset-0 pointer-events-none" />
        <div className="cinematic-video-vignette absolute inset-0 pointer-events-none" />
        <div
          className="cinematic-video-depth absolute inset-0 pointer-events-none"
          style={{
            background: showSecond
              ? 'linear-gradient(180deg, rgba(3,10,12,0.38) 0%, rgba(4,11,13,0.18) 34%, rgba(4,8,10,0.48) 100%)'
              : 'linear-gradient(180deg, rgba(3,8,10,0.50) 0%, rgba(3,9,11,0.16) 48%, rgba(3,7,9,0.32) 100%)'
          }}
        />
        <div className="cinematic-video-grain absolute inset-0 pointer-events-none" />
      </div>


      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
