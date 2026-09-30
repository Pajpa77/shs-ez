const fs = require('fs');
let code = fs.readFileSync('src/context/RescueContext.tsx', 'utf8');

// Add imports if not present
if (!code.includes('import { startCapacitorBackgroundGps, stopCapacitorBackgroundGps }')) {
  code = code.replace(
    /import \{ UserLocationState, SearchOperation, ChatMessage, User, GpsPoint \} from '\.\.\/types';/,
    "import { UserLocationState, SearchOperation, ChatMessage, User, GpsPoint } from '../types';\nimport { Capacitor } from '@capacitor/core';\nimport { startCapacitorBackgroundGps, stopCapacitorBackgroundGps } from '../lib/capacitorGps';"
  );
}

// Add native watcher ID ref
if (!code.includes('const nativeWatcherIdRef')) {
  code = code.replace(
    /const watchPositionIdRef = useRef<number \| null>\(null\);/,
    "const watchPositionIdRef = useRef<number | null>(null);\n  const nativeWatcherIdRef = useRef<string | null>(null);"
  );
}

// Patch the startWatcher function
const originalStartWatcher = `const startWatcher = () => {
      if (watchPositionIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchPositionIdRef.current);
      }

      watchPositionIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {`;

const newStartWatcher = `const startWatcher = async () => {
      if (watchPositionIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchPositionIdRef.current);
        watchPositionIdRef.current = null;
      }
      if (nativeWatcherIdRef.current !== null) {
        await stopCapacitorBackgroundGps(nativeWatcherIdRef.current);
        nativeWatcherIdRef.current = null;
      }

      const handlePos = (pos: any) => {`;

if (code.includes('watchPositionIdRef.current = navigator.geolocation.watchPosition(')) {
  code = code.replace(originalStartWatcher, newStartWatcher);

  // Now replace the end of watchPosition call
  // The original ends with:
  /*
            syncLocationToCloud(newPoint);
          }
        },
        (err) => {
          console.warn('[GPS] watchPosition error:', err);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
    };
  */

  const endOfWatchPosition = `          syncLocationToCloud(newPoint);
        }
      },
      (err) => {
        console.warn('[GPS] watchPosition error:', err);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
  };`;

  const newEndOfWatchPosition = `          syncLocationToCloud(newPoint);
        }
      };

      if (Capacitor.isNativePlatform()) {
        const id = await startCapacitorBackgroundGps(handlePos);
        if (id) nativeWatcherIdRef.current = id;
      } else {
        watchPositionIdRef.current = navigator.geolocation.watchPosition(
          handlePos,
          (err) => { console.warn('[GPS] watchPosition error:', err); },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
        );
      }
  };`;

  code = code.replace(endOfWatchPosition, newEndOfWatchPosition);
}

// Update the cleanup code
const cleanupRegex = /if \(watchPositionIdRef\.current !== null\) \{\s*navigator\.geolocation\.clearWatch\(watchPositionIdRef\.current\);\s*watchPositionIdRef\.current = null;\s*\}/g;
code = code.replace(cleanupRegex, `if (watchPositionIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchPositionIdRef.current);
        watchPositionIdRef.current = null;
      }
      if (nativeWatcherIdRef.current !== null) {
        stopCapacitorBackgroundGps(nativeWatcherIdRef.current);
        nativeWatcherIdRef.current = null;
      }`);

fs.writeFileSync('src/context/RescueContext.tsx', code);
console.log('Patched RescueContext.tsx for Capacitor');
