import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useTexture } from '@react-three/drei';
import Papa from 'papaparse';
import gsap from 'gsap';
import Experience from './components/Experience';

const DEFAULT_CSV_URL = '/adam_pokemon_render.csv';
const DEFAULT_PACK_TEXTURE_URL = '/gradient_pack-removebg-preview.png';
const DEFAULT_LOCAL_IMAGE_BASE = '/images';
const DEFAULT_REMOTE_IMAGE_BASE = 'https://ocs-production-public-images.s3.amazonaws.com/images';
const DEFAULT_REMAP_SOURCE_HOST = 'ocs-production-public-images.s3.amazonaws.com';

function normalizeImagePath(value) {
  return String(value || '')
    .replace(/^\/+/, '')
    .replace(/^(images\/)+/, '');
}

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function buildImageUrl(base, normalizedPath, search = '') {
  return `${trimTrailingSlash(base)}/${normalizedPath}${search || ''}`;
}

function shouldUseLocalBase(forceLocalImageBase) {
  if (typeof forceLocalImageBase === 'boolean') return forceLocalImageBase;
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

export default function PackOpener({
  csvUrl = DEFAULT_CSV_URL,
  packTextureUrl = DEFAULT_PACK_TEXTURE_URL,
  localImageBase = DEFAULT_LOCAL_IMAGE_BASE,
  remoteImageBase = DEFAULT_REMOTE_IMAGE_BASE,
  remapSourceHost = DEFAULT_REMAP_SOURCE_HOST,
  forceLocalImageBase = undefined,
  handSize = 5,
  className,
  style
}) {
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
  const [cursor, setCursor] = useState('default');

  const topRef = useRef();
  const bottomRef = useRef();
  const topMaterialRef = useRef();
  const bottomMaterialRef = useRef();
  const hasLoggedHeaders = useRef(false);
  const clickTextRef = useRef(null);
  const stackTweenRef = useRef(null);
  const phaseTweenRef = useRef(null);

  const resolvedHandSize = useMemo(() => {
    const numericHandSize = Number(handSize);
    if (!Number.isFinite(numericHandSize)) return 5;
    return Math.max(1, Math.floor(numericHandSize));
  }, [handSize]);

  const resolvedImageBase = useMemo(() => {
    return shouldUseLocalBase(forceLocalImageBase) ? localImageBase : remoteImageBase;
  }, [forceLocalImageBase, localImageBase, remoteImageBase]);

  const setCursorSafe = useCallback((value) => {
    setCursor((prev) => (prev === value ? prev : value));
  }, []);

  const stopStackTween = useCallback(() => {
    stackTweenRef.current?.kill();
    stackTweenRef.current = null;
  }, []);

  const stopPhaseTween = useCallback(() => {
    phaseTweenRef.current?.kill();
    phaseTweenRef.current = null;
  }, []);

  const toProxyUrl = useCallback((url) => {
    if (!url || typeof url !== 'string') return url;

    const normalizedFromPath = (rawPath) => normalizeImagePath(rawPath);

    if (url.startsWith('/')) {
      return buildImageUrl(resolvedImageBase, normalizedFromPath(url));
    }

    try {
      const parsed = new URL(url);
      if (remapSourceHost && parsed.hostname === remapSourceHost) {
        return buildImageUrl(resolvedImageBase, normalizedFromPath(parsed.pathname), parsed.search);
      }
    } catch {
      // not a parseable URL
    }

    return url;
  }, [resolvedImageBase, remapSourceHost]);

  const normalizeCard = useCallback((row, headers) => {
    if (!row || typeof row !== 'object') return null;

    const keys = headers && headers.length > 0 ? headers : Object.keys(row);
    const urlKeys = keys.filter((k) => /url/i.test(k));
    const frontKeys = keys.filter((k) => /front/i.test(k));
    const backKeys = keys.filter((k) => /back/i.test(k));

    const frontKey = frontKeys.find((k) => /url/i.test(k)) || frontKeys[0] || urlKeys[0];
    const backKey = backKeys.find((k) => /url/i.test(k)) || backKeys[0] || urlKeys[1];

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
  }, [toProxyUrl]);

  const pickNewHand = useCallback(async (cards) => {
    setCursorSafe('default');
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
    const selected = shuffled.slice(0, Math.min(resolvedHandSize, shuffled.length));

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

    const preloadPromises = selected.flatMap((card) => [
      useTexture.preload(card.url_front_preprocessed || card.url_front_original),
      useTexture.preload(card.url_back_preprocessed || card.url_back_original)
    ]);

    try {
      await Promise.all(preloadPromises);
    } catch (error) {
      console.error('Texture preload warning:', error);
    } finally {
      setTexturesLoaded(true);
      setIsPackVisible(true);
      setStatus('pack');
    }
  }, [resolvedHandSize, setCursorSafe, stopPhaseTween, stopStackTween]);

  useEffect(() => {
    let cancelled = false;

    fetch(csvUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then((csvText) => {
        if (cancelled || !csvText) return;
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            if (cancelled) return;
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
              return;
            }

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
          },
          error: (error) => {
            if (!cancelled) {
              console.error('CSV parse error:', error);
              setStatus('error');
              setIsPackVisible(false);
              setTexturesLoaded(false);
            }
          }
        });
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Failed to load CSV:', error);
        setStatus('error');
        setIsPackVisible(false);
        setTexturesLoaded(false);
      });

    return () => {
      cancelled = true;
    };
  }, [csvUrl, normalizeCard, pickNewHand]);

  const handlePackAnimationComplete = useCallback(() => {
    setIsPackVisible(false);
    setStatus('stacked');
    setCursorSafe('default');
  }, [setCursorSafe]);

  const handleOpenAnotherPack = useCallback(() => {
    if (!allCards.length || status === 'loading') return;
    pickNewHand(allCards);
  }, [allCards, pickNewHand, status]);

  const handleCycleTopCard = useCallback(() => {
    if (status !== 'stacked' || stackAnimating || stackCards.length === 0) return;

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
  }, [collageCards.length, stackAnimating, stackCards, status, stopStackTween]);

  const startPhaseTransition = useCallback(() => {
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
  }, [status, stopPhaseTween]);

  useEffect(() => {
    if (
      status === 'stacked' &&
      currentHand.length > 0 &&
      stackCycles >= currentHand.length
    ) {
      startPhaseTransition();
    }
  }, [currentHand.length, stackCycles, startPhaseTransition, status]);

  useEffect(() => {
    if (status !== 'pack' || !clickTextRef.current) return undefined;
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
  }, [stopPhaseTween, stopStackTween]);

  const isRevealComplete = status === 'revealed';
  const rootStyle = {
    width: '100%',
    height: '100%',
    position: 'relative',
    background: '#0a0a0a',
    overflow: 'hidden',
    cursor,
    ...style
  };

  return (
    <div
      className={className}
      style={rootStyle}
      onPointerLeave={() => {
        setCursorSafe('default');
      }}
    >
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
          onCursorChange={setCursorSafe}
          packTextureUrl={packTextureUrl}
        />
      </Suspense>

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

      {allCards.length > 0 && isRevealComplete && (
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 20,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <button
            type="button"
            onClick={handleOpenAnotherPack}
            style={{
              padding: '12px 22px',
              borderRadius: '999px',
              border: '1px solid rgba(255,255,255,0.35)',
              background: 'rgba(0,0,0,0.55)',
              color: '#fff',
              fontSize: '0.95rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              backdropFilter: 'blur(6px)'
            }}
          >
            Open Another Pack
          </button>
        </div>
      )}
    </div>
  );
}
