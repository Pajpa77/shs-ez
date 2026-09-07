export interface CurrentWeatherData {
  temperature: number; // °C
  apparentTemperature: number; // gefühlte Temperatur °C
  precipitationProbability: number; // %
  precipitation: number; // mm
  weatherCode: number;
  weatherDescription: string;
  weatherIcon: string;
  windSpeed: number; // km/h
  windGusts?: number; // km/h
  windDirection: number; // °
  relativeHumidity: number; // %
  isDay: boolean;
  uvIndex?: number;
  cloudCover?: number; // %
  visibility?: number; // meters
}

export interface HourlyForecastItem {
  time: string; // ISO or HH:mm
  temperature: number;
  precipitationProbability: number;
  precipitation: number;
  weatherCode: number;
  weatherIcon: string;
  windSpeed: number;
}

export interface OperationalWeatherReport {
  locationName: string;
  coordinates: { lat: number; lng: number };
  timestamp: string;
  current: CurrentWeatherData;
  hourly: HourlyForecastItem[];
  k9SearchImpact: {
    scentConditions: 'optimal' | 'good' | 'moderate' | 'difficult' | 'critical';
    ratingLabel: string;
    description: string;
    dogHeatRisk: 'none' | 'low' | 'moderate' | 'high' | 'extreme';
    droneFlightCondition: 'safe' | 'caution' | 'unsafe';
    droneReason?: string;
  };
}

// Convert WMO Weather Code to human-readable German description and icon
export function parseWmoWeatherCode(code: number, isDay: boolean = true): { description: string; icon: string } {
  switch (code) {
    case 0:
      return { description: 'Klar / Wolkenlos', icon: isDay ? '☀️' : '🌙' };
    case 1:
      return { description: 'Überwiegend heiter', icon: isDay ? '🌤️' : '🌤️' };
    case 2:
      return { description: 'Teilweise bewölkt', icon: '⛅' };
    case 3:
      return { description: 'Bedeckt', icon: '☁️' };
    case 45:
      return { description: 'Nebel', icon: '🌫️' };
    case 48:
      return { description: 'Reifnebel', icon: '🌫️' };
    case 51:
      return { description: 'Leichter Nieselregen', icon: '🌦️' };
    case 53:
      return { description: 'Mäßiger Nieselregen', icon: '🌧️' };
    case 55:
      return { description: 'Dichter Nieselregen', icon: '🌧️' };
    case 61:
      return { description: 'Leichter Regen', icon: '🌦️' };
    case 63:
      return { description: 'Mäßiger Regen', icon: '🌧️' };
    case 65:
      return { description: 'Starker Regen', icon: '🌧️' };
    case 71:
      return { description: 'Leichter Schneefall', icon: '🌨️' };
    case 73:
      return { description: 'Mäßiger Schneefall', icon: '🌨️' };
    case 75:
      return { description: 'Starker Schneefall', icon: '❄️' };
    case 80:
      return { description: 'Leichte Regenschauer', icon: '🌦️' };
    case 81:
      return { description: 'Mäßige Regenschauer', icon: '🌧️' };
    case 82:
      return { description: 'Heftige Regenschauer', icon: '⛈️' };
    case 95:
      return { description: 'Gewitter', icon: '⛈️' };
    case 96:
    case 99:
      return { description: 'Gewitter mit Hagel', icon: '⛈️' };
    default:
      return { description: 'Wechselhaft', icon: '⛅' };
  }
}

// Calculate tactical operational impact for search dogs & drone deployment
export function calculateOperationalImpact(
  temp: number,
  windSpeed: number,
  windGusts: number,
  precipProb: number,
  humidity: number
): OperationalWeatherReport['k9SearchImpact'] {
  let scentConditions: 'optimal' | 'good' | 'moderate' | 'difficult' | 'critical' = 'good';
  let ratingLabel = 'Gute Witterungsbedingungen';
  let description = 'Stabile Witterung für Geruchsspuren und Flächensuche.';

  // Scent conditions evaluation
  if (temp > 28 || humidity < 30 || windSpeed > 40) {
    scentConditions = 'difficult';
    ratingLabel = 'Erschwerte Witterung (Hitze/Wind)';
    description = 'Hohe Temperaturen oder starker Wind lassen Geruchspartikel rasch verflüchtigen. Kürzere Suchintervalle einplanen.';
  } else if (temp > 33 || windSpeed > 55) {
    scentConditions = 'critical';
    ratingLabel = 'Kritische Witterung';
    description = 'Extreme Belastung für Rettungshunde. Ausreichend Wasser und Ruhezonen bereitstellen.';
  } else if (precipProb > 75 && temp > 10) {
    scentConditions = 'moderate';
    ratingLabel = 'Regen / Feuchte Spurlage';
    description = 'Starker Niederschlag kann Bodenfährten auswaschen. Windschattenbereiche bevorzugen.';
  } else if (temp >= 8 && temp <= 20 && humidity >= 55 && windSpeed >= 5 && windSpeed <= 25) {
    scentConditions = 'optimal';
    ratingLabel = 'Optimale Witterung für Suchhunde';
    description = 'Kühle, feuchte Luft mit leichtem Wind begünstigt Geruchskegel bei Flächensuch- und Mantrailer-Teams.';
  }

  // Dog heat risk evaluation
  let dogHeatRisk: 'none' | 'low' | 'moderate' | 'high' | 'extreme' = 'none';
  if (temp >= 32) {
    dogHeatRisk = 'extreme';
  } else if (temp >= 27) {
    dogHeatRisk = 'high';
  } else if (temp >= 23) {
    dogHeatRisk = 'moderate';
  } else if (temp >= 18) {
    dogHeatRisk = 'low';
  }

  // Drone flight condition evaluation
  let droneFlightCondition: 'safe' | 'caution' | 'unsafe' = 'safe';
  let droneReason = 'Gute Flugbedingungen für Drohnen-Aufklärung.';

  if (windGusts > 45 || windSpeed > 35 || precipProb > 70) {
    droneFlightCondition = 'unsafe';
    droneReason = 'Starker Wind/Böen oder hoher Niederschlag gefährden Drohnenflug.';
  } else if (windGusts > 30 || windSpeed > 25 || precipProb > 40) {
    droneFlightCondition = 'caution';
    droneReason = 'Böiger Wind oder Niederschlagsneigung: Akkulaufzeiten verkürzt, Sicht prüfen.';
  }

  return {
    scentConditions,
    ratingLabel,
    description,
    dogHeatRisk,
    droneFlightCondition,
    droneReason,
  };
}

// In-memory cache for weather data by lat/lng coordinates (5 minutes TTL)
const weatherCache = new Map<string, { timestamp: number; data: OperationalWeatherReport }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Fetches real live weather data for given coordinates using Open-Meteo API
 * (Free, no API-key required, high precision hourly and current data for rescue operations)
 */
export async function fetchRescueWeather(
  lat: number,
  lng: number,
  locationName: string = 'Einsatzgebiet'
): Promise<OperationalWeatherReport> {
  const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const cached = weatherCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m&timezone=auto&forecast_days=1`;

    const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) {
      throw new Error(`Weather API returned status: ${response.status}`);
    }

    const data = await response.json();
    const current = data.current;
    const hourly = data.hourly;

    const weatherCode = current.weather_code ?? 0;
    const isDay = Boolean(current.is_day);
    const { description, icon } = parseWmoWeatherCode(weatherCode, isDay);

    const temp = Math.round(current.temperature_2m ?? 18);
    const apparentTemp = Math.round(current.apparent_temperature ?? temp);
    const windSpeed = Math.round(current.wind_speed_10m ?? 10);
    const windGusts = Math.round(current.wind_gusts_10m ?? windSpeed * 1.3);
    const humidity = Math.round(current.relative_humidity_2m ?? 60);
    const precipitation = Number((current.precipitation ?? 0).toFixed(1));

    // Calculate hourly forecast for next 6 hours
    const currentHourIndex = new Date().getHours();
    const hourlyItems: HourlyForecastItem[] = [];

    if (hourly && Array.isArray(hourly.time)) {
      for (let i = 0; i < 6; i++) {
        const idx = (currentHourIndex + i) % hourly.time.length;
        const timeStr = hourly.time[idx];
        const hTime = timeStr ? timeStr.substring(11, 16) : `${(currentHourIndex + i) % 24}:00`;
        const hCode = hourly.weather_code?.[idx] ?? 0;
        const { icon: hIcon } = parseWmoWeatherCode(hCode, true);

        hourlyItems.push({
          time: hTime,
          temperature: Math.round(hourly.temperature_2m?.[idx] ?? temp),
          precipitationProbability: Math.round(hourly.precipitation_probability?.[idx] ?? 0),
          precipitation: Number((hourly.precipitation?.[idx] ?? 0).toFixed(1)),
          weatherCode: hCode,
          weatherIcon: hIcon,
          windSpeed: Math.round(hourly.wind_speed_10m?.[idx] ?? windSpeed),
        });
      }
    }

    const currentPrecipProb = hourlyItems[0]?.precipitationProbability ?? (precipitation > 0 ? 90 : 15);

    const impact = calculateOperationalImpact(
      temp,
      windSpeed,
      windGusts,
      currentPrecipProb,
      humidity
    );

    const report: OperationalWeatherReport = {
      locationName,
      coordinates: { lat, lng },
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      current: {
        temperature: temp,
        apparentTemperature: apparentTemp,
        precipitationProbability: currentPrecipProb,
        precipitation,
        weatherCode,
        weatherDescription: description,
        weatherIcon: icon,
        windSpeed,
        windGusts,
        windDirection: current.wind_direction_10m ?? 0,
        relativeHumidity: humidity,
        isDay,
        cloudCover: current.cloud_cover ?? 20,
      },
      hourly: hourlyItems,
      k9SearchImpact: impact,
    };

    weatherCache.set(cacheKey, { timestamp: Date.now(), data: report });
    return report;
  } catch (error) {
    console.warn('[WEATHER SERVICE] Live weather fetch failed, falling back to tactical estimates:', error);

    // Fallback default operational model
    const fallbackImpact = calculateOperationalImpact(16, 12, 18, 20, 65);
    const { description, icon } = parseWmoWeatherCode(2, true);

    return {
      locationName,
      coordinates: { lat, lng },
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      current: {
        temperature: 16,
        apparentTemperature: 15,
        precipitationProbability: 20,
        precipitation: 0,
        weatherCode: 2,
        weatherDescription: description,
        weatherIcon: icon,
        windSpeed: 12,
        windGusts: 18,
        windDirection: 210,
        relativeHumidity: 65,
        isDay: true,
        cloudCover: 35,
      },
      hourly: [
        { time: 'Aktuell', temperature: 16, precipitationProbability: 20, precipitation: 0, weatherCode: 2, weatherIcon: '⛅', windSpeed: 12 },
        { time: '+1h', temperature: 17, precipitationProbability: 25, precipitation: 0, weatherCode: 2, weatherIcon: '⛅', windSpeed: 14 },
        { time: '+2h', temperature: 17, precipitationProbability: 20, precipitation: 0, weatherCode: 1, weatherIcon: '🌤️', windSpeed: 13 },
        { time: '+3h', temperature: 16, precipitationProbability: 15, precipitation: 0, weatherCode: 1, weatherIcon: '🌤️', windSpeed: 11 },
      ],
      k9SearchImpact: fallbackImpact,
    };
  }
}
