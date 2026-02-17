// src/App.jsx
import { useState, useEffect, useRef, Suspense } from 'react';
import { useTexture } from '@react-three/drei';
import Papa from 'papaparse';
import Experience from './components/Experience';
import gsap from 'gsap';

export default function App() {
  const [allCards, setAllCards] = useState([]);
  const [currentHand, setCurrentHand] = useState([]);
  const [stackCards, setStackCards] = useState([]);
  const [collageCards, setCollageCards] = useState([]);
  const [stackCycles, setStackCycles] = useState(0);
  const [stackAnimating, setStackAnimating] = useState(false);
  const [stackAnimProgress, setStackAnimProgress] = useState(0);
  const [phaseBlend, setPhaseBlend] = useState(0);
  const [movingCard, setMovingCard] = useState(null);
  const [movingToIndex, setMovingToIndex] = useState(-1);
  const [status, setStatus] = useState('loading');
  const [isPackVisible, setIsPackVisible] = useState(false);
  const [texturesLoaded, setTexturesLoaded] = useState(false);
  
  // Refs for pack animation
  const topRef = useRef();
  const bottomRef = useRef();
  const topMaterialRef = useRef();
  const bottomMaterialRef = useRef();
  const hasLoggedHeaders = useRef(false);
  const clickTextRef = useRef(null);
  const stackTweenRef = useRef(null);
  const phaseTweenRef = useRef(null);

  const stopStackTween = () => {
    stackTweenRef.current?.kill();
    stackTweenRef.current = null;
  };

  const stopPhaseTween = () => {
    phaseTweenRef.current?.kill();
    phaseTweenRef.current = null;
  };

  const toProxyUrl = (url) => {
    if (!url || typeof url !== 'string') return url;
    const bucketBase = 'https://ocs-production-public-images.s3.amazonaws.com';
    const bucketHost = 'ocs-production-public-images.s3.amazonaws.com';

    const normalizeImagePath = (value) =>
      value
        .replace(/^\/+/, '')
        .replace(/^(images\/)+/, '');

    const toDevOrProdUrl = (normalizedPath, search = '') => {
      if (import.meta.env.DEV) {
        return `/images/${normalizedPath}${search}`;
      }
      return `${bucketBase}/images/${normalizedPath}${search}`;
    };

    if (url.startsWith('/')) {
      return toDevOrProdUrl(normalizeImagePath(url));
    }
    try {
      const u = new URL(url);
      if (u.hostname === bucketHost) {
        return toDevOrProdUrl(normalizeImagePath(u.pathname), u.search);
      }
    } catch {
      // fall through
    }
    return url;
  };

  const normalizeCard = (row, headers) => {
    if (!row || typeof row !== 'object') return null;
    const keys = headers && headers.length > 0 ? headers : Object.keys(row);
    const urlKeys = keys.filter((k) => /url/i.test(k));
    const frontKeys = keys.filter((k) => /front/i.test(k));
    const backKeys = keys.filter((k) => /back/i.test(k));

    const frontKey =
      frontKeys.find((k) => /url/i.test(k)) ||
      frontKeys[0] ||
      urlKeys[0];
    const backKey =
      backKeys.find((k) => /url/i.test(k)) ||
      backKeys[0] ||
      urlKeys[1];

    const rawFront = frontKey ? String(row[frontKey] || '').trim() : '';
    const rawBack = backKey ? String(row[backKey] || '').trim() : '';
    const front = rawFront ? toProxyUrl(rawFront) : null;
    const back = rawBack ? toProxyUrl(rawBack) : null;

    if (!front || !back) return null;
    return {
      ...row,
      card_id: row.card_id || row.id || row.cardId || row.name || 'unknown',
      url_front_original: rawFront,
      url_back_original: rawBack,
      url_front_preprocessed: front,
      url_back_preprocessed: back
    };
  };

  useEffect(() => {
    console.log('Loading CSV...');
    fetch('/adam_pokemon_render.csv')
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then(csvText => {
        if (!csvText) return;
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            console.log('CSV loaded:', results.data.length, 'cards');
            const headers = results.meta?.fields || [];
            const hasExpectedHeader = headers.some((h) => /url|front/i.test(h));
            if (!hasExpectedHeader) {
              console.error('CSV headers missing expected url/front fields.');
              if (!hasLoggedHeaders.current) {
                console.log(
                  'Available CSV headers:',
                  headers.length ? headers : Object.keys(results.data[0] || {})
                );
                hasLoggedHeaders.current = true;
              }
              setStatus('error');
              setIsPackVisible(false);
              setTexturesLoaded(false);
              return;
            }
            const normalized = results.data
              .map((row) => normalizeCard(row, headers))
              .filter(Boolean);
            if (normalized.length > 0) {
              setAllCards(normalized);
              pickNewHand(normalized);
            } else {
              console.error('No valid cards found in CSV (missing URLs).');
              if (!hasLoggedHeaders.current) {
                console.log(
                  'Available CSV headers:',
                  headers.length ? headers : Object.keys(results.data[0] || {})
                );
                hasLoggedHeaders.current = true;
              }
              setStatus('error');
              setIsPackVisible(false);
              setTexturesLoaded(false);
            }
          },
          error: (error) => console.error('CSV error:', error)
        });
      })
      .catch(err => {
        console.error('Failed to load CSV:', err);
        setStatus('error');
        setIsPackVisible(false);
        setTexturesLoaded(false);
      });
  }, []);

  const pickNewHand = async (cards) => {
    console.log('Picking 5 random cards...');
    setTexturesLoaded(false);
    setStatus('loading');
    setIsPackVisible(false);
    
    const validCards = (cards || []).filter(
      (card) =>
        (card?.url_front_preprocessed || card?.url_front_original) &&
        (card?.url_back_preprocessed || card?.url_back_original)
    );
    if (validCards.length === 0) {
      console.error('No valid cards available for selection.');
      setStatus('error');
      setIsPackVisible(false);
      setTexturesLoaded(false);
      return;
    }
    const shuffled = [...validCards].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.min(5, shuffled.length));
    
    console.log('Selected:', selected.map(c => c.card_id));
    setCurrentHand(selected);
    setStackCards(selected);
    setCollageCards([]);
    setStackCycles(0);
    setStackAnimating(false);
    setStackAnimProgress(0);
    setPhaseBlend(0);
    setMovingCard(null);
    setMovingToIndex(-1);
    stopStackTween();
    stopPhaseTween();
    
    console.log('Preloading textures...');
    const preloadPromises = selected.flatMap(card => [
      useTexture.preload(card.url_front_preprocessed || card.url_front_original),
      useTexture.preload(card.url_back_preprocessed || card.url_back_original)
    ]);

    try {
      await Promise.all(preloadPromises);
      console.log('Textures preloaded');
      setTexturesLoaded(true);
      setIsPackVisible(true);
      setStatus('pack');
    } catch (err) {
      console.error('Preload error:', err);
      setTexturesLoaded(true);
      setIsPackVisible(true);
      setStatus('pack');
    }
  };

  const handlePackAnimationComplete = () => {
    console.log('Pack animation complete - showing stack interaction');
    setIsPackVisible(false);
    setStatus('stacked');
  };

  const handleCycleTopCard = () => {
    if (status !== 'stacked' || stackAnimating || stackCards.length === 0) {
      return;
    }
    const topCard = stackCards[0];
    const targetCollageIndex = collageCards.length;
    setStackAnimating(true);
    setStackAnimProgress(0);
    setMovingCard(topCard);
    setMovingToIndex(targetCollageIndex);

    stopStackTween();
    const motion = { t: 0 };
    stackTweenRef.current = gsap.to(motion, {
      t: 1,
      duration: 0.95,
      ease: 'sine.inOut',
      onUpdate: () => {
        setStackAnimProgress(motion.t);
      },
      onComplete: () => {
        setStackCards((prev) => prev.slice(1));
        setCollageCards((prev) => [...prev, topCard]);
        setStackCycles((prev) => prev + 1);
        setStackAnimProgress(0);
        setMovingCard(null);
        setMovingToIndex(-1);
        setStackAnimating(false);
        stackTweenRef.current = null;
      }
    });
  };

  const startPhaseTransition = () => {
    if (status !== 'stacked') return;
    stopPhaseTween();
    setStatus('transitioning');
    setPhaseBlend(0);
    const motion = { t: 0 };
    phaseTweenRef.current = gsap.to(motion, {
      t: 1,
      duration: 1.1,
      ease: 'sine.inOut',
      onUpdate: () => {
        setPhaseBlend(motion.t);
      },
      onComplete: () => {
        setPhaseBlend(1);
        setStatus('revealed');
        phaseTweenRef.current = null;
      }
    });
  };

  useEffect(() => {
    if (
      status === 'stacked' &&
      currentHand.length > 0 &&
      stackCycles >= currentHand.length
    ) {
      startPhaseTransition();
    }
  }, [status, stackCycles, currentHand.length]);

  useEffect(() => {
    if (status !== 'pack' || !clickTextRef.current) return;
    const tween = gsap.to(clickTextRef.current, {
      scale: 1.1,
      repeat: -1,
      yoyo: true
    });
    return () => tween.kill();
  }, [status]);

  useEffect(() => {
    return () => {
      stopStackTween();
      stopPhaseTween();
    };
  }, []);

  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      position: 'relative', 
      background: '#0a0a0a',
      overflow: 'hidden'
    }}>
      <Suspense fallback={null}>
        <Experience
          cards={currentHand}
          stackCards={stackCards}
          collageCards={collageCards}
          movingCard={movingCard}
          movingToIndex={movingToIndex}
          stackAnimProgress={stackAnimProgress}
          stackAnimating={stackAnimating}
          phaseBlend={phaseBlend}
          status={status}
          isPackVisible={isPackVisible}
          texturesLoaded={texturesLoaded}
          topRef={topRef}
          bottomRef={bottomRef}
          topMaterialRef={topMaterialRef}
          bottomMaterialRef={bottomMaterialRef}
          onPackAnimationComplete={handlePackAnimationComplete}
          onCycleTopCard={handleCycleTopCard}
        />
      </Suspense>

      {/* Pack Ready Overlay */}
      {status === 'pack' && (
        <h1
          ref={clickTextRef}
          style={{
            position: 'absolute',
            bottom: '32px',
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center',
            pointerEvents: 'none',
            zIndex: 10,
            fontSize: '5rem',
            fontWeight: '900',
            color: '#fff',
            margin: 0,
            fontFamily: 'system-ui',
            letterSpacing: '0.18em',
            textTransform: 'uppercase'
          }}
        >
          CLICK TO OPEN
        </h1>
      )}
    </div>
  );
}
