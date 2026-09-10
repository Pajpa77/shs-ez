import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import QRCode from 'qrcode';
import { X, Download, Copy, Printer, Check, CreditCard, QrCode as QrIcon, Barcode as BarIcon } from 'lucide-react';

interface MemberCardModalProps {
  user: User;
  onClose: () => void;
}

// Code 128 B pattern definitions (width of bars and spaces for values 0..106)
const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '222311', '122221', '122122', '122221', '123221', '221221', '221122', '212212', '222112',
  '122122', '121222', '122212', '122221', '112222', '121222', '122212', '122221', '112222', '122212',
  '112222', '122212', '221122', '212212', '222112', '122122', '121222', '122212', '122221', '112222',
  '211213', '211312', '213112', '213211', '221113', '221311', '231112', '231211', '232111', '211132',
  '211331', '213131', '213311', '213113', '213312', '231131', '231311', '233111', '211412', '211214',
  '211232', '233112', '211322', '211232', '233112', '231212', '232211', '231122', '213212', '223112',
  '312131', '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321', '232121',
  '111323', '131123', '131321', '112313', '132113', '132311', '211313', '231113', '231311', '112133',
  '112331', '132131', '113123', '113321', '133121', '313121', '211331', '231311', '213131', '213311',
  '213113', '213312', '231131', '231311', '233111', '211412', '2331112' // 106 is Stop
];

/** Encodes an ASCII text into Code 128 B bar width sequence */
function generateCode128Pattern(text: string): string {
  const cleanText = text.replace(/[^\x20-\x7E]/g, '');
  if (!cleanText) return '';

  let checksum = 104; // Start B Code
  const indices: number[] = [104];

  for (let i = 0; i < cleanText.length; i++) {
    const code = cleanText.charCodeAt(i) - 32;
    indices.push(code);
    checksum += code * (i + 1);
  }

  const checkDigit = checksum % 103;
  indices.push(checkDigit);
  indices.push(106); // Stop Code

  let patternStr = '';
  indices.forEach((idx) => {
    patternStr += CODE128_PATTERNS[idx] || CODE128_PATTERNS[0];
  });

  return patternStr;
}

export const MemberCardModal: React.FC<MemberCardModalProps> = ({ user, onClose }) => {
  const [activeTab, setActiveTab] = useState<'card' | 'barcode' | 'qrcode'>('card');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const barcodeCanvasRef = useRef<HTMLCanvasElement>(null);

  const barcodeValue = user.memberId || user.id || user.username;

  // Generate QR Code
  useEffect(() => {
    QRCode.toDataURL(barcodeValue, {
      width: 400,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('QR code generation failed:', err));
  }, [barcodeValue]);

  // Draw 1D Barcode on Canvas
  useEffect(() => {
    if (!barcodeCanvasRef.current) return;
    const canvas = barcodeCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pattern = generateCode128Pattern(barcodeValue);
    if (!pattern) return;

    const barWidth = 3;
    const quietZone = 20;
    const height = 100;
    const totalWidth = pattern.split('').reduce((sum, w) => sum + parseInt(w, 10) * barWidth, 0) + quietZone * 2;

    canvas.width = totalWidth;
    canvas.height = height + 35; // Extra height for text below

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Bars
    ctx.fillStyle = '#000000';
    let currentX = quietZone;
    let isBar = true;

    for (let i = 0; i < pattern.length; i++) {
      const width = parseInt(pattern[i], 10) * barWidth;
      if (isBar) {
        ctx.fillRect(currentX, 15, width, height);
      }
      currentX += width;
      isBar = !isBar;
    }

    // Text below barcode
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(barcodeValue, canvas.width / 2, height + 30);
  }, [barcodeValue]);

  // Save Barcode / QR Code as PNG image file
  const handleDownloadPNG = () => {
    let dataUrl = '';
    let filename = '';

    if (activeTab === 'qrcode' && qrDataUrl) {
      dataUrl = qrDataUrl;
      filename = `QR_${user.name.replace(/\s+/g, '_')}_${barcodeValue}.png`;
    } else if (barcodeCanvasRef.current) {
      dataUrl = barcodeCanvasRef.current.toDataURL('image/png');
      filename = `Barcode_${user.name.replace(/\s+/g, '_')}_${barcodeValue}.png`;
    }

    if (!dataUrl) return;

    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
  };

  // Copy Barcode Image to Clipboard
  const handleCopyToClipboard = async () => {
    try {
      let canvas: HTMLCanvasElement | null = null;

      if (activeTab === 'barcode' && barcodeCanvasRef.current) {
        canvas = barcodeCanvasRef.current;
      } else if (activeTab === 'qrcode' && qrDataUrl) {
        const img = new Image();
        img.src = qrDataUrl;
        await new Promise((res) => (img.onload = res));

        canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
      }

      if (canvas) {
        canvas.toBlob(async (blob) => {
          if (blob && navigator.clipboard && 'write' in navigator.clipboard) {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } else {
            // Fallback: Copy raw text string
            await navigator.clipboard.writeText(barcodeValue);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }
        });
      } else {
        await navigator.clipboard.writeText(barcodeValue);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.warn('Direct image clipboard write failed, copying text instead:', err);
      await navigator.clipboard.writeText(barcodeValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrintCard = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#1E293B] border border-slate-700 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col text-slate-100 font-sans">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-700 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-wider">Vereinsausweis & Code-Export</h2>
              <p className="text-xs text-slate-400 font-mono">
                {user.name} ({user.callSign})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-700 bg-slate-900/40 p-1.5 gap-1.5">
          <button
            onClick={() => setActiveTab('card')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'card'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>🪪 Ausweis-Karte</span>
          </button>
          <button
            onClick={() => setActiveTab('barcode')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'barcode'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <BarIcon className="w-4 h-4" />
            <span>📊 1D Strichcode</span>
          </button>
          <button
            onClick={() => setActiveTab('qrcode')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'qrcode'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <QrIcon className="w-4 h-4" />
            <span>📱 2D QR-Code</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 flex flex-col items-center justify-center min-h-[280px]">

          {/* TAB 1: Printable Member Card (Vereinsausweis) */}
          {activeTab === 'card' && (
            <div
              ref={cardRef}
              className="w-full max-w-md bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 border-2 border-slate-600 rounded-2xl p-5 shadow-2xl relative overflow-hidden space-y-4 text-white"
            >
              <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🐾</span>
                  <div>
                    <div className="text-xs font-black uppercase tracking-wider text-blue-400">
                      {user.organization || 'Spürhunde-Salzlandkreis e.V.'}
                    </div>
                    <div className="text-[10px] text-slate-400 uppercase font-mono">Einsatzkräfte-Vereinsausweis</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  AKTIV ✓
                </span>
              </div>

              <div className="flex gap-4 items-center">
                <div className="w-20 h-24 rounded-xl bg-slate-800 border-2 border-blue-500/50 overflow-hidden shrink-0 shadow-lg flex items-center justify-center">
                  {user.photoUrl ? (
                    <img src={user.photoUrl} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-bold text-slate-400">{user.name.charAt(0)}</span>
                  )}
                </div>

                <div className="space-y-1 text-xs">
                  <div className="text-base font-bold text-white leading-tight">{user.name}</div>
                  <div className="text-blue-300 font-mono font-semibold">Funkrufname: {user.callSign}</div>
                  <div className="text-slate-300">Rolle: <span className="font-semibold uppercase">{user.role}</span></div>
                  {user.licensePlate && <div className="text-slate-400 font-mono text-[11px]">KFZ: {user.licensePlate}</div>}
                  <div className="pt-1">
                    <span className="inline-block bg-blue-950 text-blue-300 border border-blue-700 font-mono text-[11px] px-2 py-0.5 rounded font-bold">
                      Ausweis-ID: {barcodeValue}
                    </span>
                  </div>
                </div>
              </div>

              {/* Embedded Barcode at bottom of card */}
              <div className="bg-white p-2 rounded-xl flex flex-col items-center justify-center border border-slate-300">
                <img src={qrDataUrl} alt="QR Code" className="w-16 h-16" />
                <span className="text-[10px] font-mono font-bold text-slate-900 mt-0.5">{barcodeValue}</span>
              </div>
            </div>
          )}

          {/* TAB 2: 1D Barcode (Code 128) */}
          {activeTab === 'barcode' && (
            <div className="flex flex-col items-center space-y-4 w-full">
              <div className="p-4 bg-white rounded-2xl border-2 border-slate-300 shadow-xl max-w-full overflow-x-auto">
                <canvas ref={barcodeCanvasRef} className="max-w-full h-auto block" />
              </div>
              <div className="text-xs text-slate-400 font-mono text-center">
                Format: <strong className="text-white">Code 128 (1D Strichcode)</strong> • Inhalt: <strong className="text-blue-400">{barcodeValue}</strong>
              </div>
            </div>
          )}

          {/* TAB 3: 2D QR Code */}
          {activeTab === 'qrcode' && (
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 bg-white rounded-2xl border-2 border-slate-300 shadow-xl">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR Code" className="w-56 h-56 block" />
                ) : (
                  <div className="w-56 h-56 flex items-center justify-center text-slate-500 font-mono">
                    Wird generiert…
                  </div>
                )}
              </div>
              <div className="text-xs text-slate-400 font-mono text-center">
                Format: <strong className="text-white">QR-Code (2D Barcode)</strong> • Inhalt: <strong className="text-blue-400">{barcodeValue}</strong>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions (PNG Download, Copy to Clipboard, Print) */}
        <div className="p-5 border-t border-slate-700 bg-slate-900/60 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-400 font-mono">
            {activeTab === 'card' ? 'Ausweis drucken oder exportieren' : 'Code als PNG-Bild speichern / in externe Programme einfügen'}
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'card' ? (
              <button
                onClick={handlePrintCard}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow"
              >
                <Printer className="w-4 h-4" />
                <span>Ausweis Drucken</span>
              </button>
            ) : (
              <>
                <button
                  onClick={handleCopyToClipboard}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer border border-slate-700 shadow"
                  title="Bild / Code in Zwischenablage kopieren (Strg+V)"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Kopiert! ✓' : 'In Zwischenablage'}</span>
                </button>
                <button
                  onClick={handleDownloadPNG}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow"
                  title="Als Bild-Datei (PNG) herunterladen"
                >
                  <Download className="w-4 h-4" />
                  <span>Als PNG Speichern</span>
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
