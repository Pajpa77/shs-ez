import { SearchOperation, User, UserLocationState, TrackSummaryItem, getUserTrackColor } from '../types';

export function calculateDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Aggregiert alle Suchspuren des aktuellen Einsatzes.
 * WICHTIG:
 * 1. Gibt nur dann Spuren zurück, wenn ein Einsatz aktiv oder pausiert ist.
 *    Ohne aktiven Einsatz werden keinerlei Spuren angezeigt (saubere Karte!).
 * 2. Filtert fremde/alte Spuren heraus: Nur Punkte mit operationId === currentOperation.id
 *    und nur Teilnehmer des Einsatzes werden berücksichtigt.
 * 3. Einsatzleitung / Admins (z.B. Maria, Jens) werden nicht mehr fälschlich unterdrückt.
 */
export function computeTrackSummaries(
  currentOperation: SearchOperation | null,
  userLocations: Record<string, UserLocationState>,
  allUsers: User[]
): TrackSummaryItem[] {
  // Spuren gehören ausschließlich zu einem aktiven oder pausierten Einsatz
  if (!currentOperation || (currentOperation.status !== 'active' && currentOperation.status !== 'paused')) {
    return [];
  }

  const userMap = new Map<string, TrackSummaryItem>();
  const activeOpId = currentOperation.id;

  // 1. Frühere archivierte Phasen dieses Einsatzes (z.B. Suchphase 1)
  if (currentOperation.archivedTracks) {
    currentOperation.archivedTracks.forEach((t) => {
      if (!t.points || t.points.length < 2) return;

      const user = allUsers.find((u) => u.id === t.userId);
      const color = t.color || getUserTrackColor(user || t.userId, allUsers);
      const isDrone = Boolean(user?.equipment?.includes('drone'));

      let totalDist = 0;
      for (let i = 1; i < t.points.length; i++) {
        const d = calculateDistanceMeters(t.points[i - 1].lat, t.points[i - 1].lng, t.points[i].lat, t.points[i].lng);
        const tDiff = Math.abs(new Date(t.points[i].timestamp).getTime() - new Date(t.points[i - 1].timestamp).getTime());
        if (d <= 1200 && tDiff <= 15 * 60 * 1000) totalDist += d;
      }

      userMap.set(t.userId, {
        userId: t.userId,
        name: t.userName || user?.name || 'Suchkraft',
        callSign: t.callSign || user?.callSign || 'Unit',
        color,
        pointCount: t.points.length,
        distanceMeters: totalDist,
        isLive: false,
        isDrone,
        phaseLabel: t.phaseLabel || 'Suchphase 1 (Referenz)',
        equipmentIcon: isDrone ? '🚁' : user?.equipment?.includes('k9_mantrailer') ? '🐕' : '🚶',
        boundsPoints: t.points.map((p) => [p.lat, p.lng]),
      });
    });
  }

  // 2. Aktive / Live Spuren im aktuellen Einsatz
  Object.entries(userLocations).forEach(([userId, locState]) => {
    const user = allUsers.find((u) => u.id === userId);

    // Nur Einsatzkräfte berücksichtigen, die tatsächlich an diesem Einsatz teilnehmen oder aktiv sind!
    // Schützt vor fremden Spuren (wie alte Reste von Nicht-Teilnehmern z.B. Madleen)
    const isParticipant =
      (currentOperation.participantIds && currentOperation.participantIds.length > 0)
        ? currentOperation.participantIds.includes(userId)
        : Boolean(user?.isActive || locState.isLive);

    if (!isParticipant) {
      return;
    }

    // Nur GPS-Punkte, die explizit zum aktuellen Einsatz gehören!
    const history = (locState.trackHistory || []).filter(
      (pt) => pt.operationId === activeOpId
    );
    if (history.length < 2) return;

    const color = getUserTrackColor(user || userId, allUsers);
    const isDrone = Boolean(user?.equipment?.includes('drone'));

    const archivedForUser = currentOperation.archivedTracks?.find((at) => at.userId === userId);
    let activePoints = history;
    let hasArchived = false;

    if (archivedForUser && archivedForUser.points.length > 0) {
      hasArchived = true;
      const lastArchivedTime = new Date(archivedForUser.points[archivedForUser.points.length - 1].timestamp).getTime();
      const newer = history.filter((p) => new Date(p.timestamp).getTime() > lastArchivedTime + 2000);
      if (newer.length >= 2) {
        activePoints = newer;
      } else if (archivedForUser.points.length >= history.length) {
        if (userMap.has(userId) && locState.isLive) {
          const existing = userMap.get(userId)!;
          existing.isLive = true;
        }
        return;
      }
    }

    let activeDist = 0;
    for (let i = 1; i < activePoints.length; i++) {
      const d = calculateDistanceMeters(activePoints[i - 1].lat, activePoints[i - 1].lng, activePoints[i].lat, activePoints[i].lng);
      const tDiff = Math.abs(new Date(activePoints[i].timestamp).getTime() - new Date(activePoints[i - 1].timestamp).getTime());
      if (d <= 1200 && tDiff <= 15 * 60 * 1000) activeDist += d;
    }

    if (userMap.has(userId)) {
      // 1 User = 1 Spur zusammengefasst
      const existing = userMap.get(userId)!;
      existing.distanceMeters += activeDist;
      existing.pointCount += activePoints.length;
      existing.isLive = locState.isLive;
      existing.phaseLabel = 'Suchphase 1 + 2 (Kombiniert)';
      existing.boundsPoints = [...existing.boundsPoints, ...activePoints.map((p) => [p.lat, p.lng] as [number, number])];
    } else {
      userMap.set(userId, {
        userId,
        name: user?.name || 'Suchkraft',
        callSign: user?.callSign || 'Unit',
        color,
        pointCount: activePoints.length,
        distanceMeters: activeDist,
        isLive: locState.isLive,
        isDrone,
        phaseLabel: hasArchived ? 'Suchphase 2 (Aktiv)' : 'Suchphase (Aktiv)',
        equipmentIcon: isDrone ? '🚁' : user?.equipment?.includes('k9_mantrailer') ? '🐕' : '🚶',
        boundsPoints: activePoints.map((p) => [p.lat, p.lng]),
      });
    }
  });

  return Array.from(userMap.values());
}
