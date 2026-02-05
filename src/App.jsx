// src/App.jsx
import { useState, useEffect, useRef, Suspense } from 'react';
import { useTexture } from '@react-three/drei';
import Papa from 'papaparse';
import gsap from 'gsap';
import Experience from './components/Experience';

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
  const isAnimating = useRef(false);

  useEffect(() => {
    console.log('📄 Loading CSV...');
    fetch('/adam_pokemon_render.csv')
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then(csvText => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            console.log('✓ CSV loaded:', results.data.length, 'cards');
            if (results.data.length > 0) {
              setAllCards(results.data);
              pickNewHand(results.data);
            }
          },
          error: (error) => console.error('❌ CSV error:', error)
        });
      })
      .catch(err => console.error('❌ Failed to load CSV:', err));
  }, []);

  const pickNewHand = async (cards) => {
    console.log('🎲 Picking 5 random cards...');
    setTexturesLoaded(false);
    setStatus('loading');
    setIsPackVisible(false);
    
    const shuffled = [...cards].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 5);
    
    console.log('✓ Selected:', selected.map(c => c.card_id));
    setCurrentHand(selected);
    
    console.log('📦 Preloading 10 textures...');
    const preloadPromises = selected.flatMap(card => [
      useTexture.preload(card.url_front_preprocessed),
      useTexture.preload(card.url_back_preprocessed)
    ]);

    try {
      await Promise.all(preloadPromises);
      console.log('✓ All textures preloaded');
      setTexturesLoaded(true);
      setIsPackVisible(true);
      setStatus('pack');
    } catch (err) {
      console.error('⚠️ Preload error:', err);
      setTexturesLoaded(true);
      setIsPackVisible(true);
      setStatus('pack');
    }
  };

  const handlePackClick = (e) => {
    e.stopPropagation();
    
    if (isAnimating.current || !topRef.current || !bottomRef.current) {
      console.log('Animation already running or refs not ready');
      return;
    }
    
    console.log('🎁 Pack clicked - starting 3-stage animation');
    isAnimating.current = true;

    // 3-STAGE GSAP TIMELINE
    const tl = gsap.timeline({
      onComplete: () => {
        console.log('✓ Stage 3: Animation complete - revealing cards');
        setIsPackVisible(false);
        setStatus('revealed');
        isAnimating.current = false;
      }
    });

    // STAGE 1: Pack pieces fly apart
    tl.to(topRef.current.position, {
      y: 10,
      duration: 0.8,
      ease: 'power2.in'
    }, 0);

    tl.to(topRef.current.rotation, {
      x: -1,
      z: 1.2,
      duration: 0.8,
      ease: 'power2.in'
    }, 0);

    tl.to(bottomRef.current.position, {
      y: -10,
      duration: 0.8,
      ease: 'power2.in'
    }, 0);

    tl.to(bottomRef.current.rotation, {
      x: 1,
      z: -1.2,
      duration: 0.8,
      ease: 'power2.in'
    }, 0);

    // STAGE 2: Simultaneously fade opacity to 0
    tl.to([topMaterialRef.current, bottomMaterialRef.current], {
      opacity: 0,
      duration: 0.6,
      ease: 'power2.in'
    }, 0.3);

    // STAGE 3: onComplete fires automatically
  };

  const handleClickOverlay = () => {
    if (status === 'pack') {
      setIsPackVisible(false);
      setStatus('revealed');
    }
  };

  const handleNewPack = () => {
    console.log('🔄 New pack');
    if (allCards.length > 0) pickNewHand(allCards);
  };

  const btnStyle = {
    padding: '16px 40px',
    fontSize: '1.2rem',
    fontWeight: '700',
    backdropFilter: 'blur(10px)',
    background: 'rgba(255, 255, 255, 0.15)',
    color: '#fff',
    border: '1px solid rgba(255, 255, 255, 0.4)',
    borderRadius: '14px',
    cursor: 'pointer',
    transition: 'all 0.3s',
    fontFamily: 'system-ui',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
  };

  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      position: 'relative', 
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0f0f1e 100%)',
      overflow: 'hidden'
    }}>
      <Suspense fallback={<div style={{ color: '#fff', textAlign: 'center', paddingTop: '40vh', fontSize: '1.5rem' }}>Loading...</div>}>
        <Experience
          cards={currentHand}
          status={status}
          isPackVisible={isPackVisible}
          texturesLoaded={texturesLoaded}
          topRef={topRef}
          bottomRef={bottomRef}
          topMaterialRef={topMaterialRef}
          bottomMaterialRef={bottomMaterialRef}
          onPackClick={handlePackClick}
        />
      </Suspense>

      {/* Loading */}
      {status === 'loading' && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backdropFilter: 'blur(20px)',
          background: 'rgba(0, 0, 0, 0.85)',
          zIndex: 1000
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            border: '6px solid rgba(255, 255, 255, 0.1)',
            borderTopColor: '#6a4aff',
            borderRadius: '50%',
            animation: 'spin 1s infinite',
            marginBottom: '32px'
          }}></div>
          <h2 style={{ fontSize: '2.2rem', fontWeight: '900', marginBottom: '12px', color: '#fff' }}>
            Preparing Pack...
          </h2>
          <p style={{ fontSize: '1.1rem', color: 'rgba(255, 255, 255, 0.7)' }}>
            Preloading {currentHand.length * 2} textures
          </p>
        </div>
      )}

      {/* Pack Instructions */}
      {status === 'pack' && (
        <div 
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            pointerEvents: 'auto',
            zIndex: 10,
            cursor: 'pointer'
          }}
          onClick={handleClickOverlay}
        >
          <div style={{
            fontSize: '5rem',
            marginBottom: '24px',
            animation: 'bounce 2s infinite'
          }}>✨</div>
          <h2 style={{
            fontSize: '3.5rem',
            fontWeight: '900',
            color: '#fff',
            marginBottom: '16px',
            textShadow: '0 4px 40px rgba(106, 74, 255, 1)',
            fontFamily: 'system-ui'
          }}>Click to Open!</h2>
        </div>
      )}

      {/* Info Bar */}
      {status === 'revealed' && (
        <div style={{
          position: 'absolute',
          top: '32px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '16px 36px',
          backdropFilter: 'blur(10px)',
          background: 'rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.35)',
          color: '#fff',
          fontSize: '1.05rem',
          fontWeight: '600',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <span style={{ fontSize: '1.4rem' }}>💎</span>
          <span>Hover to inspect • Drag to rotate</span>
        </div>
      )}

      {/* Controls */}
      {status === 'revealed' && (
        <div style={{
          position: 'absolute',
          bottom: '40px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100
        }}>
          <button onClick={handleNewPack} style={btnStyle}>
            <span style={{ fontSize: '1.5rem', marginRight: '10px' }}>🎁</span>
            Open New Pack
          </button>
        </div>
      )}

      {/* Debug */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        left: '10px',
        padding: '8px 12px',
        background: 'rgba(0, 0, 0, 0.7)',
        color: '#fff',
        fontSize: '0.8rem',
        borderRadius: '4px',
        fontFamily: 'monospace',
        zIndex: 1000
      }}>
        {status} | Pack: {isPackVisible ? 'visible' : 'hidden'} | Textures: {texturesLoaded ? 'OK' : 'loading'}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }
      `}</style>
    </div>
  );
}