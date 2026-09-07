import { SearchSector } from '../types';

export const exportSectorAsKml = (sector: SearchSector) => {
  if (!sector.polygon || sector.polygon.length < 3) {
    alert('Dieser Sektor hat keine gültigen Koordinaten.');
    return;
  }

  // KML requires coordinates in Longitude,Latitude,Altitude format.
  // Leaflet provides Lat,Lng. We must flip them!
  // Also, the first and last point must be identical to close the LinearRing.
  const coords = [...sector.polygon];
  coords.push(sector.polygon[0]); // Close the polygon

  const coordinatesString = coords
    .map((point) => `${point[1]},${point[0]},0`)
    .join(' ');

  const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>SHS-EZ Sektor: ${sector.name}</name>
    <description>
      Zugewiesenes Suchgebiet für Drohne / Flächensuche.
      Status: ${sector.status}
      Erstellt: ${new Date(sector.createdAt).toLocaleString('de-DE')}
    </description>
    <Style id="sectorStyle">
      <LineStyle>
        <color>ff0000ff</color> <!-- Red (AABBGGRR) -->
        <width>2</width>
      </LineStyle>
      <PolyStyle>
        <color>4d0000ff</color> <!-- Red with 30% opacity -->
      </PolyStyle>
    </Style>
    <Placemark>
      <name>${sector.name}</name>
      <styleUrl>#sectorStyle</styleUrl>
      <Polygon>
        <tessellate>1</tessellate>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              ${coordinatesString}
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`;

  // Create a blob and trigger download
  const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  // Clean up filename
  const safeName = sector.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  a.download = `sektor_${safeName}.kml`;
  
  document.body.appendChild(a);
  a.click();
  
  // Cleanup
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
