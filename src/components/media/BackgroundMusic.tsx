import { useRef, useEffect, useState } from 'react';
import { Play, Pause } from 'lucide-react';

interface BackgroundMusicProps {
  isVisible?: boolean;
}

export function BackgroundMusic({ isVisible = true }: BackgroundMusicProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume] = useState(0.10); // Fixed volume 10%

  // Initialize audio
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.loop = true;
      audioRef.current.preload = 'metadata';
    }
  }, [volume]);

  // Resume only when the visitor explicitly enabled music on a previous visit.
  useEffect(() => {
    if (localStorage.getItem('lien-music-enabled') !== '1') return;
    audioRef.current?.play().then(() => setIsPlaying(true)).catch(() => {
      localStorage.removeItem('lien-music-enabled');
    });
  }, []);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
        localStorage.setItem('lien-music-enabled', '0');
      } else {
        audioRef.current.play()
          .then(() => {
            setIsPlaying(true);
            localStorage.setItem('lien-music-enabled', '1');
          })
          .catch((error) => {
            console.error('Play failed:', error);
          });
      }
    }
  };


  if (!isVisible) return null;

  return (
    <>
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src="/assets/videos/Pray-128.mp3"
        loop
        preload="metadata"
        onLoadedData={() => {
          if (audioRef.current) {
            audioRef.current.volume = volume;
          }
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onError={(e) => {
          console.error('Audio load failed:', e);
        }}
      />


      {/* Music control button */}
      <div className="music-control-wrap fixed bottom-6 right-6 z-50 flex items-center space-x-2 pointer-events-auto">
        {/* Play/Pause button */}
        <button
          onClick={togglePlay}
          className="floating-glass-control w-12 h-12 rounded-full liquid-glass-dark liquid-glass-interactive flex items-center justify-center text-foreground"
          title={isPlaying ? "Pause Music" : "Play Music"}
          aria-label={isPlaying ? "Pause Music" : "Play Music"}
        >
          {isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5 ml-0.5" />
          )}
        </button>
      </div>
    </>
  );
}
