import fs from 'fs';

let content = fs.readFileSync('src/components/TacticalMap.tsx', 'utf8');

// 1. imports
if (!content.includes('@turf/turf')) {
  content = content.replace(
    /import L from 'leaflet';/,
    "import L from 'leaflet';\nimport * as turf from '@turf/turf';"
  );
}

// 2. state & refs
if (!content.includes('coverageLayerRef')) {
  content = content.replace(
    /const tracksLayerRef = useRef<L\.LayerGroup \| null>\(null\);/,
    "const tracksLayerRef = useRef<L.LayerGroup | null>(null);\n  const coverageLayerRef = useRef<L.LayerGroup | null>(null);"
  );
  
  content = content.replace(
    /const \[showTracks, setShowTracks\] = useState\(true\);/,
    "const [showTracks, setShowTracks] = useState(true);\n  const [showCoverage, setShowCoverage] = useState(false);"
  );
}

// 3. Mount layer
if (!content.includes('mapInstanceRef.current.addLayer(coverageLayerRef.current);')) {
  content = content.replace(
    /tracksLayerRef\.current = L\.layerGroup\(\);/,
    "tracksLayerRef.current = L.layerGroup();\n      coverageLayerRef.current = L.layerGroup();"
  );
  content = content.replace(
    /mapInstanceRef\.current\.addLayer\(tracksLayerRef\.current\);/,
    "mapInstanceRef.current.addLayer(tracksLayerRef.current);\n      mapInstanceRef.current.addLayer(coverageLayerRef.current);"
  );
}

// 4. Coverage calculation Effect
if (!content.includes('// Render Coverage Check')) {
  content = content.replace(
    /(\/\/ Render Active Responders \/ Units Pins)/,
    `// Render Coverage Check
    useEffect(() => {
      if (!coverageLayerRef.current) return;
      coverageLayerRef.current.clearLayers();
      if (!showCoverage || !currentOperation) return;

      const sectors = currentOperation.sectors || [];
      if (sectors.length === 0) return;

      try {
        // Collect all track line strings
        const allTrackFeatures = [];
        Object.values(userLocations).forEach(locState => {
          if (locState.history && locState.history.length > 1) {
            const coords = locState.history.map(pt => [pt.lng, pt.lat]);
            allTrackFeatures.push(turf.lineString(coords));
          }
        });
        
        if (currentOperation.archivedTracks) {
          currentOperation.archivedTracks.forEach(trk => {
            if (trk.points && trk.points.length > 1) {
               const coords = trk.points.map(pt => [pt.lng, pt.lat]);
               allTrackFeatures.push(turf.lineString(coords));
            }
          });
        }
        
        let unionedBuffers = null;
        if (allTrackFeatures.length > 0) {
           const buffers = allTrackFeatures.map(f => turf.buffer(f, 20, { units: 'meters' })); // 20m Sichtweite
           unionedBuffers = buffers[0];
           for (let i = 1; i < buffers.length; i++) {
             if (!buffers[i]) continue;
             const united = turf.union(turf.featureCollection([unionedBuffers, buffers[i]]));
             if (united) unionedBuffers = united;
           }
        }
        
        sectors.forEach(sector => {
           if (!sector.polygon || sector.polygon.length < 3) return;
           const closedPoly = [...sector.polygon, sector.polygon[0]].map(p => [p[1], p[0]]);
           let searchPoly = turf.polygon([closedPoly]);
           
           if (unionedBuffers) {
             const diff = turf.difference(turf.featureCollection([searchPoly, unionedBuffers]));
             if (diff) {
                // draw difference
                const geoJsonLayer = L.geoJSON(diff, {
                  style: { color: '#ef4444', weight: 0, fillOpacity: 0.5, fillColor: '#ef4444' },
                  interactive: false
                });
                coverageLayerRef.current?.addLayer(geoJsonLayer);
             }
           } else {
             // draw full sector
             const geoJsonLayer = L.geoJSON(searchPoly, {
                style: { color: '#ef4444', weight: 0, fillOpacity: 0.5, fillColor: '#ef4444' },
                interactive: false
             });
             coverageLayerRef.current?.addLayer(geoJsonLayer);
           }
        });
      } catch (e) {
         console.error("Coverage calculation failed", e);
      }
    }, [showCoverage, currentOperation, userLocations]);

    $1`
  );
}

// 5. Add toggle to UI
if (!content.includes('Lücken-Analyse')) {
  content = content.replace(
    /(<span className="text-slate-400 font-mono text-\[10px\] flex items-center gap-1">\s*<Eye className="w-3 h-3 text-blue-400" \/>)/,
    `<button onClick={() => setShowCoverage(!showCoverage)} className={\`mr-2 px-2 py-0.5 rounded text-[10px] font-bold font-mono transition cursor-pointer \${showCoverage ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400'}\`}>Lücken-Analyse</button>
                  $1`
  );
}

fs.writeFileSync('src/components/TacticalMap.tsx', content, 'utf8');
console.log('Coverage patched.');
