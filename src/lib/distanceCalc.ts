export function calculateTotalDistance(points: {lat: number; lng: number}[]): number {
  if (!points || points.length < 2) return 0;
  
  const R = 6371e3; // Earth radius in meters
  let totalDistance = 0;
  
  for (let i = 1; i < points.length; i++) {
    const lat1 = points[i-1].lat * Math.PI / 180;
    const lat2 = points[i].lat * Math.PI / 180;
    const dLat = (points[i].lat - points[i-1].lat) * Math.PI / 180;
    const dLng = (points[i].lng - points[i-1].lng) * Math.PI / 180;

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    totalDistance += R * c;
  }
  
  return totalDistance;
}
