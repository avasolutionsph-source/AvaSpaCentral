/**
 * OptimizedImage Component
 *
 * Provides lazy loading, WebP support with fallback, and loading states.
 * - Uses native lazy loading for better performance
 * - Shows skeleton placeholder while loading
 * - Handles error states gracefully
 * - Supports both static assets and dynamic URLs
 */

import React, { useState, useRef, useEffect } from 'react';

const OptimizedImage = ({
  src,
  webpSrc,
  alt,
  width,
  height,
  className = '',
  placeholderColor = '#e5e7eb',
  onLoad,
  onError,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef(null);

  // Use Intersection Observer for lazy loading (fallback for browsers without native support)
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '50px', // Start loading 50px before entering viewport
        threshold: 0.01
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleLoad = (e) => {
    setIsLoaded(true);
    onLoad?.(e);
  };

  const handleError = (e) => {
    setHasError(true);
    onError?.(e);
  };

  // Determine if we should show the image
  const shouldLoadImage = isInView && src;

  // Container styles for placeholder
  const containerStyle = {
    position: 'relative',
    width: width || '100%',
    height: height || 'auto',
    backgroundColor: !isLoaded && !hasError ? placeholderColor : 'transparent',
    overflow: 'hidden',
  };

  // Placeholder skeleton styles
  const skeletonStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: `linear-gradient(90deg, ${placeholderColor} 25%, #f3f4f6 50%, ${placeholderColor} 75%)`,
    backgroundSize: '200% 100%',
    animation: isLoaded || hasError ? 'none' : 'shimmer 1.5s infinite',
  };

  // Image styles
  const imgStyle = {
    opacity: isLoaded ? 1 : 0,
    transition: 'opacity 0.3s ease-in-out',
    width: '100%',
    height: '100%',
    objectFit: props.objectFit || 'cover',
  };

  // Error state UI
  if (hasError) {
    return (
      <div
        ref={imgRef}
        className={`optimized-image optimized-image-error ${className}`}
        style={{
          ...containerStyle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f3f4f6',
          color: '#9ca3af',
          fontSize: '12px',
        }}
        role="img"
        aria-label={alt || 'Image failed to load'}
      >
        <span>📷</span>
      </div>
    );
  }

  return (
    <div
      ref={imgRef}
      className={`optimized-image ${className}`}
      style={containerStyle}
    >
      {/* Skeleton placeholder */}
      {!isLoaded && <div className="optimized-image-skeleton" style={skeletonStyle} />}

      {/* Picture element for WebP with fallback */}
      {shouldLoadImage && (
        <picture>
          {webpSrc && <source srcSet={webpSrc} type="image/webp" />}
          <img
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            onLoad={handleLoad}
            onError={handleError}
            style={imgStyle}
            width={width}
            height={height}
            {...props}
          />
        </picture>
      )}
    </div>
  );
};

/**
 * Simple lazy image without container wrapper
 * Use this for inline images that don't need skeleton loading
 */
export const LazyImage = ({ src, alt, className = '', ...props }) => (
  <img
    src={src}
    alt={alt}
    loading="lazy"
    decoding="async"
    className={className}
    {...props}
  />
);

export default OptimizedImage;
