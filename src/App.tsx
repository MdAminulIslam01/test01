import { useEffect, useRef, useState } from 'react';
import { UniverseScene } from './three/UniverseScene';
import { ZOOM_LEVELS } from './three/zoomScale';

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [levelName, setLevelName] = useState(ZOOM_LEVELS[0].name);

  useEffect(() => {
    if (!mountRef.current) {
      return undefined;
    }

    const universe = new UniverseScene(mountRef.current, {
      onReady: () => setIsReady(true),
      onLevelChange: setLevelName,
    });

    return () => universe.dispose();
  }, []);

  return (
    <main className="universe-shell">
      <div ref={mountRef} className="universe-canvas" aria-label="3D immersive universe panorama" />
      {!isReady && <div className="loader">Loading deep space</div>}
      <div className="scale-indicator" aria-live="polite">
        {levelName}
      </div>
    </main>
  );
}
