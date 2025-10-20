import { useEffect, useRef, useState } from 'react';

type ScrollScene = {
  title: string;
  eyebrow: string;
  body: string;
  align: 'left' | 'right';
};

const scenes: ScrollScene[] = [
  {
    eyebrow: 'LIEN · PHOTOGRAPHY',
    title: '光影之旅',
    body: '鏡頭捕捉瞬間的永恆，每一張照片都在訴說故事，而每個故事都值得珍藏。',
    align: 'left',
  },
  {
    eyebrow: 'LANDSCAPE · 01',
    title: '風景',
    body: '從街頭的偶然相遇到大自然的壯麗景色，保存旅途中稍縱即逝的光。',
    align: 'right',
  },
  {
    eyebrow: 'ECOLOGY · 02',
    title: '生態',
    body: '在潮汐、暮色與草木之間，記錄生命安靜而真實的樣貌。',
    align: 'left',
  },
  {
    eyebrow: 'ARCHITECTURE · 03',
    title: '建築',
    body: '讓線條、尺度與光影說話，看見空間裡被時間留下的痕跡。',
    align: 'right',
  },
  {
    eyebrow: 'MOTION · 04',
    title: '人物與動態',
    body: '我喜歡用攝影來說故事，也珍惜人物最自然、最真實的情感。',
    align: 'left',
  },
  {
    eyebrow: 'LIEN ARCHIVE · 05',
    title: '作品與故事',
    body: '每一張照片都承載著情感與獨特的故事，邀請你繼續走進我的作品。',
    align: 'right',
  },
];

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smoothstep = (from: number, to: number, value: number) => {
  const x = clamp((value - from) / (to - from));
  return x * x * (3 - 2 * x);
};

function scrollToPortfolio() {
  document.getElementById('portfolio')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function MobileScrollWorld() {
  const rootRef = useRef<HTMLDivElement>(null);
  const journeyVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRefs = useRef<Array<HTMLDivElement | null>>([]);
  const copyRefs = useRef<Array<HTMLElement | null>>([]);
  const frameRef = useRef<number | null>(null);
  const [activeScene, setActiveScene] = useState(0);
  const [isStatic, setIsStatic] = useState(false);
  const [isVideoPainted, setIsVideoPainted] = useState(false);

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const staticMode = motionQuery.matches || !!connection?.saveData;
    setIsStatic(staticMode);
    setIsVideoPainted(false);

    const video = journeyVideoRef.current;
    const abortController = new AbortController();
    let objectUrl: string | null = null;
    let seekFrame = 0;
    let lastSeekAt = 0;
    let targetTime = 0;
    let videoReady = false;
    let videoPainted = false;
    let userReady = false;
    let disposed = false;
    let laidOutWidth = window.innerWidth;

    const revealPaintedFrame = () => {
      if (videoPainted || disposed || !video) return;
      const paintableVideo = video as HTMLVideoElement & {
        requestVideoFrameCallback?: (callback: () => void) => number;
      };
      const reveal = () => {
        if (videoPainted || disposed) return;
        videoPainted = true;
        setIsVideoPainted(true);
      };
      if (paintableVideo.requestVideoFrameCallback) {
        paintableVideo.requestVideoFrameCallback(reveal);
        window.setTimeout(reveal, 120);
      } else {
        window.requestAnimationFrame(reveal);
      }
    };

    const primeVideo = () => {
      if (!video || !videoReady || disposed) return;
      try {
        const playPromise = video.play();
        if (playPromise) {
          playPromise
            .then(() => {
              try { video.pause(); } catch { /* Safari may already be paused. */ }
            })
            .catch(() => { /* iOS will retry after the next user gesture. */ });
        }
      } catch { /* Keep the poster visible if playback is not yet allowed. */ }
    };

    const onFirstGesture = () => {
      if (userReady) return;
      userReady = true;
      primeVideo();
    };

    const onLoadedMetadata = () => {
      if (!video) return;
      videoReady = Number.isFinite(video.duration) && video.duration > 0;
      if (videoReady) targetTime = clamp(targetTime, 0, video.duration - 0.001);
      if (userReady) primeVideo();
      requestUpdate();
    };

    const onLoadedData = () => {
      if (userReady) primeVideo();
    };

    const onSeeked = () => revealPaintedFrame();

    const update = () => {
      frameRef.current = null;
      const root = rootRef.current;
      if (!root) return;

      const rootTop = window.scrollY + root.getBoundingClientRect().top;
      const scrollRange = Math.max(1, root.offsetHeight - window.innerHeight);
      const progress = clamp((window.scrollY - rootTop) / scrollRange);
      const scenePosition = progress * scenes.length;
      const index = Math.min(scenes.length - 1, Math.floor(scenePosition));
      const localProgress = clamp(scenePosition - index);
      const blend = smoothstep(0.86, 1, localProgress);
      const exitProgress = smoothstep(0.925, 0.995, progress);

      root.style.setProperty('--world-progress', String(progress));
      root.style.setProperty('--world-rail-shift', `${(1 - progress) * -100}%`);
      root.style.setProperty('--world-curtain', String(exitProgress * 0.86));
      root.style.setProperty('--world-media-scale', String(1 + exitProgress * 0.045));
      root.style.setProperty('--world-media-opacity', String(1 - exitProgress * 0.28));
      root.style.setProperty('--world-chrome-opacity', String(1 - exitProgress));
      setActiveScene(previous => (previous === index ? previous : index));

      if (!staticMode && videoReady && video) {
        targetTime = clamp(progress, 0, 0.999) * video.duration;
      }

      mediaRefs.current.forEach((media, mediaIndex) => {
        if (!media) return;
        let opacity = 0;
        if (mediaIndex === index) opacity = 1 - blend;
        if (mediaIndex === index + 1) opacity = blend;
        if (index === scenes.length - 1 && mediaIndex === index) opacity = 1;
        media.style.opacity = String(opacity);
        media.style.visibility = opacity > 0.002 ? 'visible' : 'hidden';
      });

      copyRefs.current.forEach((copy, copyIndex) => {
        if (!copy) return;
        const entrance = copyIndex === 0 && index === 0
          ? 1
          : smoothstep(0.03, 0.18, localProgress);
        const visible = copyIndex === index
          ? entrance * (1 - smoothstep(0.72, 0.94, localProgress))
          : 0;
        const lastSceneBase = copyIndex === scenes.length - 1 && index === scenes.length - 1
          ? smoothstep(0.03, 0.18, localProgress)
          : visible;
        const lastSceneHold = lastSceneBase * (1 - exitProgress);
        copy.style.opacity = String(lastSceneHold);
        copy.style.transform = `translate3d(0, ${(1 - lastSceneHold) * 18 - exitProgress * 14}px, 0)`;
        copy.style.pointerEvents = lastSceneHold > 0.6 ? 'auto' : 'none';
      });

    };

    const requestUpdate = () => {
      if (frameRef.current === null) frameRef.current = window.requestAnimationFrame(update);
    };

    const seekLoop = (now: number) => {
      if (disposed) return;
      if (!staticMode && video && videoReady && !video.seeking && now - lastSeekAt >= 50) {
        const difference = Math.abs(video.currentTime - targetTime);
        if (difference > 0.035) {
          try {
            video.currentTime = targetTime;
            lastSeekAt = now;
          } catch { /* The poster remains visible until the decoder is ready. */ }
        }
      }
      seekFrame = window.requestAnimationFrame(seekLoop);
    };

    const onResize = () => {
      // iOS changes only the viewport height while its URL bar collapses. Treating
      // that as a new layout makes scroll progress jump and repeatedly re-seeks.
      if (window.innerWidth === laidOutWidth) return;
      laidOutWidth = window.innerWidth;
      requestUpdate();
    };

    if (!staticMode && video) {
      video.addEventListener('loadedmetadata', onLoadedMetadata);
      video.addEventListener('loadeddata', onLoadedData);
      video.addEventListener('seeked', onSeeked);
      fetch('/assets/scroll-world/mobile/journey.mp4', { signal: abortController.signal })
        .then(response => response.ok ? response.blob() : Promise.reject(new Error('Unable to load journey video')))
        .then(blob => {
          if (disposed) return;
          objectUrl = URL.createObjectURL(blob);
          video.src = objectUrl;
          video.load();
        })
        .catch(() => { /* Posters are the deliberate no-video fallback. */ });
    }

    window.addEventListener('pointerdown', onFirstGesture, { passive: true });
    window.addEventListener('touchstart', onFirstGesture, { passive: true });
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', onResize);
    motionQuery.addEventListener?.('change', requestUpdate);
    requestUpdate();
    seekFrame = window.requestAnimationFrame(seekLoop);

    return () => {
      disposed = true;
      abortController.abort();
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      window.cancelAnimationFrame(seekFrame);
      if (video) {
        video.removeEventListener('loadedmetadata', onLoadedMetadata);
        video.removeEventListener('loadeddata', onLoadedData);
        video.removeEventListener('seeked', onSeeked);
        try { video.pause(); } catch { /* Already stopped. */ }
        video.removeAttribute('src');
        video.load();
      }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      window.removeEventListener('pointerdown', onFirstGesture);
      window.removeEventListener('touchstart', onFirstGesture);
      window.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', onResize);
      motionQuery.removeEventListener?.('change', requestUpdate);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      id="home"
      className={`mobile-scroll-world ${isStatic ? 'is-static' : ''}`}
      aria-label="LIEN 攝影場景之旅"
    >
      <div className="mobile-scroll-world__stage">
        <div className="mobile-scroll-world__media" aria-hidden="true">
          {scenes.map((scene, index) => {
            const number = String(index + 1).padStart(2, '0');
            return (
              <div
                key={scene.title}
                ref={element => { mediaRefs.current[index] = element; }}
                className="mobile-scroll-world__scene-media"
              >
                <img
                  src={`/assets/scroll-world/mobile/scene-${number}.jpg`}
                  alt=""
                  decoding="async"
                  loading={index === 0 ? 'eager' : 'lazy'}
                />
              </div>
            );
          })}
          {!isStatic && (
            <video
              ref={journeyVideoRef}
              className={`mobile-scroll-world__journey-video ${isVideoPainted ? 'is-painted' : ''}`}
              muted
              playsInline
              preload="none"
              poster="/assets/scroll-world/mobile/scene-01.jpg"
              tabIndex={-1}
            />
          )}
        </div>

        <div className="mobile-scroll-world__grade" aria-hidden="true" />
        <div className="mobile-scroll-world__curtain" aria-hidden="true" />

        <div className="mobile-scroll-world__rail" aria-hidden="true">
          <span>{String(activeScene + 1).padStart(2, '0')}</span>
          <i />
          <span>{String(scenes.length).padStart(2, '0')}</span>
        </div>

        {scenes.map((scene, index) => (
          <article
            key={scene.title}
            ref={element => { copyRefs.current[index] = element; }}
            className={`mobile-scroll-world__copy is-${scene.align}`}
            aria-hidden={activeScene !== index}
          >
            <p className="mobile-scroll-world__eyebrow">{scene.eyebrow}</p>
            <h1 className="mobile-scroll-world__title font-tc-optimize">{scene.title}</h1>
            <p className="mobile-scroll-world__body font-tc-optimize">{scene.body}</p>

            {index === 0 && (
              <div className="mobile-scroll-world__actions">
                <button type="button" className="mobile-scroll-world__button" onClick={scrollToPortfolio}>
                  探索作品 <span aria-hidden="true">→</span>
                </button>
                <a href="#contact" className="mobile-scroll-world__text-link">合作邀約</a>
              </div>
            )}

            {index === scenes.length - 1 && (
              <button type="button" className="mobile-scroll-world__button" onClick={scrollToPortfolio}>
                進入作品總覽 <span aria-hidden="true">→</span>
              </button>
            )}
          </article>
        ))}

        <div className="mobile-scroll-world__scroll-cue" aria-hidden="true">
          <span>向下捲動</span>
          <i />
        </div>
      </div>
    </div>
  );
}
