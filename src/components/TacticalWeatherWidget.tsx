import React, { useEffect, useState } from 'react';
import { Wind, Droplets, Thermometer, Compass, CloudSun, Eye, Navigation } from 'lucide-react';
import { VEREINSBUERO_LOCATION } from '../mockData';

interface WeatherData {
  temperature: number;
  apparentTemperature: number;
  windSpeed: number; // km/h
  windDirection: number; // degrees
  windGusts: number;
  humidity: number;
  weatherCode: number;
  precipitationProbability: number;
  isDay: boolean;
}

// Convert wind direction degrees to cardinal compass direction
function getWindCompass(deg: number): { label: string; arrowRotation: number; desc: string } {
  const directions = ['N', 'NNO', 'NO', 'ONO', 'O', 'OSO', 'SO', 'SSO', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const idx = Math.round(deg / 22.5) % 16;
  return {
    label: directions[idx],
    arrowRotation: deg,
    desc: `Wind weht aus ${deg}° (${directions[idx]})`,
  };
}

// Calculate Mantrailer Scent Drift angle (Downwind direction)
function getScentDriftCompass(deg: number): { label: string; arrowRotation: number } {
  // Scent drifts DOWNWIND (opposite to wind origin: deg + 180)
  const driftDeg = (deg + 180) % 360;
  const directions = ['N', 'NNO', 'NO', 'ONO', 'O', 'OSO', 'SO', 'SSO', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const idx = Math.round(driftDeg / 22.5) % 16;
  return {
    label: directions[idx],
    arrowRotation: driftDeg,
  };
}

function getWeatherDescription(code: number): string {
  if (code === 0) return 'Klarer Himmel';
  if (code === 1 || code === 2) return 'Leicht bewölkt';
  if (code === 3) return 'Bedeckt';
  if (code >= 45 && code <= 48) return 'Nebel / Dunst';
  if (code >= 51 && code <= 55) return 'Nieselregen';
  if (code >= 61 && code <= 65) return 'Regen';
  if (code >= 71 && code <= 77) return 'Schneefall';
  if (code >= 80 && code <= 82) return 'Regenschauer';
  if (code >= 95) return 'Gewitter';
  return 'Trocken';
}

interface TacticalWeatherWidgetProps {
  lat?: number;
  lng?: number;
}

export const TacticalWeatherWidget: React.FC<TacticalWeatherWidgetProps> = ({
  lat = VEREINSBUERO_LOCATION.lat,
  lng = VEREINSBUERO_LOCATION.lng,
}) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  useEffect(() => {
    let isCancelled = false;

    async function fetchLiveWeather() {
      try {
        setLoading(true);
        // Free, open weather API without API-Key needed
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m&timezone=auto`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Weather API request failed');
        const data = await res.json();

        if (!isCancelled && data.current) {
          setWeather({
            temperature: Math.round(data.current.temperature_2m),
            apparentTemperature: Math.round(data.current.apparent_temperature),
            windSpeed: Math.round(data.current.wind_speed_10m),
            windDirection: Math.round(data.current.wind_direction_10m),
            windGusts: Math.round(data.current.wind_gusts_10m || data.current.wind_speed_10m * 1.3),
            humidity: Math.round(data.current.relative_humidity_2m),
            weatherCode: data.current.weather_code,
            precipitationProbability: Math.round(data.current.precipitation || 0),
            isDay: data.current.is_day === 1,
          });
        }
      } catch (err) {
        console.warn('Weather fetch fallback:', err);
        if (!isCancelled) {
          // Fallback realistic SAR conditions
          setWeather({
            temperature: 15,
            apparentTemperature: 14,
            windSpeed: 12,
            windDirection: 240,
            windGusts: 18,
            humidity: 68,
            weatherCode: 2,
            precipitationProbability: 10,
            isDay: true,
          });
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    fetchLiveWeather();
    const interval = setInterval(fetchLiveWeather, 1000 * 60 * 10); // Update every 10 min

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [lat, lng]);

  if (!weather) return null;

  const windInfo = getWindCompass(weather.windDirection);
  const scentDrift = getScentDriftCompass(weather.windDirection);
  const isDroneWarning = weather.windGusts >= 35; // Drohnen-Einsatzgrenze (UAS limit)

  return (
    <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-xl text-slate-200 overflow-hidden font-sans">
      {/* Header Bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-slate-800/60 transition select-none"
      >
        <div className="flex items-center gap-2">
          <CloudSun className="w-4 h-4 text-amber-400" />
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs font-mono text-white tracking-wider">
              {weather.temperature}°C
            </span>
            <span className="text-[11px] text-slate-400 truncate max-w-[120px]">
              {getWeatherDescription(weather.weatherCode)}
            </span>
          </div>
        </div>

        {/* Quick Wind Badge */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[11px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800">
            <Navigation
              className="w-3 h-3 transform transition-transform"
              style={{ transform: `rotate(${windInfo.arrowRotation}deg)` }}
            />
            <span>{windInfo.label} {weather.windSpeed} km/h</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">{isExpanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Expanded Tactical Details (for K9 Scent Drift & Drone limits) */}
      {isExpanded && (
        <div className="p-3 pt-1 border-t border-slate-800 text-xs space-y-2.5 bg-slate-950/40">
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            {/* Wind & Gusts */}
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                <Wind className="w-3.5 h-3.5 text-blue-400" />
                <span className="font-bold uppercase text-[10px]">Wind & Böen</span>
              </div>
              <div className="font-mono text-slate-200 font-bold">
                {weather.windSpeed} km/h (Böen: {weather.windGusts} km/h)
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Richtung: {windInfo.label} ({weather.windDirection}°)
              </div>
            </div>

            {/* Scent Drift for Mantrailer */}
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-1.5 text-orange-400 mb-1">
                <Compass className="w-3.5 h-3.5 text-orange-400" />
                <span className="font-bold uppercase text-[10px]">🐕 Geruchsabdrift</span>
              </div>
              <div className="font-mono text-orange-300 font-bold flex items-center gap-1">
                <Navigation
                  className="w-3 h-3"
                  style={{ transform: `rotate(${scentDrift.arrowRotation}deg)` }}
                />
                <span>Richtung {scentDrift.label}</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                K9-Suchkegel leeseitig ansetzen
              </div>
            </div>
          </div>

          {/* Additional telemetry */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 font-mono">
            <span className="flex items-center gap-1">
              <Droplets className="w-3 h-3 text-cyan-400" /> Feuchte: {weather.humidity}%
            </span>
            <span className="flex items-center gap-1">
              <Thermometer className="w-3 h-3 text-amber-400" /> Gefühlt: {weather.apparentTemperature}°C
            </span>
          </div>

          {/* Drone Operational Safety Warning */}
          {isDroneWarning && (
            <div className="p-2 rounded-lg bg-red-950/80 border border-red-600 text-red-200 text-[10px] font-mono flex items-center gap-1.5">
              <span>⚠️</span>
              <span><strong>Drohnenwarnung:</strong> Böen &gt; 35 km/h. UAS-Einsatzgrenzen beachten!</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
