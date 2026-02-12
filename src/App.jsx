// src/App.jsx
import { useState, useEffect, useRef, Suspense } from 'react';
import { useTexture } from '@react-three/drei';
import Papa from 'papaparse';
import Experience from './components/Experience';
import gsap from 'gsap';

export default function App() {
  const [allCards, setAllCards] = useState([]);
  const [currentHand, setCurrentHand] = useState([]);
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

  const toProxyUrl = (url) => {
    if (!url || typeof url !== 'string') return url;
    if (url.startsWith('/images/')) return url;
    try {
      const u = new URL(url);
      if (u.hostname === 'ocs-production-public-images.s3.amazonaws.com') {
        return `/images${u.pathname}`;
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

    const front = frontKey ? toProxyUrl(row[frontKey]) : null;
    const back = backKey ? toProxyUrl(row[backKey]) : null;

    if (!front || !back) return null;
    return {
      ...row,
      card_id: row.card_id || row.id || row.cardId || row.name || 'unknown',
      url_front_preprocessed: front,
      url_back_preprocessed: back
    };
  };

  useEffect(() => {
    console.log('Loading CSV...');
    fetch('/adam_pokemon_render.csv')
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.toLowerCase().startsWith('text/csv')) {
          console.error(`CSV fetch error: expected text/csv, got "${contentType}"`);
          setStatus('error');
          setIsPackVisible(false);
          setTexturesLoaded(false);
          return null;
        }
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
      (card) => card?.url_front_preprocessed && card?.url_back_preprocessed
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
    
    console.log('Preloading textures...');
    const preloadPromises = selected.flatMap(card => [
      useTexture.preload(card.url_front_preprocessed),
      useTexture.preload(card.url_back_preprocessed)
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
    console.log('Pack animation complete - revealing cards');
    setIsPackVisible(false);
    setStatus('revealed');
  };

  useEffect(() => {
    if (status !== 'pack' || !clickTextRef.current) return;
    const tween = gsap.to(clickTextRef.current, {
      scale: 1.1,
      repeat: -1,
      yoyo: true
    });
    return () => tween.kill();
  }, [status]);

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
          status={status}
          isPackVisible={isPackVisible}
          texturesLoaded={texturesLoaded}
          topRef={topRef}
          bottomRef={bottomRef}
          topMaterialRef={topMaterialRef}
          bottomMaterialRef={bottomMaterialRef}
          onPackAnimationComplete={handlePackAnimationComplete}
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
