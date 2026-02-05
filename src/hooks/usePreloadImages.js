// hooks/usePreloadImages.js
import { useState, useEffect } from 'react';

export function usePreloadImages(urls) {
  const [loadedCount, setLoadedCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!urls || urls.length === 0) {
      setIsComplete(true);
      return;
    }

    let mounted = true;
    let loaded = 0;

    const preloadImage = (url) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          if (mounted) {
            loaded++;
            setLoadedCount(loaded);
          }
          resolve();
        };
        img.onerror = () => {
          if (mounted) {
            loaded++;
            setLoadedCount(loaded);
          }
          resolve(); // Still resolve to not block other images
        };
        img.src = url;
      });
    };

    Promise.all(urls.map(preloadImage)).then(() => {
      if (mounted) {
        setIsComplete(true);
      }
    });

    return () => {
      mounted = false;
    };
  }, [urls]);

  return {
    loadedCount,
    totalCount: urls?.length || 0,
    isComplete,
    progress: urls?.length ? (loadedCount / urls.length) * 100 : 0
  };
}