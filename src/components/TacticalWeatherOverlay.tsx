import React, { useState, useEffect, useCallback } from 'react';
import {
  CloudSun,
  CloudRain,
  Wind,
  Droplets,
  Thermometer,
  Compass,
  AlertTriangle,
  Dog,
  Plane,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  X,
  Sparkles,
  Sun,
  ShieldCheck,
} from 'lucide-react';
import { OperationalWeatherReport, fetchRescueWeather } from '../lib/weatherService';

interface TacticalWeatherOverlayProps {
  lat: number;
  lng: number;
  locationTitle?: string;
  onClose?: () => void;
  isCompact?: boolean;
}

export const TacticalWeatherOverlay: React.FC<TacticalWeatherOverlayProps> = ({
  lat,
  lng,
  locationTitle = 'Einsatzort',
  onClose,
  isCompact = false,
}) => {
  const [weatherReport, setWeatherReport] = useState<OperationalWeatherReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [expanded, setExpanded] = useState<boolean>(!isCompact);
  const [activeTab, setActiveTab] = useState<'current' | 'k9' | 'forecast'>('current');

  const loadWeather = useCallback(async () => {
    if (!lat || !lng) return;
    setLoading(true);
    try {
      const data = await fetchRescueWeather(lat, lng, locationTitle);
      setWeatherReport(data);
    } catch (err) {
      console.error('Failed to load rescue weather:', err);
    } finally {
      setLoading(false);
    }
  }, [lat, lng, locationTitle]);

  useEffect(() => {
    loadWeather();
    // Auto-refresh every 10 minutes
    const interval = setInterval(loadWeather, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadWeather]);

  if (!weatherReport && loading) {
    return (
      <div className="bg-[#1E293B]/95 backdrop-blur-md border border-slate-700 rounded-2xl p-3 text-slate-200 shadow-xl flex items-center gap-2 text-xs font-mono">
        <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
        <span>Lade Einsatz-Wetterdaten...</span>
      </div>
    );
  }

  if (!weatherReport) return null;

  const { current, k9SearchImpact, hourly, timestamp } = weatherReport;

  // Visual status badge for scent conditions
  const scentBadgeColor = {
    optimal: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    good: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    moderate: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    difficult: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    critical: 'bg-red-500/20 text-red-300 border-red-500/40',
  }[k9SearchImpact.scentConditions];

  return (
    <div className="bg-[#1E293B]/95 backdrop-blur-md border border-slate-700 rounded-2xl shadow-2xl text-slate-100 flex flex-col overflow-hidden text-xs transition-all select-none">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2 p-2.5 sm:p-3 bg-slate-900/80 border-b border-slate-700/80">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl" title={current.weatherDescription}>
            {current.weatherIcon}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white text-xs truncate">{locationTitle}</span>
              <span className="text-[10px] text-slate-400 font-mono">({timestamp})</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-300 font-mono">
              <span className="font-bold text-amber-300 text-sm">{current.temperature}°C</span>
              <span className="text-slate-400">Gefühlt: {current.apparentTemperature}°C</span>
              <span className="text-blue-300 flex items-center gap-0.5">
                <CloudRain className="w-3 h-3" />
                {current.precipitationProbability}%
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={loadWeather}
            disabled={loading}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer border border-slate-700"
            title="Wetterdaten aktualisieren"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer border border-slate-700"
            title={expanded ? 'Einklappen' : 'Ausklappen'}
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer border border-slate-700"
              title="Schließen"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="p-3 space-y-3 animate-in fade-in duration-150">
          {/* Tabs */}
          <div className="flex rounded-xl bg-slate-900/90 p-1 border border-slate-800 text-[11px] font-mono">
            <button
              type="button"
              onClick={() => setActiveTab('current')}
              className={`flex-1 py-1 rounded-lg font-bold transition cursor-pointer text-center ${
                activeTab === 'current'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Aktuell
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('k9')}
              className={`flex-1 py-1 rounded-lg font-bold transition cursor-pointer flex items-center justify-center gap-1 ${
                activeTab === 'k9'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>🐕 Einsatz-Impact</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('forecast')}
              className={`flex-1 py-1 rounded-lg font-bold transition cursor-pointer text-center ${
                activeTab === 'forecast'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Vorschau (6h)
            </button>
          </div>

          {/* TAB 1: Current Weather Grid */}
          {activeTab === 'current' && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px] font-mono">
                <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800 flex items-center gap-2">
                  <Wind className="w-4 h-4 text-cyan-400 shrink-0" />
                  <div>
                    <div className="text-slate-400 text-[9px] uppercase">Wind / Böen</div>
                    <div className="font-bold text-white">
                      {current.windSpeed} <span className="text-[9px] font-normal text-slate-400">km/h</span>
                      {current.windGusts ? ` (${current.windGusts})` : ''}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800 flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-blue-400 shrink-0" />
                  <div>
                    <div className="text-slate-400 text-[9px] uppercase">Luftfeuchte</div>
                    <div className="font-bold text-white">{current.relativeHumidity}%</div>
                  </div>
                </div>

                <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800 flex items-center gap-2">
                  <CloudRain className="w-4 h-4 text-indigo-400 shrink-0" />
                  <div>
                    <div className="text-slate-400 text-[9px] uppercase">Niederschlag</div>
                    <div className="font-bold text-white">{current.precipitation} mm</div>
                  </div>
                </div>

                <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800 flex items-center gap-2">
                  <CloudSun className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <div className="text-slate-400 text-[9px] uppercase">Bewölkung</div>
                    <div className="font-bold text-white">{current.cloudCover ?? 30}%</div>
                  </div>
                </div>
              </div>

              {/* Tactical summary alert */}
              <div className={`p-2.5 rounded-xl border flex items-start gap-2 text-xs ${scentBadgeColor}`}>
                <Dog className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">{k9SearchImpact.ratingLabel}</div>
                  <div className="text-[11px] opacity-90 leading-tight mt-0.5">
                    {k9SearchImpact.description}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: K9 & Drone Operational Tactical Impact */}
          {activeTab === 'k9' && (
            <div className="space-y-2.5">
              {/* Dog Scent & Heat Assessment */}
              <div className="bg-slate-900/70 p-2.5 rounded-xl border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                  <span className="flex items-center gap-1.5">
                    <span>🐕</span> Suchhunde & Witterung
                  </span>
                  <span className={`px-2 py-0.5 rounded-full border text-[10px] font-mono ${scentBadgeColor}`}>
                    {k9SearchImpact.scentConditions.toUpperCase()}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {k9SearchImpact.description}
                </p>

                {k9SearchImpact.dogHeatRisk !== 'none' && (
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-300 bg-amber-950/40 p-1.5 rounded-lg border border-amber-800/60 font-mono">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>
                      Hitzebelastung für Hunde: <strong>{k9SearchImpact.dogHeatRisk.toUpperCase()}</strong> (Wasserpausen einlegen)
                    </span>
                  </div>
                )}
              </div>

              {/* Drone / UAS Flight Assessment */}
              <div className="bg-slate-900/70 p-2.5 rounded-xl border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                  <span className="flex items-center gap-1.5">
                    <Plane className="w-3.5 h-3.5 text-cyan-400" /> Drohnen / Flugaufklärung (UAS)
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full border text-[10px] font-mono ${
                      k9SearchImpact.droneFlightCondition === 'safe'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : k9SearchImpact.droneFlightCondition === 'caution'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-red-500/20 text-red-300 border-red-500/40'
                    }`}
                  >
                    {k9SearchImpact.droneFlightCondition === 'safe'
                      ? 'FLUG BEREIT'
                      : k9SearchImpact.droneFlightCondition === 'caution'
                      ? 'VORSICHT (WIND)'
                      : 'EINGESCHRÄNKT'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {k9SearchImpact.droneReason}
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: Hourly Tactical Forecast */}
          {activeTab === 'forecast' && (
            <div className="space-y-1.5">
              <div className="grid grid-cols-6 gap-1 text-center font-mono">
                {hourly.map((h, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-900/80 p-1.5 rounded-xl border border-slate-800 flex flex-col items-center gap-1"
                  >
                    <span className="text-[10px] text-slate-400">{h.time}</span>
                    <span className="text-base my-0.5">{h.weatherIcon}</span>
                    <span className="text-xs font-bold text-white">{h.temperature}°</span>
                    <span className="text-[9px] text-blue-300 flex items-center gap-0.5">
                      <CloudRain className="w-2.5 h-2.5" />
                      {h.precipitationProbability}%
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 text-center font-mono pt-1">
                Echtzeit-Prognose via DWD / Open-Meteo für Koordinaten {lat.toFixed(3)}, {lng.toFixed(3)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
