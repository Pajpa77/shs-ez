import fs from 'fs';

const file = 'src/components/AreaPartitionModal.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('import * as turf')) {
  content = content.replace(
    /import \{ SearchSector, SectorPriority \} from '\.\.\/types';/,
    "import { SearchSector, SectorPriority } from '../types';\nimport * as turf from '@turf/turf';"
  );
}

if (!content.includes('algorithm')) {
  content = content.replace(
    /const \[sectorsY, setSectorsY\] = useState\(2\);/,
    "const [sectorsY, setSectorsY] = useState(2);\n  const [algorithm, setAlgorithm] = useState<'grid' | 'voronoi'>('voronoi');\n  const [numSectors, setNumSectors] = useState(4);"
  );
}

if (!content.includes('function generateVoronoiSectors')) {
  content = content.replace(
    /function clipPolygonToRect/,
    `function generateVoronoiSectors(polygon: [number, number][], numSectors: number): [number, number][][] {
  if (!polygon || polygon.length < 3 || numSectors < 2) return [];
  
  try {
    // Convert to GeoJSON [lng, lat]
    const closedPoly = [...polygon, polygon[0]].map(p => [p[1], p[0]]);
    const polyFeature = turf.polygon([closedPoly]);
    const polyBbox = turf.bbox(polyFeature);
    
    // Generate grid of points
    const cellSize = Math.max(turf.distance([polyBbox[0], polyBbox[1]], [polyBbox[2], polyBbox[3]]) / 30, 0.02);
    const pointGrid = turf.pointGrid(polyBbox, cellSize);
    
    // Filter points inside polygon
    const pointsInside = pointGrid.features.filter(pt => turf.booleanPointInPolygon(pt, polyFeature));
    if (pointsInside.length < numSectors) return [];
    
    // K-Means clustering
    const clustered = turf.clustersKmeans(turf.featureCollection(pointsInside), { numberOfClusters: numSectors });
    
    // Get cluster centers
    const centers = [];
    for (let i = 0; i < numSectors; i++) {
      const clusterPts = clustered.features.filter(f => f.properties?.cluster === i);
      if (clusterPts.length > 0) {
        centers.push(turf.centerOfMass(turf.featureCollection(clusterPts)));
      }
    }
    
    // Voronoi
    // Note: turf.voronoi expects a FeatureCollection of points and a bbox
    const voronoiPolygons = turf.voronoi(turf.featureCollection(centers), { bbox: polyBbox });
    
    const finalSectors: [number, number][][] = [];
    
    // Intersect Voronoi cells with original polygon
    voronoiPolygons.features.forEach(v => {
      if (!v) return;
      // @ts-ignore - Turf types can be strict
      const intersection = turf.intersect(turf.featureCollection([polyFeature, v]));
      
      if (intersection && intersection.geometry.type === 'Polygon') {
        const coords = intersection.geometry.coordinates[0];
        // Convert back to [lat, lng] and remove last duplicate point
        finalSectors.push(coords.slice(0, -1).map(p => [p[1], p[0]]));
      } else if (intersection && intersection.geometry.type === 'MultiPolygon') {
         intersection.geometry.coordinates.forEach(polyCoords => {
            finalSectors.push(polyCoords[0].slice(0, -1).map(p => [p[1], p[0]]));
         });
      }
    });
    
    return finalSectors;
  } catch (err) {
    console.error('Voronoi generation failed', err);
    return [];
  }
}

function clipPolygonToRect`
  );
}

// Inject algorithm logic into previewSectors useMemo
if (content.includes('const previewSectors = useMemo(() => {') && !content.includes('if (algorithm === \'voronoi\') {')) {
  content = content.replace(
    /const previewSectors = useMemo\(\(\) => \{\s+if \(\!polygonPoints \|\| polygonPoints\.length < 3\) return \[\];\s+const result: \[number, number\]\[\]\[\] = \[\];/,
    `const previewSectors = useMemo(() => {
    if (!polygonPoints || polygonPoints.length < 3) return [];
    
    if (algorithm === 'voronoi') {
      const generated = generateVoronoiSectors(polygonPoints, numSectors);
      return generated.map((poly, idx) => ({
        name: \`Sektor \${NATO_PHONETIC[idx % NATO_PHONETIC.length]}\`,
        polygon: poly,
        status: 'open' as const,
        priority: 'medium' as SectorPriority,
        description: 'Auto-generiert (Voronoi)',
      }));
    }
    
    const result: [number, number][][] = [];`
  );
}

// Update UI to show toggle
if (!content.includes('Algorithmus')) {
  content = content.replace(
    /(<h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Raster-Konfiguration<\/h3>)/,
    `$1
            <div className="flex bg-slate-100 dark:bg-slate-900 rounded-lg p-1">
              <button
                onClick={() => setAlgorithm('grid')}
                className={\`flex-1 text-xs font-bold py-1.5 rounded-md \${algorithm === 'grid' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-slate-500'}\`}
              >
                Gitter (Grid)
              </button>
              <button
                onClick={() => setAlgorithm('voronoi')}
                className={\`flex-1 text-xs font-bold py-1.5 rounded-md \${algorithm === 'voronoi' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-slate-500'}\`}
              >
                Organisch (Voronoi)
              </button>
            </div>
            
            {algorithm === 'voronoi' ? (
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Anzahl Sektoren ({numSectors})</label>
                <input
                  type="range"
                  min="2"
                  max="12"
                  value={numSectors}
                  onChange={(e) => setNumSectors(Number(e.target.value))}
                  className="w-full accent-blue-600 mt-2"
                />
              </div>
            ) : (`
  );
  
  content = content.replace(
    /(<div className="grid grid-cols-2 gap-4">\s+<div>\s+<label[\s\S]*?<\/div>\s+<\/div>)/,
    `$1\n            )}`
  );
}

fs.writeFileSync(file, content, 'utf8');
console.log('Voronoi patched.');
