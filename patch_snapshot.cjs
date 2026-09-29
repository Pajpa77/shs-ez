const fs = require('fs');

let code = fs.readFileSync('src/lib/mapSnapshotHelper.ts', 'utf8');

// 1. Update export function signatures
code = code.replace(
  /export async function captureTacticalMapScreenshot\([\s\S]*?allUsers\?: User\[\]\s*\): Promise<string \| null> \{/m,
  `export async function captureTacticalMapScreenshot(
  fallbackOperation?: SearchOperation | null,
  userLocations?: Record<string, UserLocationState>,
  allUsers?: User[],
  filterUserId?: string
): Promise<string | null> {`
);

code = code.replace(
  /export async function generateTacticalMapWithRealMap\([\s\S]*?allUsers\?: User\[\]\s*\): Promise<string> \{/m,
  `export async function generateTacticalMapWithRealMap(
  op: SearchOperation,
  userLocations?: Record<string, UserLocationState>,
  allUsers?: User[],
  filterUserId?: string
): Promise<string> {`
);

// 2. Update call inside captureTacticalMapScreenshot
code = code.replace(
  /const snap = await generateTacticalMapWithRealMap\(fallbackOperation, userLocations, allUsers\);/,
  "const snap = await generateTacticalMapWithRealMap(fallbackOperation, userLocations, allUsers, filterUserId);"
);

// 3. Update logic to filter tracks
code = code.replace(
  /if \(op\.archivedTracks\) \{[\s\S]*?tracksList\.push\(\{/m,
  `if (op.archivedTracks) {
      op.archivedTracks.forEach((t) => {
        if (filterUserId && t.userId !== filterUserId) return;
        const validPoints = t.points.filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number');
        if (validPoints.length < 2) return;

        let totalDist = 0;
        for (let i = 1; i < validPoints.length; i++) {
          const d = L.latLng(validPoints[i - 1].lat, validPoints[i - 1].lng).distanceTo(
            L.latLng(validPoints[i].lat, validPoints[i].lng)
          );
          const tDiff = validPoints[i].timestamp - validPoints[i - 1].timestamp;
          if (d <= 1200 && tDiff <= 15 * 60 * 1000) totalDist += d;
        }

        const user = usersMap.get(t.userId);
        const color = user ? getUserTrackColor(user, resolvedUsers) : '#94a3b8';

        tracksList.push({`
);

code = code.replace(
  /if \(userLocations\) \{[\s\S]*?tracksList\.push\(\{/m,
  `if (userLocations) {
      const isPhase2 = op.archivedTracks && op.archivedTracks.length > 0;
      Object.entries(userLocations).forEach(([uId, locState]) => {
        if (filterUserId && uId !== filterUserId) return;
        const activePoints = (locState.activeTrack || []).filter(
          (p) => typeof p.lat === 'number' && typeof p.lng === 'number'
        );
        if (activePoints.length >= 2) {
          let totalDist = 0;
          for (let i = 1; i < activePoints.length; i++) {
            const d = L.latLng(activePoints[i - 1].lat, activePoints[i - 1].lng).distanceTo(
              L.latLng(activePoints[i].lat, activePoints[i].lng)
            );
            const tDiff = activePoints[i].timestamp - activePoints[i - 1].timestamp;
            if (d <= 1200 && tDiff <= 15 * 60 * 1000) totalDist += d;
          }

          const user = usersMap.get(uId);
          const color = user ? getUserTrackColor(user, resolvedUsers) : '#94a3b8';

          tracksList.push({`
);

// We also need to fix generateTacticalCanvasFallback in case it's called
code = code.replace(
  /export async function generateTacticalCanvasFallback\([\s\S]*?allUsers\?: User\[\]\s*\): Promise<string> \{/m,
  `export async function generateTacticalCanvasFallback(
  op: SearchOperation,
  userLocations?: Record<string, UserLocationState>,
  allUsers?: User[],
  filterUserId?: string
): Promise<string> {`
);

code = code.replace(
  /return generateTacticalCanvasFallback\(fallbackOperation, userLocations, allUsers\);/,
  "return generateTacticalCanvasFallback(fallbackOperation, userLocations, allUsers, filterUserId);"
);

// We need to replace the filter in generateTacticalCanvasFallback
// Actually, it doesn't matter much for fallback as long as it compiles, but we can do it.
code = code.replace(
  /if \(op\.archivedTracks\) \{\s*op\.archivedTracks\.forEach\(\(t\) => \{\s*const validPoints =/m,
  `if (op.archivedTracks) {
      op.archivedTracks.forEach((t) => {
        if (filterUserId && t.userId !== filterUserId) return;
        const validPoints =`
);
code = code.replace(
  /if \(userLocations\) \{\s*const isPhase2 = op\.archivedTracks && op\.archivedTracks\.length > 0;\s*Object\.entries\(userLocations\)\.forEach\(\(\[uId, locState\]\) => \{\s*const activePoints =/m,
  `if (userLocations) {
      const isPhase2 = op.archivedTracks && op.archivedTracks.length > 0;
      Object.entries(userLocations).forEach(([uId, locState]) => {
        if (filterUserId && uId !== filterUserId) return;
        const activePoints =`
);


fs.writeFileSync('src/lib/mapSnapshotHelper.ts', code);
console.log('Patched mapSnapshotHelper.ts');
