import fs from 'fs';

let content = fs.readFileSync('src/components/TacticalMap.tsx', 'utf8');

if (!content.includes('showAero')) {
  // 1. State for aero
  content = content.replace(
    /const \[showWeatherOverlay, setShowWeatherOverlay\] = useState\(true\);/,
    "const [showWeatherOverlay, setShowWeatherOverlay] = useState(true);\n  const [showAero, setShowAero] = useState(false);"
  );

  // 2. Add Aero Layer Ref
  content = content.replace(
    /const ezLayerRef = useRef<L\.LayerGroup \| null>\(null\);/,
    "const ezLayerRef = useRef<L.LayerGroup | null>(null);\n  const aeroLayerRef = useRef<L.TileLayer | null>(null);"
  );

  // 3. Mount Aero Layer inside the main init effect
  content = content.replace(
    /mapInstanceRef\.current\.addLayer\(plsLayerRef\.current\);/,
    `mapInstanceRef.current.addLayer(plsLayerRef.current);
        
        aeroLayerRef.current = L.tileLayer('https://{s}.tile.maps.openaip.net/geowebcache/service/tms/1.0.0/openaip_basemap_aero_overlay@EPSG%3A900913@png/{z}/{x}/{y}.png', {
          tms: true,
          maxZoom: 14,
          subdomains: '12',
          opacity: 0.7,
          attribution: 'Luftraumdaten © OpenAIP'
        });`
  );

  // 4. Effect to toggle aeroLayer
  content = content.replace(
    /useEffect\(\(\) => \{\s*if \(\!mapInstanceRef\.current \|\| \!selectedUser\) return;\s*setShowResponders\(true\); \/\//,
    `useEffect(() => {
    if (!mapInstanceRef.current || !aeroLayerRef.current) return;
    if (showAero) {
      if (!mapInstanceRef.current.hasLayer(aeroLayerRef.current)) {
        mapInstanceRef.current.addLayer(aeroLayerRef.current);
      }
    } else {
      if (mapInstanceRef.current.hasLayer(aeroLayerRef.current)) {
        mapInstanceRef.current.removeLayer(aeroLayerRef.current);
      }
    }
  }, [showAero]);
  
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedUser) return;
    setShowResponders(true); //`
  );

  // 5. Toggle UI
  content = content.replace(
    /<button\s*onClick=\{\(\) => setIsWeatherModalOpenMobile\(true\)\}/,
    `<button onClick={() => setShowAero(!showAero)} className={\`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition cursor-pointer font-mono \${showAero ? 'bg-indigo-600 text-white' : 'bg-slate-800/80 text-indigo-400 hover:text-white border border-indigo-500/40'}\`}>Luftraum</button>
              <button
                onClick={() => setIsWeatherModalOpenMobile(true)}`
  );

  fs.writeFileSync('src/components/TacticalMap.tsx', content, 'utf8');
  console.log('Aero patched.');
} else {
  console.log('Already patched.');
}
