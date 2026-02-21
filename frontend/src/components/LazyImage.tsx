import React, { useRef, useState, useEffect } from 'react';

interface LazyImageProps {
  src: string | undefined;
  alt?: string;
  width?: number | string;
  height?: number | string;
  style?: React.CSSProperties;
  className?: string;
  fallback?: string;
  borderRadius?: number | string;
  objectFit?: 'cover' | 'contain' | 'fill';
}

const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt = '',
  width,
  height,
  style,
  className,
  fallback,
  borderRadius,
  objectFit = 'cover',
}) => {
  const imgRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' } // preload 200px before visible
    );

    observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, []);

  const containerStyle: React.CSSProperties = {
    width,
    height,
    borderRadius,
    overflow: 'hidden',
    display: 'inline-block',
    position: 'relative',
    backgroundColor: 'rgba(128,128,128,0.1)',
    ...style,
  };

  const imgStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit,
    opacity: loaded ? 1 : 0,
    transition: 'opacity 0.3s ease',
  };

  const placeholderStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, rgba(102,126,234,0.1), rgba(240,147,251,0.1))',
    opacity: loaded ? 0 : 1,
    transition: 'opacity 0.3s ease',
    pointerEvents: 'none',
  };

  const displaySrc = error ? fallback : src;

  return (
    <div ref={imgRef} style={containerStyle} className={className}>
      <div style={placeholderStyle}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(128,128,128,0.4)" strokeWidth="1.5">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      </div>
      {isVisible && displaySrc && (
        <img
          src={displaySrc}
          alt={alt}
          style={imgStyle}
          onLoad={() => setLoaded(true)}
          onError={() => { setError(true); setLoaded(true); }}
        />
      )}
    </div>
  );
};

export default LazyImage;

