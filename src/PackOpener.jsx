import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useTexture } from '@react-three/drei';
import Papa from 'papaparse';
import gsap from 'gsap';
import { flushSync } from 'react-dom';
import Experience from './components/Experience';

const DEFAULT_CSV_URL = '/more_cards_for_adam_v2.csv';
const DEFAULT_PACK_TEXTURE_URL = '/gradient_pack-removebg-preview.png';
const DEFAULT_LOCAL_IMAGE_BASE = '/api/images';
const DEFAULT_REMOTE_IMAGE_BASE = 'https://ocs-production-public-images.s3.amazonaws.com/images';
const DEFAULT_REMAP_SOURCE_HOST = 'ocs-production-public-images.s3.amazonaws.com';
const GRADIENT_IMAGE_PROXY_PREFIX = '/gradient-images';
const GRADIENT_REMOTE_HOST = 'images.gradientcollects.com';
const DEFAULT_SPARKLE_INTENSITY = 6;
const MARKET_KEY_CANDIDATES = ['market_price', 'marketPrice', 'price_market', 'price', 'market'];
const BUYBACK_KEY_CANDIDATES = [
  'instant_buy_back_price',
  'instantBuyBackPrice',
  'buy_back_price',
  'buyBackPrice'
];
const VFX_DIAGONAL_COLUMNS = [
  'diagonal_lines',
  'diagonal_coverage',
  'finish_diagonal',
  'vfx_diagonal',
  'diagonalIntensity'
];
const VFX_SPARKLE_COLUMNS = [
  'sparkle_flow',
  'sparkle_strength',
  'sparkle_intensity',
  'sparkle_rate',
  'sparkle_spawn',
  'finish_sparkles'
];
const VFX_PALETTE_COLUMNS = [
  'vfx_palette',
  'finish_palette',
  'color_palette'
];
const SPARKLE_PALETTE_COLUMNS = [
  'sparkle_palette',
  'sparkles_palette',
  'sparkle_colors',
  'vfx_sparkle_palette'
];
const DIAGONAL_PALETTE_COLUMNS = [
  'diagonal_palette',
  'stripe_palette',
  'shimmer_palette',
  'line_palette',
  'vfx_diagonal_palette'
];
const RARITY_COLUMNS = ['rarity', 'card_rarity', 'vfx_rarity', 'finish_rarity'];
const DEFAULT_VFX_PALETTE = ['#bfefff', '#6ea4ff', '#ffeaa4'];
const DEFAULT_PRICE_LABEL_FONT_SIZE = '11px';
const DEFAULT_PRICE_LABEL_FONT_COLOR = '#ffffff';
const IMAGE_PROBE_CACHE = new Map();
const CARD_PRELOAD_CACHE = new Map();
const BACKGROUND_PRELOAD_LIMIT = 18;
const FINISH_PALETTES = {
  normal: DEFAULT_VFX_PALETTE,
  holo: ['#ff8dd9', '#7ae0ff', '#ffe88a'],
  reverse_holo: ['#63d7ff', '#6d74ff', '#d3f2ff']
};
const RARITY_PALETTES = {
  chase: ['#fff5d6', '#ffd65a', '#ff9c2a'],
  legendary: ['#ffb5e3', '#ff7d7d', '#ffd470'],
  epic: ['#cba2ff', '#7196ff', '#b4f3ff'],
  rare: ['#6dfad6', '#4cb4ff', '#99e7ff'],
  common: ['#c7d7ff', '#8ed1ff', '#e0f4ff']
};

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

function clampHandSizeValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 5;
  return Math.max(1, Math.min(20, Math.floor(numeric)));
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

function parsePercentageToFactor(value, fallback = null) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const numeric = Number(String(value).replace(/%/g, '').trim());
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(1, Math.max(0, numeric / 100));
}

function parseBooleanSetting(value, fallback = true) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === '') return fallback;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  return fallback;
}

function parseTextSetting(value, fallback) {
  const text = String(value || '').trim();
  if (!text) return fallback;
  return text;
}

function buildPaletteArray(value) {
  if (value === undefined || value === null) return [];
  return String(value)
    .split(/[;,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeRarityText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim().toLowerCase();
  if (!text) return null;
  if (text.includes('chase')) return 'chase';
  if (text.includes('legend')) return 'legendary';
  if (text.includes('epic')) return 'epic';
  if (text.includes('rare')) return 'rare';
  if (text.includes('common')) return 'common';
  return null;
}

function determineRarityFromPrice(price) {
  if (!Number.isFinite(price)) return 'common';
  if (price >= 200) return 'chase';
  if (price >= 80) return 'legendary';
  if (price >= 40) return 'epic';
  if (price >= 12) return 'rare';
  return 'common';
}

function getPaletteForRarityAndFinish(rarity, finishType) {
  if (FINISH_PALETTES[finishType]) {
    return FINISH_PALETTES[finishType];
  }
  if (RARITY_PALETTES[rarity]) {
    return RARITY_PALETTES[rarity];
  }
  return DEFAULT_VFX_PALETTE;
}

function loadImageUrl(url) {
  if (!url) return Promise.resolve(false);

  if (!IMAGE_PROBE_CACHE.has(url)) {
    const probePromise = new Promise((resolve) => {
      if (typeof Image === 'undefined') {
        resolve(true);
        return;
      }

      const img = new Image();
      img.decoding = 'async';
      img.crossOrigin = 'anonymous';

      const cleanup = () => {
        img.onload = null;
        img.onerror = null;
      };

      img.onload = () => {
        cleanup();
        resolve(true);
      };

      img.onerror = () => {
        cleanup();
        resolve(false);
      };

      img.src = url;
    });

    IMAGE_PROBE_CACHE.set(url, probePromise);
  }

  return IMAGE_PROBE_CACHE.get(url);
}

async function preloadCardAssets(card) {
  if (!card) return null;
  const frontUrl = card.url_front_preprocessed || card.url_front_original;
  const backUrl = card.url_back_preprocessed || card.url_back_original;
  if (!frontUrl || !backUrl) return null;

  const [frontIsAvailable, backIsAvailable] = await Promise.all([
    loadImageUrl(frontUrl),
    loadImageUrl(backUrl)
  ]);

  if (!frontIsAvailable || !backIsAvailable) {
    return null;
  }

  const cacheKey = `${frontUrl}|${backUrl}`;
  if (!CARD_PRELOAD_CACHE.has(cacheKey)) {
    const preloadPromise = Promise.all([
      useTexture.preload(frontUrl),
      useTexture.preload(backUrl)
    ])
      .then(() => card)
      .catch((error) => {
        console.warn('Texture preload failed, removing card from hand:', card.card_id, error);
        IMAGE_PROBE_CACHE.set(frontUrl, Promise.resolve(false));
        IMAGE_PROBE_CACHE.set(backUrl, Promise.resolve(false));
        return null;
      });
    CARD_PRELOAD_CACHE.set(cacheKey, preloadPromise);
  }

  return CARD_PRELOAD_CACHE.get(cacheKey);
}

function warmCardAssetsInBackground(cards, excludedCardIds = new Set()) {
  const warmableCards = (cards || [])
    .filter((card) => card && !excludedCardIds.has(card.card_id))
    .slice(0, BACKGROUND_PRELOAD_LIMIT);

  if (warmableCards.length === 0) return;

  const runWarmup = () => {
    void Promise.allSettled(warmableCards.map((card) => preloadCardAssets(card)));
  };

  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(runWarmup, { timeout: 500 });
    return;
  }

  setTimeout(runWarmup, 120);
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
  const [selectedHandSize, setSelectedHandSize] = useState(() => clampHandSizeValue(handSize));
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
  const sparkleIntensity = DEFAULT_SPARKLE_INTENSITY;
  const resolvedHandSize = useMemo(() => clampHandSizeValue(selectedHandSize), [selectedHandSize]);

  const topRef = useRef();
  const bottomRef = useRef();
  const topMaterialRef = useRef();
  const bottomMaterialRef = useRef();
  const hasLoggedHeaders = useRef(false);
  const clickTextRef = useRef(null);
  const stackTweenRef = useRef(null);
  const phaseTweenRef = useRef(null);

  useEffect(() => {
    setSelectedHandSize(clampHandSizeValue(handSize));
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
      
      // Handle the CORS-blocked verifai bucket
      if (parsed.hostname === 'ocs-verifai-public-images.s3.amazonaws.com') {
        return `/api/verifai-images${parsed.pathname}`;
      }
      
      // Handle the main production bucket
      if (remapSourceHost && parsed.hostname === remapSourceHost) {
        return buildImageUrl(resolvedImageBase, normalizedFromPath(parsed.pathname), parsed.search);
      }
      
      if (parsed.hostname === GRADIENT_REMOTE_HOST) {
        return `${GRADIENT_IMAGE_PROXY_PREFIX}${parsed.pathname}${parsed.search}`;
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
    const diagonalKey = findFirstMatchingKey(keys, VFX_DIAGONAL_COLUMNS);
    const sparkleKey = findFirstMatchingKey(keys, VFX_SPARKLE_COLUMNS);
    const sharedPaletteKey = findFirstMatchingKey(keys, VFX_PALETTE_COLUMNS);
    const sparklePaletteKey = findFirstMatchingKey(keys, SPARKLE_PALETTE_COLUMNS);
    const diagonalPaletteKey = findFirstMatchingKey(keys, DIAGONAL_PALETTE_COLUMNS);
    const rarityKey = findFirstMatchingKey(keys, RARITY_COLUMNS);

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
    const diagonalCoverage = parsePercentageToFactor(row[diagonalKey], 1);
    const sparkleFactor = parsePercentageToFactor(row[sparkleKey], null);
    const sharedPaletteOverride = sharedPaletteKey ? buildPaletteArray(row[sharedPaletteKey]) : [];
    const sparklePaletteOverride = sparklePaletteKey ? buildPaletteArray(row[sparklePaletteKey]) : [];
    const diagonalPaletteOverride = diagonalPaletteKey ? buildPaletteArray(row[diagonalPaletteKey]) : [];
    const parsedRarity = rarityKey ? normalizeRarityText(row[rarityKey]) : null;
    const priceForRarity = marketPriceValue ?? buyBackPriceValue ?? null;
    const computedRarity = parsedRarity || determineRarityFromPrice(priceForRarity);
    const fallbackPalette = getPaletteForRarityAndFinish(computedRarity, finishType);
    const finalSparklePalette =
      sparklePaletteOverride.length > 0
        ? sparklePaletteOverride
        : sharedPaletteOverride.length > 0
          ? sharedPaletteOverride
          : fallbackPalette;
    const finalDiagonalPalette =
      diagonalPaletteOverride.length > 0
        ? diagonalPaletteOverride
        : sharedPaletteOverride.length > 0
          ? sharedPaletteOverride
          : finalSparklePalette;
    const finalSparklePaletteKey = finalSparklePalette.join('|');
    const finalDiagonalPaletteKey = finalDiagonalPalette.join('|');
    const getFactor = (value, fallback) => {
      const factor = parsePercentageToFactor(value, null);
      return factor === null ? fallback : factor;
    };
    const sparkleSettings = {
      enabled: parseBooleanSetting(row.sparkle_enabled, true),
      opacity: getFactor(row.sparkle_opacity, 1),
      intensity: getFactor(row.sparkle_intensity, 1),
      size: getFactor(row.sparkle_size, 0.5),
      speed: getFactor(row.sparkle_speed, 0.5),
      quantity: getFactor(row.sparkle_quantity, 0.65)
    };
    const shimmerSettings = {
      enabled: parseBooleanSetting(row.shimmer_enabled, true),
      opacity: getFactor(row.shimmer_opacity, 0.55),
      intensity: getFactor(row.shimmer_intensity, 0.6),
      size: getFactor(row.shimmer_size, 0.4),
      speed: getFactor(row.shimmer_speed, 0.5)
    };
    const priceLabelSettings = {
      enabled: parseBooleanSetting(row.price_label_enabled, true),
      fontSize: parseTextSetting(row.price_label_font_size, DEFAULT_PRICE_LABEL_FONT_SIZE),
      fontColor: parseTextSetting(row.price_label_font_color, DEFAULT_PRICE_LABEL_FONT_COLOR)
    };

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
      url_back_preprocessed: back,
      vfxDiagonalCoverage: diagonalCoverage,
      vfxSparkleFactor: sparkleFactor,
      vfxSparklePalette: finalSparklePalette,
      vfxSparklePaletteKey: finalSparklePaletteKey,
      vfxDiagonalPalette: finalDiagonalPalette,
      vfxDiagonalPaletteKey: finalDiagonalPaletteKey,
      vfxHasExplicitPalette:
        sparklePaletteOverride.length > 0 ||
        diagonalPaletteOverride.length > 0 ||
        sharedPaletteOverride.length > 0,
      rarity: computedRarity,
      sparkleSettings,
      shimmerSettings,
      priceLabelSettings
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
    const selected = [];
    const rejectedCardIds = [];
    const batchSize = Math.min(24, Math.max(8, targetHandSize * 2));

    for (let offset = 0; offset < shuffled.length && selected.length < targetHandSize; offset += batchSize) {
      const batch = shuffled.slice(offset, offset + batchSize);
      const batchResults = await Promise.all(batch.map((card) => preloadCardAssets(card)));
      batchResults.forEach((readyCard, resultIndex) => {
        if (readyCard) {
          if (selected.length < targetHandSize) {
            selected.push(readyCard);
          }
        } else {
          rejectedCardIds.push(batch[resultIndex]?.card_id);
        }
      });
    }

    if (selected.length === 0) {
      console.error('No playable cards available after image validation.', rejectedCardIds);
      setStatus('error');
      setIsPackVisible(false);
      setTexturesLoaded(false);
      return;
    }

    if (rejectedCardIds.length > 0) {
      console.warn('Skipping cards with unavailable images:', rejectedCardIds.filter(Boolean));
    }

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

    setTexturesLoaded(true);
    setIsPackVisible(true);
    setStatus('pack');

    warmCardAssetsInBackground(
      shuffled,
      new Set(selected.map((card) => card.card_id))
    );
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
    flushSync(() => {
      setStackAnimating(true);
      setStackAnimProgress(0);
      setMovingCard(topCard);
      setMovingToIndex(targetCollageIndex);
    });

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
        flushSync(() => {
          setStackCards((prev) => prev.slice(1));
          setCollageCards((prev) => [...prev, topCard]);
          setStackCycles((prev) => prev + 1);
          setStackAnimProgress(0);
          setMovingCard(null);
          setMovingToIndex(-1);
          setStackAnimating(false);
        });
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

      {allCards.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            zIndex: 20,
            minWidth: '220px',
            padding: '12px 14px',
            borderRadius: '14px',
            border: '1px solid rgba(255,255,255,0.14)',
            background: 'rgba(0,0,0,0.48)',
            color: '#fff',
            backdropFilter: 'blur(10px)'
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px',
              gap: '12px'
            }}
          >
            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                opacity: 0.85
              }}
            >
              Cards In Pack
            </span>
            <span
              style={{
                fontSize: '1rem',
                fontWeight: 800
              }}
            >
              {resolvedHandSize}
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="20"
            step="1"
            value={resolvedHandSize}
            onChange={(event) => {
              setSelectedHandSize(clampHandSizeValue(event.target.value));
            }}
            style={{
              width: '100%',
              cursor: 'pointer'
            }}
          />
        </div>
      )}

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
