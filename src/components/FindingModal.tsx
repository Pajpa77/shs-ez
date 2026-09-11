import React, { useState, useEffect } from 'react';
import { useRescue } from '../context/RescueContext';
import { FindingCategory, FindingUrgency, GpsPoint } from '../types';
import { VEREINSBUERO_LOCATION } from '../mockData';
import {
  AlertTriangle,
  Camera,
  MapPin,
  Upload,
  X,
  Sparkles,
  Check,
  Send,
  Video,
  FileImage,
} from 'lucide-react';

interface FindingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLocation?: GpsPoint;
}

const CATEGORIES: { id: FindingCategory; label: string; icon: string; description: string }[] = [
  { id: 'person_alive', label: 'Vermisste Person angetroffen (ansprechbar)', icon: '👤', description: 'Person ist bei Bewusstsein' },
  { id: 'person_injured', label: 'Person verletzt / Notarzt nötig', icon: '🚑', description: 'Akute medizinische Erstversorgung' },
  { id: 'clothing', label: 'Kleidungsstück / Textilfund', icon: '👕', description: 'Jacke, Mütze, Schuh, Handschuh' },
  { id: 'personal_item', label: 'Persönlicher Gegenstand (Handy/Tasche)', icon: '📱', description: 'Rucksack, Geldbörse, Schlüssel' },
  { id: 'trail_scent', label: 'Fährte / Fußspur / K9-Witterung', icon: '🐾', description: 'Spur im Schlamm, Hundeverweisen' },
  { id: 'drone_thermal', label: 'Drohnen-Wärmebild / Luftbeobachtung', icon: '🚁', description: 'Thermal-Hotspot aus der Luft' },
  { id: 'witness_tip', label: 'Zeugenhinweis vor Ort', icon: '🗣️', description: 'Passantenmeldung' },
  { id: 'other', label: 'Sonstiger Fund / Auffälligkeit', icon: '🚩', description: 'Sonstige Spurenlage' },
];

const SAMPLE_MEDIA_PRESETS = [
  {
    name: 'Rotes Kleidungsstück im Unterholz',
    url: 'https://images.unsplash.com/photo-1516762689617-e1cffcef479d?w=600&auto=format&fit=crop&q=80',
    category: 'clothing' as FindingCategory,
    title: 'Rote Jacke / Mütze am Wegesrand',
  },
  {
    name: 'Wanderstock / Persönlicher Gegenstand',
    url: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&auto=format&fit=crop&q=80',
    category: 'personal_item' as FindingCategory,
    title: 'Nordic-Walking-Stock im Moos',
  },
  {
    name: 'Fährtenfund / K9 Suchhund Verweisen',
    url: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=600&auto=format&fit=crop&q=80',
    category: 'trail_scent' as FindingCategory,
    title: 'Frischer Witterungsfund im Dickicht',
  },
  {
    name: 'Person im Wald gesichtet',
    url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=600&auto=format&fit=crop&q=80',
    category: 'person_alive' as FindingCategory,
    title: 'Sichtung einer sitzenden Person am Hang',
  },
];

export const FindingModal: React.FC<FindingModalProps> = ({
  isOpen,
  onClose,
  initialLocation,
}) => {
  const { currentUser, userLocations, reportFinding, currentOperation } = useRescue();

  const [category, setCategory] = useState<FindingCategory>('clothing');
  const [urgency, setUrgency] = useState<FindingUrgency>('high');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [capturedGps, setCapturedGps] = useState<GpsPoint | null>(null);
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Capture GPS on open
  useEffect(() => {
    if (!isOpen) return;

    if (initialLocation) {
      setCapturedGps(initialLocation);
    } else if (currentUser && userLocations[currentUser.id]) {
      setCapturedGps(userLocations[currentUser.id].currentPosition);
    } else {
      // Try browser geolocation
      setIsCapturingLocation(true);
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setCapturedGps({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              timestamp: new Date().toISOString(),
              accuracy: Math.round(pos.coords.accuracy),
            });
            setIsCapturingLocation(false);
          },
          () => {
            // Fallback to operation center
            const fallbackLat = currentOperation?.headquartersLocation?.lat || VEREINSBUERO_LOCATION.lat;
            const fallbackLng = currentOperation?.headquartersLocation?.lng || VEREINSBUERO_LOCATION.lng;
            setCapturedGps({
              lat: fallbackLat,
              lng: fallbackLng,
              timestamp: new Date().toISOString(),
              accuracy: 5,
            });
            setIsCapturingLocation(false);
          },
          {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 8000,
          }
        );
      }
    }
  }, [isOpen, initialLocation, currentUser, userLocations, currentOperation]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('video/')) {
      setMediaType('video');
    } else {
      setMediaType('image');
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setMediaUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApplyPreset = (preset: (typeof SAMPLE_MEDIA_PRESETS)[0]) => {
    setCategory(preset.category);
    setTitle(preset.title);
    setMediaUrl(preset.url);
    setMediaType('image');
    if (!description) {
      setDescription(`Fundstück vor Ort gesichert. Entspricht der Beschreibung der vermissten Person.`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!title.trim()) {
      setErrorMsg('Bitte geben Sie einen kurzen Titel für den Fund ein.');
      return;
    }

    setIsSubmitting(true);

    try {
      reportFinding({
        category,
        title: title.trim(),
        description: description.trim() || 'Fund durch Einsatzkraft vor Ort dokumentiert.',
        mediaUrl: mediaUrl || undefined,
        mediaType,
        urgency,
        location: capturedGps || undefined,
      });

      // Reset and close
      setTitle('');
      setDescription('');
      setMediaUrl('');
      setErrorMsg('');
      setIsSubmitting(false);
      onClose();
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center p-3 sm:p-4 bg-slate-100 dark:bg-slate-950/80 backdrop-blur-md overflow-y-auto font-sans">
      <div className="bg-[#1E293B] border border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl text-black dark:text-slate-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header with emergency flashing stripe */}
        <div className="bg-red-600 p-4 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-950 text-red-500 border border-red-400/50 flex items-center justify-center font-black text-xl shadow-md">
              🚨
            </div>
            <div>
              <h2 className="text-base font-bold tracking-wide uppercase">Neuer Fund / Hinweis melden</h2>
              <p className="text-xs text-red-100 font-mono">
                Sofortige Übertragung an die Einsatzleitung mit exakten GPS-Koordinaten
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg bg-black/20 hover:bg-black/40 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-950/90 border border-red-600 text-red-300 text-xs font-mono flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* GPS Coordinates Auto-Banner */}
          <div className="flex items-center justify-between bg-white dark:bg-slate-900/80 p-3 rounded-xl border border-slate-300 dark:border-slate-700">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-slate-50 dark:bg-slate-800 text-blue-400 border border-slate-300 dark:border-slate-700 flex items-center justify-center">
                <MapPin className="w-4 h-4 animate-bounce" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block font-mono">
                  ERFASSTER GPS-STANDORT DES FUNDES
                </span>
                {isCapturingLocation ? (
                  <span className="text-xs text-amber-400 font-mono animate-pulse">GPS-Signal wird ermittelt...</span>
                ) : capturedGps ? (
                  <span className="text-xs font-mono font-bold text-blue-300">
                    LAT: {capturedGps.lat.toFixed(5)} • LNG: {capturedGps.lng.toFixed(5)} (±{capturedGps.accuracy || 2}m)
                  </span>
                ) : (
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">Kein GPS verfügbar</span>
                )}
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">MELDENDE KRAFT:</span>
              <span className="text-xs font-bold text-white font-mono">{currentUser?.name} ({currentUser?.callSign})</span>
            </div>
          </div>

          {/* Dringlichkeit / Urgency */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
              Dringlichkeitsstufe / Priorität:
            </label>
            <div className="grid grid-cols-3 gap-2 font-mono">
              {[
                { id: 'standard', label: 'Normal / Hinweis', color: 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300' },
                { id: 'high', label: '⚠️ Hoch / Verdächtig', color: 'border-amber-500 bg-slate-50 dark:bg-amber-500/20 text-amber-300' },
                { id: 'critical', label: '🚨 KRITISCH / ALARM', color: 'border-red-500 bg-red-500/20 text-red-200 font-bold' },
              ].map((lvl) => (
                <button
                  type="button"
                  key={lvl.id}
                  onClick={() => setUrgency(lvl.id as FindingUrgency)}
                  className={`p-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer flex items-center justify-center text-center ${
                    urgency === lvl.id
                      ? `${lvl.color} ring-2 ring-white/30 shadow-lg`
                      : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {lvl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
              Kategorie des Fundes:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-start gap-2.5 ${
                    category === cat.id
                      ? 'bg-blue-500/20 border-blue-500 text-blue-100 ring-1 ring-blue-400'
                      : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:bg-slate-800 hover:text-slate-900 dark:text-slate-200'
                  }`}
                >
                  <span className="text-xl">{cat.icon}</span>
                  <div>
                    <div className="text-xs font-bold leading-snug">{cat.label}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">{cat.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Title & Description */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 font-mono">
                Titel / Kurzbeschreibung des Fundes *:
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="z.B. Roter Wanderhandschuh im Brombeergestrüpp entdeckt"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-black dark:text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 font-mono">
                Detaillierte Beschreibung / Zustand / Auffälligkeiten:
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Genauer Zustand, Witterungsspuren, Ausrichtung, etwaige Verletzungen oder weitere Begleitumstände..."
                className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-black dark:text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Photo / Video Attachment */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono">
                Foto / Video des Fundes übermitteln:
              </label>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Kamera, Upload oder Vorlage</span>
            </div>

            {/* Media Preview or Upload Zone */}
            {mediaUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-blue-500/50 bg-white dark:bg-slate-900 p-2">
                {mediaType === 'video' ? (
                  <video src={mediaUrl} controls className="max-h-48 w-full rounded-lg object-contain" />
                ) : (
                  <img src={mediaUrl} alt="Fundvorschau" className="max-h-48 w-full rounded-lg object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => setMediaUrl('')}
                  className="absolute top-4 right-4 p-1.5 rounded-lg bg-white dark:bg-slate-900/90 text-red-400 hover:text-red-300 border border-slate-300 dark:border-slate-700 cursor-pointer shadow"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-slate-500 rounded-xl p-4 text-center bg-white dark:bg-slate-900 transition">
                  <input
                    type="file"
                    id="finding-file"
                    accept="image/*,video/*"
                    capture="environment"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <label
                    htmlFor="finding-file"
                    className="flex flex-col items-center justify-center gap-2 cursor-pointer"
                  >
                    <div className="h-10 w-10 rounded-xl bg-slate-50 dark:bg-slate-800 text-blue-400 border border-slate-300 dark:border-slate-700 flex items-center justify-center">
                      <Camera className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-200">
                      Foto mit Smartphone-Kamera aufnehmen oder Datei wählen
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">JPG, PNG, MP4 (automatische Geotag-Verknüpfung)</span>
                  </label>
                </div>

                {/* Tactical Photo Presets for rapid simulation */}
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1 font-mono">
                    Oder Test-Fundfoto auswählen:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {SAMPLE_MEDIA_PRESETS.map((preset, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => handleApplyPreset(preset)}
                        className="p-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-slate-500 transition text-left cursor-pointer group"
                      >
                        <img
                          src={preset.url}
                          alt={preset.name}
                          className="h-14 w-full object-cover rounded mb-1 opacity-80 group-hover:opacity-100"
                        />
                        <span className="text-[9px] text-slate-700 dark:text-slate-300 font-medium block truncate leading-tight font-mono">
                          {preset.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="pt-3 border-t border-slate-300 dark:border-slate-700 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer border border-slate-300 dark:border-slate-700 uppercase tracking-wider font-mono"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider shadow-lg disabled:opacity-50 transition cursor-pointer flex items-center gap-2 font-mono"
            >
              <Send className="w-4 h-4" />
              <span>FUND AN EINSATZLEITUNG SENDEN</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
