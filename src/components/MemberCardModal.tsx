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
  const [activeTab, setActiveTab] = useState<'barcode' | 'qrcode'>('barcode');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
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
      filename = `Strichcode_${user.name.replace(/\s+/g, '_')}_${barcodeValue}.png`;
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

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn font-sans">
      <div className="bg-[#1E293B] border border-slate-700 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col text-slate-100 font-sans">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-700 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <BarIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-wider">Ausweis-Strichcode Export</h2>
              <p className="text-xs text-blue-400 font-mono font-bold">
                {user.name} ({user.callSign}) • Ausweis-ID: <span className="underline">{barcodeValue}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
            title="Schließen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-700 bg-slate-900/40 p-1.5 gap-1.5">
          <button
            onClick={() => setActiveTab('barcode')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'barcode'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <BarIcon className="w-4 h-4" />
            <span>📊 1D Strichcode (Code 128)</span>
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

        {/* Body Content - Direct Click to Save Image */}
        <div className="p-6 flex flex-col items-center justify-center min-h-[260px]">

          {/* TAB 1: 1D Barcode (Code 128) */}
          {activeTab === 'barcode' && (
            <div className="flex flex-col items-center space-y-3 w-full">
              <div 
                onClick={handleDownloadPNG}
                className="p-4 bg-white rounded-2xl border-2 border-slate-300 shadow-xl max-w-full overflow-x-auto cursor-pointer hover:scale-[1.02] hover:border-blue-500 transition-all duration-200 group relative"
                title="Klicke auf den Strichcode, um ihn sofort als PNG-Bildspeichern"
              >
                <canvas ref={barcodeCanvasRef} className="max-w-full h-auto block pointer-events-none" />
                <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 rounded-2xl transition flex items-center justify-center font-bold text-blue-900 text-xs font-mono">
                  💾 Klick = PNG Speichern
                </div>
              </div>
              <p className="text-[11px] text-emerald-400 font-mono font-semibold text-center flex items-center gap-1">
                <span>💡 Tipp:</span>
                <span>Klicke direkt auf den Strichcode, um ihn als PNG-Bilddatei herunterzuladen.</span>
              </p>
            </div>
          )}

          {/* TAB 2: 2D QR Code */}
          {activeTab === 'qrcode' && (
            <div className="flex flex-col items-center space-y-3">
              <div 
                onClick={handleDownloadPNG}
                className="p-4 bg-white rounded-2xl border-2 border-slate-300 shadow-xl cursor-pointer hover:scale-[1.02] hover:border-blue-500 transition-all duration-200 group relative"
                title="Klicke auf den QR-Code, um ihn sofort als PNG-Bild zu speichern"
              >
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR Code" className="w-56 h-56 block pointer-events-none" />
                ) : (
                  <div className="w-56 h-56 flex items-center justify-center text-slate-500 font-mono">
                    Wird generiert…
                  </div>
                )}
                <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 rounded-2xl transition flex items-center justify-center font-bold text-blue-900 text-xs font-mono">
                  💾 Klick = PNG Speichern
                </div>
              </div>
              <p className="text-[11px] text-emerald-400 font-mono font-semibold text-center flex items-center gap-1">
                <span>💡 Tipp:</span>
                <span>Klicke direkt auf den QR-Code, um ihn als PNG-Bilddatei herunterzuladen.</span>
              </p>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-700 bg-slate-900/60 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-400 font-mono">
            Code-Inhalt: <strong className="text-blue-400 font-bold">{barcodeValue}</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyToClipboard}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer border border-slate-700 shadow"
              title="Code-Bild in Zwischenablage kopieren (Strg+V)"
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
          </div>
        </div>

      </div>
    </div>
  );
};
