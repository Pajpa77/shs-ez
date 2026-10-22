import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { YouthUser } from '../types';
import { X, Printer, Phone, ShieldCheck, Sparkles } from 'lucide-react';

interface YouthMemberCardModalProps {
  member: YouthUser | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenEditProfile?: () => void;
}

export const YouthMemberCardModal: React.FC<YouthMemberCardModalProps> = ({
  member,
  isOpen,
  onClose,
  onOpenEditProfile,
}) => {
  const barcodeCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isOpen && member && barcodeCanvasRef.current) {
      try {
        const codeValue = member.memberCardCode || `SHS-Y-${member.pin || '101'}`;
        JsBarcode(barcodeCanvasRef.current, codeValue, {
          format: 'CODE128',
          width: 2,
          height: 48,
          displayValue: true,
          font: 'monospace',
          fontSize: 12,
          textMargin: 3,
          background: '#ffffff',
          lineColor: '#000000',
        });
      } catch (err) {
        console.warn('Barcode generation failed:', err);
      }
    }
  }, [isOpen, member]);

  if (!isOpen || !member) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-[#00083D] border-2 border-cyan-400 rounded-3xl max-w-sm w-full p-5 text-white space-y-4 shadow-2xl relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 p-1 rounded-xl text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center">
          <span className="text-[10px] font-mono text-cyan-300 font-bold uppercase tracking-wider">
            Offizieller Mitgliedsausweis
          </span>
          <h3 className="text-sm font-black text-white uppercase font-mono">
            Spürhunde Jugendgruppe
          </h3>
        </div>

        {/* ── CARD BODY ── */}
        <div
          className="rounded-2xl p-4 bg-gradient-to-b from-[#001489] to-[#000B52] border-2 border-yellow-400/90 shadow-2xl text-white relative overflow-hidden"
          style={{ minHeight: '320px' }}
        >
          {/* Top branding */}
          <div className="flex items-center justify-between border-b border-blue-400/40 pb-2 mb-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xl">🐕</span>
              <div>
                <span className="font-black text-xs uppercase tracking-tight block leading-tight">
                  Spürhunde SLK e.V.
                </span>
                <span className="text-[9px] text-cyan-200 font-mono">Nachwuchs U18</span>
              </div>
            </div>
            <span className="text-[9px] font-bold font-mono px-2 py-0.5 rounded bg-yellow-400 text-slate-950 uppercase shadow">
              Jugend
            </span>
          </div>

          {/* Member Info */}
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-14 h-14 rounded-2xl border-2 border-white flex items-center justify-center text-2xl font-black text-white shadow-lg shrink-0"
              style={{ backgroundColor: member.trackColor || '#38bdf8' }}
            >
              {member.name.charAt(0)}
            </div>

            <div className="min-w-0 flex-1">
              <h4 className="font-black text-base text-white truncate leading-tight">
                {member.name}
              </h4>
              <span className="text-xs text-cyan-300 font-mono font-bold block">
                {member.callSign || 'Jungspürer'}
              </span>
              <span className="text-[10px] text-slate-300 font-sans block mt-0.5">
                Alter: {member.age ? `${member.age} Jahre` : 'U18'}
              </span>
            </div>
          </div>

          {/* Emergency Contact */}
          {member.guardianContact && (
            <div className="p-2 rounded-xl bg-blue-950/70 border border-blue-700/60 text-[10px] text-blue-200 font-mono mb-3 flex items-center gap-1.5">
              <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="truncate">Notfall: {member.guardianContact}</span>
            </div>
          )}

          {/* Barcode Canvas */}
          <div className="bg-white p-2 rounded-xl flex flex-col items-center justify-center shadow-inner mt-2">
            <canvas ref={barcodeCanvasRef} className="max-w-full" />
            <span className="text-[9px] font-mono text-slate-700 font-bold uppercase mt-0.5">
              {member.memberCardCode || 'SHS-Y-101'}
            </span>
          </div>

          {/* Bottom badge */}
          <div className="mt-3 flex items-center justify-between text-[8px] font-mono text-blue-200/80">
            <span>Gültig für Übungsbetrieb</span>
            <span>SHS-EZ Version 7.0</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-blue-900 font-mono text-xs">
          {onOpenEditProfile ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenEditProfile();
              }}
              className="px-3 py-2 rounded-xl bg-cyan-950 hover:bg-cyan-900 border border-cyan-400 text-cyan-300 font-bold flex items-center gap-1.5 cursor-pointer shadow"
            >
              <span>✏️</span>
              <span>Profil bearbeiten</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
            >
              Schließen
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold flex items-center gap-1.5 cursor-pointer shadow"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Drucken</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
