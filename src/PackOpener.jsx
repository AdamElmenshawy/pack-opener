import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useTexture } from '@react-three/drei';
import Papa from 'papaparse';
import gsap from 'gsap';
import Experience from './components/Experience';

const DEFAULT_CSV_URL = '/pricing_for_adam_e.csv';
const DEFAULT_PACK_TEXTURE_URL = '/gradient_pack-removebg-preview.png';
const DEFAULT_LOCAL_IMAGE_BASE = '/api/images';
const DEFAULT_REMOTE_IMAGE_BASE = 'https://ocs-production-public-images.s3.amazonaws.com/images';
const DEFAULT_REMAP_SOURCE_HOST = 'ocs-production-public-images.s3.amazonaws.com';
const SPARKLE_SETTINGS_STORAGE_KEY = 'pack-opener-sparkle-settings-v1';
const DEFAULT_SPARKLE_INTENSITY = 6;
const SPARKLE_MIN = 1;
const SPARKLE_MAX = 10;
const MARKET_KEY_CANDIDATES = ['market_price', 'marketPrice', 'price_market', 'price', 'market'];
const BUYBACK_KEY_CANDIDATES = [
  'instant_buy_back_price',
  'instantBuyBackPrice',
  'buy_back_price',
  'buyBackPrice'
];
const PRELOAD_BATCH_SIZE = 6;

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
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

function clampSparkleLevel(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return SPARKLE_MIN;
  return Math.min(SPARKLE_MAX, Math.max(SPARKLE_MIN, Math.round(numeric)));
}

function clampHandSizeValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 5;
  return Math.max(1, Math.min(20, Math.floor(numeric)));
}

function normalizeSparkleIntensity(value) {
  if (typeof value === 'number' || typeof value === 'string') {
    return clampSparkleLevel(value);
  }
  if (value && typeof value === 'object') {
    const candidates = [value.normal, value.holo, value.reverseHolo]
      .map((entry) => Number(entry))
      .filter((entry) => Number.isFinite(entry));
    if (candidates.length > 0) {
      const avg = candidates.reduce((sum, current) => sum + current, 0) / candidates.length;
      return clampSparkleLevel(avg);
    }
  }
  return DEFAULT_SPARKLE_INTENSITY;
}

function parsePriceNumber(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const cleaned = String(value).replace(/[^0-9.-]+/g, '');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatUsd(value) {
  if (!Number.isFinite(value)) return '';
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function findFirstMatchingKey(keys, candidates) {
  const loweredCandidates = candidates.map((item) => item.toLowerCase());
  return keys.find((key) => loweredCandidates.includes(String(key).toLowerCase())) || null;
}

function normalizeFinishTypeFromText(text) {
  const value = String(text || '').trim().toLowerCase();
  if (!value) return null;
  if (/(non[\s_-]*holo|no[\s_-]*holo|normal|regular|standard|none)/.test(value)) {
    return 'normal';
  }
  if (/(reverse[\s_-]*holo|rev[\s_-]*holo)/.test(value)) {
    return 'reverse_holo';
  }
  if (/(holo|holographic|foil|cosmos|galaxy|shiny)/.test(value)) {
    return 'holo';
  }
  return null;
}

function detectFinishType(row, keys) {
  for (const key of keys) {
    const lowerKey = String(key || '').toLowerCase();
    const raw = row?.[key];
    if (raw === undefined || raw === null || raw === '') continue;
    const keyLooksRelevant = /(finish|foil|holo|effect|treat|variant|surface|print|type|rarity)/.test(lowerKey);

    if (typeof raw === 'boolean') {
      if (!raw) continue;
      if (/(reverse[\s_-]*holo|rev[\s_-]*holo)/.test(lowerKey)) return 'reverse_holo';
      if (/(holo|foil)/.test(lowerKey)) return 'holo';
      if (/(normal|regular|standard)/.test(lowerKey)) return 'normal';
      continue;
    }

    if (!keyLooksRelevant) continue;

    const fromValue = normalizeFinishTypeFromText(raw);
    if (fromValue) return fromValue;

    const fromCombined = normalizeFinishTypeFromText(`${lowerKey} ${raw}`);
    if (fromCombined) return fromCombined;
  }
  return 'normal';
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
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [sparkleIntensity, setSparkleIntensity] = useState(DEFAULT_SPARKLE_INTENSITY);
  const baseHandSize = useMemo(() => clampHandSizeValue(handSize), [handSize]);
  const [handSizeSetting, setHandSizeSetting] = useState(baseHandSize);
  useEffect(() => {
    setHandSizeSetting(baseHandSize);
  }, [baseHandSize]);

  const topRef = useRef();
  const bottomRef = useRef();
  const topMaterialRef = useRef();
  const bottomMaterialRef = useRef();
  const hasLoggedHeaders = useRef(false);
  const clickTextRef = useRef(null);
  const stackTweenRef = useRef(null);
  const phaseTweenRef = useRef(null);

  const resolvedHandSize = useMemo(() => clampHandSizeValue(handSizeSetting), [handSizeSetting]);

  const resolvedImageBase = useMemo(() => {
    return shouldUseLocalBase(forceLocalImageBase) ? localImageBase : remoteImageBase;
  }, [forceLocalImageBase, localImageBase, remoteImageBase]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(SPARKLE_SETTINGS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setSparkleIntensity(normalizeSparkleIntensity(parsed));
    } catch {
      // ignore local storage parsing issues
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      SPARKLE_SETTINGS_STORAGE_KEY,
      JSON.stringify(sparkleIntensity)
    );
  }, [sparkleIntensity]);

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
      
      // Handle the CORS-blocked verifai bucket
      if (parsed.hostname === 'ocs-verifai-public-images.s3.amazonaws.com') {
        return `/api/verifai-images${parsed.pathname}`;
      }
      
      // Handle the main production bucket
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
    const marketKey =
      findFirstMatchingKey(keys, MARKET_KEY_CANDIDATES) ||
      keys.find((key) => /(market|price)/i.test(key) && !/(buy|back|instant)/i.test(key)) ||
      null;
    const buyBackKey =
      findFirstMatchingKey(keys, BUYBACK_KEY_CANDIDATES) ||
      keys.find((key) => /(buy[\s_-]*back|instant)/i.test(key) && /(price|value|amount)/i.test(key)) ||
      null;

    const rawFront = frontKey ? String(row[frontKey] || '').trim() : '';
    const rawBack = backKey ? String(row[backKey] || '').trim() : '';
    const front = rawFront ? toProxyUrl(rawFront) : null;
    const back = rawBack ? toProxyUrl(rawBack) : null;
    const finishType = detectFinishType(row, keys);
    const marketPriceValue = marketKey ? parsePriceNumber(row[marketKey]) : null;
    const buyBackFromCsv = buyBackKey ? parsePriceNumber(row[buyBackKey]) : null;
    const buyBackPriceValue =
      buyBackFromCsv !== null
        ? buyBackFromCsv
        : marketPriceValue !== null
          ? marketPriceValue * 0.8
          : null;
    const marketPriceDisplay = marketPriceValue !== null ? formatUsd(marketPriceValue) : '';
    const buyBackPriceDisplay = buyBackPriceValue !== null ? formatUsd(buyBackPriceValue) : '';

    if (!front || !back) return null;

    return {
      ...row,
      card_id: row.card_id || row.id || row.cardId || row.name || 'unknown',
      finish_type: finishType,
      market_price_value: marketPriceValue,
      instant_buy_back_price_value: buyBackPriceValue,
      market_price: marketPriceDisplay || row.market_price || row.marketPrice || row.price_market || row.price || '',
      instant_buy_back_price:
        buyBackPriceDisplay ||
        row.instant_buy_back_price ||
        row.instantBuyBackPrice ||
        row.buy_back_price ||
        row.buyBackPrice ||
        '',
      url_front_original: rawFront,
      url_back_original: rawBack,
      url_front_preprocessed: front,
      url_back_preprocessed: back
    };
  }, [toProxyUrl]);

  const pickNewHand = useCallback(async (cards, overrideHandSize) => {
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
    const targetHandSize = clampHandSizeValue(
      overrideHandSize !== undefined ? overrideHandSize : resolvedHandSize
    );
    const selected = shuffled.slice(0, Math.min(targetHandSize, shuffled.length));

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

    const preloadTextures = (cardList) =>
      cardList.flatMap((card) => [
        useTexture.preload(card.url_front_preprocessed || card.url_front_original),
        useTexture.preload(card.url_back_preprocessed || card.url_back_original)
      ]);

    const initialBatch = selected.slice(0, Math.min(PRELOAD_BATCH_SIZE, selected.length));
    const backgroundBatch = selected.slice(initialBatch.length);

    const preloadInitial = preloadTextures(initialBatch);

    try {
      await Promise.all(preloadInitial);
    } catch (error) {
      console.error('Texture preload warning:', error);
    } finally {
      if (backgroundBatch.length > 0) {
        const backgroundPromises = preloadTextures(backgroundBatch);
        Promise.allSettled(backgroundPromises).catch((error) => {
          console.warn('Background texture preload warning:', error);
        });
      }
      setTexturesLoaded(true);
      setIsPackVisible(true);
      setStatus('pack');
    }
  }, [resolvedHandSize, setCursorSafe, stopPhaseTween, stopStackTween]);

  const handleHandSizeChange = useCallback(
    (value) => {
      const nextSize = clampHandSizeValue(value);
      setHandSizeSetting(nextSize);
      if (allCards.length > 0) {
        pickNewHand(allCards, nextSize);
      }
    },
    [allCards, pickNewHand]
  );

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

  const updateSparkleIntensity = useCallback((level) => {
    const clamped = clampSparkleLevel(level);
    setSparkleIntensity((prev) => (prev === clamped ? prev : clamped));
  }, []);

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
          sparkleIntensity={sparkleIntensity}
        />
      </Suspense>

      <div
        style={{
          position: 'absolute',
          top: '14px',
          right: '14px',
          zIndex: 40,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '8px'
        }}
      >
        <button
          type="button"
          onClick={() => setShowSettingsPanel((prev) => !prev)}
          style={{
            padding: '8px 12px',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.25)',
            background: 'rgba(0,0,0,0.58)',
            color: '#fff',
            fontSize: '0.78rem',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            backdropFilter: 'blur(6px)'
          }}
        >
          Settings
        </button>

        {showSettingsPanel && (
          <div
            style={{
              minWidth: '260px',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.24)',
              background: 'rgba(0,0,0,0.68)',
              color: '#fff',
              padding: '12px',
              backdropFilter: 'blur(8px)'
            }}
          >
            <div
              style={{
                fontSize: '0.72rem',
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                opacity: 0.8,
                marginBottom: '10px'
              }}
            >
              Sparkle Intensity Meter
            </div>

            <label style={{ display: 'block' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '4px',
                  fontSize: '0.82rem'
                }}
              >
                <span>Intensity</span>
                <span>{sparkleIntensity}</span>
              </div>
              <input
                type="range"
                min={SPARKLE_MIN}
                max={SPARKLE_MAX}
                step={1}
                value={sparkleIntensity}
                onChange={(e) => updateSparkleIntensity(e.target.value)}
                style={{ width: '100%' }}
              />
            </label>
            <div style={{ marginTop: '14px' }}>
              <div
                style={{
                  fontSize: '0.72rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  opacity: 0.8,
                  marginBottom: '10px'
                }}
              >
                Pack Size Meter
              </div>
              <label style={{ display: 'block' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '4px',
                    fontSize: '0.82rem'
                  }}
                >
                  <span>Cards in pack</span>
                  <span>{resolvedHandSize}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={20}
                  step={1}
                  value={handSizeSetting}
                  onChange={(e) => handleHandSizeChange(e.target.value)}
                  style={{ width: '100%' }}
                />
              </label>
            </div>
          </div>
        )}
      </div>

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
