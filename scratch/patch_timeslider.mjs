import fs from 'fs';

let content = fs.readFileSync('src/components/TacticalMap.tsx', 'utf8');

if (!content.includes('playbackTime')) {
  content = content.replace(
    /const \[showCoverage, setShowCoverage\] = useState\(false\);/,
    "const [showCoverage, setShowCoverage] = useState(false);\n  const [playbackTime, setPlaybackTime] = useState<number | null>(null);"
  );

  // Filter track points before rendering
  content = content.replace(
    /const activeHistory = locState\.history \|\| \[\];/,
    "const activeHistory = (locState.history || []).filter(pt => playbackTime === null || new Date(pt.timestamp).getTime() <= playbackTime);"
  );
  
  content = content.replace(
    /const archivedTrack = trk;/,
    "const archivedTrack = { ...trk, points: trk.points.filter(pt => playbackTime === null || new Date(pt.timestamp).getTime() <= playbackTime) };"
  );
  
  // UI for time slider
  content = content.replace(
    /(\{\/\* DESKTOP \/ TABLET FLOATING WEATHER OVERLAY)/,
    `{/* TIME SLIDER PLAYBACK UI (Only in Archive Mode or if explicitly activated by EL) */}
      {isArchiveMode && currentOperation && currentOperation.status !== 'planned' && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-[1000] w-11/12 max-w-2xl bg-slate-900/90 backdrop-blur border border-slate-700 p-3 rounded-2xl shadow-2xl">
           <div className="flex items-center gap-3">
             <button 
               onClick={() => setPlaybackTime(null)}
               className="px-3 py-1.5 bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-bold"
             >
               Live / Vollständig
             </button>
             
             <div className="flex-1 flex flex-col">
               <div className="flex justify-between text-[10px] text-slate-400 font-mono mb-1">
                 <span>{new Date(currentOperation.createdAt).toLocaleTimeString()}</span>
                 <span className="text-amber-400 font-bold">
                   {playbackTime ? new Date(playbackTime).toLocaleTimeString() : 'Ende'}
                 </span>
                 <span>{currentOperation.completedAt ? new Date(currentOperation.completedAt).toLocaleTimeString() : 'Jetzt'}</span>
               </div>
               
               <input 
                 type="range"
                 min={new Date(currentOperation.createdAt).getTime()}
                 max={currentOperation.completedAt ? new Date(currentOperation.completedAt).getTime() : Date.now()}
                 value={playbackTime || (currentOperation.completedAt ? new Date(currentOperation.completedAt).getTime() : Date.now())}
                 onChange={(e) => setPlaybackTime(Number(e.target.value))}
                 className="w-full accent-amber-500"
               />
             </div>
           </div>
        </div>
      )}
      
      $1`
  );

  fs.writeFileSync('src/components/TacticalMap.tsx', content, 'utf8');
  console.log('Time slider patched.');
} else {
  console.log('Already patched.');
}
