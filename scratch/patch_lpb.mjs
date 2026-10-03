import fs from 'fs';

let content = fs.readFileSync('src/components/OperationCreatorModal.tsx', 'utf8');

// 1. State
if (!content.includes('lpbProfile')) {
  content = content.replace(
    /const \[policeCaseId, setPoliceCaseId\] = useState\(''\);/,
    "const [policeCaseId, setPoliceCaseId] = useState('');\n  const [lpbProfile, setLpbProfile] = useState<string>('');"
  );
  
  // 2. Set from targetOp
  content = content.replace(
    /setPoliceCaseId\(mp\.policeCaseId \|\| ''\);/,
    "setPoliceCaseId(mp.policeCaseId || '');\n          setLpbProfile(mp.lpbProfile || '');"
  );
  
  // 3. Save to missingPerson
  content = content.replace(
    /policeCaseId: policeCaseId\.trim\(\) \|\| undefined,/,
    "policeCaseId: policeCaseId.trim() || undefined,\n        lpbProfile: (lpbProfile as any) || undefined,"
  );
  
  // 4. UI element
  content = content.replace(
    /(<div>\s*<label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">\s*Besondere Risiken)/,
    `<div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 flex items-center gap-1.5">
                    Lost Person Behavior (LPB)
                  </label>
                  <select
                    value={lpbProfile}
                    onChange={(e) => setLpbProfile(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  >
                    <option value="">-- Kein Profil (Standard-Radien) --</option>
                    <option value="dementia">Demenz / Alzheimer (Oft Geradeaus-Lauf)</option>
                    <option value="child_1_3">Kind (1-3 Jahre) (Geringer Radius)</option>
                    <option value="child_4_6">Kind (4-6 Jahre) (Mittlerer Radius)</option>
                    <option value="autistic">Autismus (Oft von Wasser angezogen)</option>
                    <option value="despondent">Suizidal (Versteckte/Abgelegene Orte)</option>
                    <option value="hiker">Wanderer / Sportler (Großer Radius)</option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">Legt statistische Suchradien (POA) auf der Einsatzkarte fest.</p>
                </div>
                $1`
  );
  fs.writeFileSync('src/components/OperationCreatorModal.tsx', content, 'utf8');
}

// Map patching
let mapContent = fs.readFileSync('src/components/TacticalMap.tsx', 'utf8');

if (!mapContent.includes('LPB_CONFIG')) {
  mapContent = mapContent.replace(
    /const rings = \[\s*\{\s*radius: 500, label: '500m Kernzone', color: '#ef4444', dash: '4, 4', opacity: 0.35\s*\},\s*\{\s*radius: 1000, label: '1.000m Nahbereich', color: '#f59e0b', dash: '6, 6', opacity: 0.25\s*\},\s*\{\s*radius: 2000, label: '2.000m Erweiterter Suchbereich', color: '#3b82f6', dash: '8, 8', opacity: 0.15\s*\},\s*\];/,
    `
          let rings = [
            { radius: 500, label: '500m Kernzone', color: '#ef4444', dash: '4, 4', opacity: 0.35 },
            { radius: 1000, label: '1.000m Nahbereich', color: '#f59e0b', dash: '6, 6', opacity: 0.25 },
            { radius: 2000, label: '2.000m Erweiterter Suchbereich', color: '#3b82f6', dash: '8, 8', opacity: 0.15 },
          ];
          
          if (currentOperation.missingPerson?.lpbProfile) {
            const lpb = currentOperation.missingPerson.lpbProfile;
            const LPB_CONFIG: Record<string, typeof rings> = {
              'dementia': [
                { radius: 1000, label: 'Demenz: 25% (1km)', color: '#ef4444', dash: '4, 4', opacity: 0.35 },
                { radius: 2000, label: 'Demenz: 50% (2km)', color: '#f59e0b', dash: '6, 6', opacity: 0.25 },
                { radius: 4000, label: 'Demenz: 75% (4km)', color: '#3b82f6', dash: '8, 8', opacity: 0.15 }
              ],
              'child_1_3': [
                { radius: 200, label: 'Kind 1-3: 25% (200m)', color: '#ef4444', dash: '4, 4', opacity: 0.35 },
                { radius: 500, label: 'Kind 1-3: 50% (500m)', color: '#f59e0b', dash: '6, 6', opacity: 0.25 },
                { radius: 1000, label: 'Kind 1-3: 75% (1km)', color: '#3b82f6', dash: '8, 8', opacity: 0.15 }
              ],
              'child_4_6': [
                { radius: 500, label: 'Kind 4-6: 25% (500m)', color: '#ef4444', dash: '4, 4', opacity: 0.35 },
                { radius: 1000, label: 'Kind 4-6: 50% (1km)', color: '#f59e0b', dash: '6, 6', opacity: 0.25 },
                { radius: 2000, label: 'Kind 4-6: 75% (2km)', color: '#3b82f6', dash: '8, 8', opacity: 0.15 }
              ],
              'autistic': [
                { radius: 1000, label: 'Autismus: 25% (1km)', color: '#ef4444', dash: '4, 4', opacity: 0.35 },
                { radius: 2000, label: 'Autismus: 50% (2km)', color: '#f59e0b', dash: '6, 6', opacity: 0.25 },
                { radius: 3000, label: 'Autismus: 75% (3km)', color: '#3b82f6', dash: '8, 8', opacity: 0.15 }
              ],
              'despondent': [
                { radius: 500, label: 'Suizidal: 25% (500m)', color: '#ef4444', dash: '4, 4', opacity: 0.35 },
                { radius: 1500, label: 'Suizidal: 50% (1.5km)', color: '#f59e0b', dash: '6, 6', opacity: 0.25 },
                { radius: 3000, label: 'Suizidal: 75% (3km)', color: '#3b82f6', dash: '8, 8', opacity: 0.15 }
              ],
              'hiker': [
                { radius: 2000, label: 'Wanderer: 25% (2km)', color: '#ef4444', dash: '4, 4', opacity: 0.35 },
                { radius: 4000, label: 'Wanderer: 50% (4km)', color: '#f59e0b', dash: '6, 6', opacity: 0.25 },
                { radius: 8000, label: 'Wanderer: 75% (8km)', color: '#3b82f6', dash: '8, 8', opacity: 0.15 }
              ]
            };
            if (LPB_CONFIG[lpb]) rings = LPB_CONFIG[lpb];
          }`
  );
  fs.writeFileSync('src/components/TacticalMap.tsx', mapContent, 'utf8');
}

console.log('LPB patched.');
