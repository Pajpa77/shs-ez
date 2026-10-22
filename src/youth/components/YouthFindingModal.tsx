import React, { useState } from 'react';
import { useYouth } from '../YouthContext';
import { Sparkles, MapPin, Check, X } from 'lucide-react';

interface YouthFindingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_FINDING_TAGS = [
  { label: '🧸 Übungspuppe / Zielperson', title: 'Übungspuppe gefunden' },
  { label: '🎒 Rucksack', title: 'Rucksack gefunden' },
  { label: '🧤 Kleidungsstück', title: 'Handschuh / Mütze gefunden' },
  { label: '🐾 Fährte / Spuren', title: 'Bodenfährte entdeckt' },
  { label: '📦 Sonstiger Fund', title: 'Gegenstand entdeckt' },
];

export const YouthFindingModal: React.FC<YouthFindingModalProps> = ({ isOpen, onClose }) => {
  const { reportFinding, currentYouthUser } = useYouth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    reportFinding(title.trim(), description.trim());
    onClose();
    setTitle('');
    setDescription('');
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#000B52] border-2 border-rose-500 rounded-3xl max-w-md w-full p-6 text-white space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-blue-900 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎉</span>
            <h3 className="text-base font-bold text-rose-300 font-mono">
              Fundstück melden!
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-300 font-sans">
          Super gemacht, <strong>{currentYouthUser?.name}</strong>! Was hast du gefunden? Dein GPS-Standort wird automatisch mitgespeichert.
        </p>

        {/* Quick Tags */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono text-cyan-300 uppercase block">Schnellauswahl:</span>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_FINDING_TAGS.map((tag) => (
              <button
                key={tag.title}
                type="button"
                onClick={() => setTitle(tag.title)}
                className={`px-2.5 py-1.5 rounded-xl border text-xs font-sans transition cursor-pointer ${
                  title === tag.title
                    ? 'bg-rose-600 text-white border-rose-400 font-bold shadow'
                    : 'bg-[#00083D] border-blue-900 text-slate-300 hover:text-white'
                }`}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 font-mono text-xs">
          <div>
            <label className="block text-slate-300 mb-1">Titel des Fundes:</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z.B. Puppe Max im Gebüsch entdeckt"
              className="w-full px-3 py-2.5 rounded-xl bg-[#00083D] border border-blue-900 text-white focus:outline-none focus:border-rose-400 font-sans"
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1">Details / Beschreibung (optional):</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="z.B. Puppe liegt ca. 5 Meter rechts neben dem Waldweg"
              className="w-full px-3 py-2 rounded-xl bg-[#00083D] border border-blue-900 text-white focus:outline-none focus:border-rose-400 font-sans text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-blue-900">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 cursor-pointer"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer shadow-lg flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Fund jetzt eintragen</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
