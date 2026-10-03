import fs from 'fs';
import path from 'path';

const file = 'src/components/TacticalMap.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add fetchRescueWeather import if missing
if (!content.includes('fetchRescueWeather')) {
  content = content.replace(
    /import \{ TacticalWeatherOverlay \} from '\.\/TacticalWeatherOverlay';/,
    "import { TacticalWeatherOverlay } from './TacticalWeatherOverlay';\nimport { fetchRescueWeather } from '../lib/weatherService';"
  );
}

// 2. Add Scent Cone toggle state
if (!content.includes('showScentCone')) {
  content = content.replace(
    /const \[showWeatherOverlay, setShowWeatherOverlay\] = useState\(true\);/,
    "const [showWeatherOverlay, setShowWeatherOverlay] = useState(true);\n  const [showScentCone, setShowScentCone] = useState(true);"
  );
}

// 3. Add computeDestinationPoint
if (!content.includes('computeDestinationPoint')) {
  content = content.replace(
    /interface TileLayerConfig \{/,
    `function computeDestinationPoint(lat: number, lng: number, distanceMeters: number, bearingDegrees: number): [number, number] {
  const R = 6371e3;
  const d = distanceMeters;
  const lat1 = (lat * Math.PI) / 180;
  const lng1 = (lng * Math.PI) / 180;
  const brng = (bearingDegrees * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d / R) + Math.cos(lat1) * Math.sin(d / R) * Math.cos(brng)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d / R) * Math.cos(lat1),
      Math.cos(d / R) - Math.sin(lat1) * Math.sin(lat2)
    );

  return [(lat2 * 180) / Math.PI, (lng2 * 180) / Math.PI];
}

interface TileLayerConfig {`
  );
}

// 4. Inject the async fetch and draw into the PLS useEffect
// We will replace the PLS rendering part to also draw the Scent Cone.
if (!content.includes('fetchRescueWeather(pls.lat, pls.lng)')) {
  content = content.replace(
    /(\/\/ 1\. PLS & Range Rings\s+if \(pls\) \{)/,
    `$1
      if (showScentCone && showWeatherOverlay) {
        fetchRescueWeather(pls.lat, pls.lng).then(weather => {
          if (!plsLayerRef.current) return;
          const wDir = weather.current.windDirection;
          const wSpd = weather.current.windSpeed;
          // Wind comes from wDir. Scent travels towards wDir + 180
          const scentDir = (wDir + 180) % 360;
          // Length of cone depends on wind speed (e.g. 1500m for 10km/h wind)
          const coneLength = Math.max(500, Math.min(3000, wSpd * 100)); 
          
          const p1 = computeDestinationPoint(pls.lat, pls.lng, coneLength, scentDir - 15);
          const p2 = computeDestinationPoint(pls.lat, pls.lng, coneLength, scentDir + 15);
          
          const scentConePoly = L.polygon([
            [pls.lat, pls.lng],
            p1,
            p2
          ], {
            color: '#f59e0b',
            weight: 1,
            fillColor: '#f59e0b',
            fillOpacity: 0.15,
            dashArray: '4, 4',
            interactive: false
          });
          
          scentConePoly.bindTooltip('Witterungskegel (Scent Cone)<br/>' + wSpd + ' km/h Wind', { className: 'tactical-tooltip', sticky: true });
          plsLayerRef.current.addLayer(scentConePoly);
        }).catch(e => console.warn('Could not fetch weather for scent cone', e));
      }
`
  );
}

// 5. Add toggle to UI
if (!content.includes('Scent Cone:')) {
  content = content.replace(
    /(<CloudSun className="w-3 h-3 text-amber-400" \/>\s+Einsatz-Wetter:\s+<\/span>)/,
    `<Wind className="w-3 h-3 text-amber-500 ml-2" /> 
                    <button onClick={() => setShowScentCone(!showScentCone)} className={\`px-2 py-0.5 rounded text-[10px] font-bold font-mono transition cursor-pointer \${showScentCone ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400'}\`}>Scent Cone</button>
                  </span>
                  <span className="text-slate-400 font-mono text-[10px] flex items-center gap-1">
                    $1`
  );
  
  // also need to import Wind icon
  content = content.replace(/CloudSun,/, 'CloudSun, Wind,');
}

fs.writeFileSync(file, content, 'utf8');
console.log('Scent cone patched.');
