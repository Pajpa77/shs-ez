import React, { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import JsBarcode from 'jsbarcode';
import { useRescue } from '../context/RescueContext';
import { User, isUserAdmin } from '../types';
import {
  Users,
  X,
  Printer,
  Download,
  Loader2,
  Search,
  Shield,
  Phone,
  Car,
  Award,
  CheckCircle,
  FileText,
  Barcode,
} from 'lucide-react';

interface UserListPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserListPdfModal: React.FC<UserListPdfModalProps> = ({ isOpen, onClose }) => {
  const { allUsers, currentUser } = useRescue();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Filter users
  const filteredUsers = allUsers
    .filter((u) => {
      if (filterRole === 'admin' && u.role !== 'admin') return false;
      if (filterRole === 'einsatzleitung' && u.role !== 'einsatzleitung') return false;
      if (filterRole === 'responder' && u.role !== 'responder') return false;
      if (filterRole === 'active' && !u.isActive) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          u.name.toLowerCase().includes(q) ||
          u.callSign.toLowerCase().includes(q) ||
          (u.licensePlate && u.licensePlate.toLowerCase().includes(q)) ||
          (u.memberId && u.memberId.toLowerCase().includes(q)) ||
          (u.organization && u.organization.toLowerCase().includes(q))
        );
      }
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // Render barcodes for all filtered users onto their canvas elements
  useEffect(() => {
    if (!isOpen) return;

    const renderBarcodes = () => {
      filteredUsers.forEach((u) => {
        const canvas = document.getElementById(`user-barcode-canvas-${u.id}`) as HTMLCanvasElement | null;
        if (canvas) {
          const barcodeVal = u.memberId || u.callSign || u.id;
          try {
            JsBarcode(canvas, barcodeVal, {
              format: 'CODE128',
              width: 1.8,
              height: 40,
              displayValue: true,
              font: 'monospace',
              fontSize: 11,
              fontOptions: 'bold',
              textMargin: 2,
              margin: 6,
              background: '#FFFFFF',
              lineColor: '#000000',
            });
          } catch (err) {
            console.warn(`JsBarcode error for user ${u.name}:`, err);
          }
        }
      });
    };

    const t1 = setTimeout(renderBarcodes, 50);
    const t2 = setTimeout(renderBarcodes, 200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isOpen, filteredUsers]);

  if (!isOpen) return null;

  if (!isUserAdmin(currentUser)) {
    return (
      <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <div className="bg-[#1E293B] border border-red-500/50 rounded-2xl p-6 max-w-md text-center space-y-4 text-slate-100">
          <Shield className="w-10 h-10 text-red-400 mx-auto" />
          <h3 className="text-base font-bold text-white">Zugriff verweigert</h3>
          <p className="text-xs text-slate-300 font-mono">
            Die Strichcode-Mitgliederliste ist Administratoren und der Einsatzleitung vorbehalten.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs"
          >
            Schließen
          </button>
        </div>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    try {
      const element = document.getElementById('printable-user-list-pdf');
      if (!element) {
        alert('Druckvorlage konnte nicht gefunden werden.');
        setIsExportingPdf(false);
        return;
      }

      // Temporarily render clean printable wrapper
      const originalStyle = element.style.cssText;
      element.style.cssText =
        'display: block !important; position: absolute; left: -9999px; top: 0; width: 900px; background: #ffffff; color: #000000; padding: 20px;';

      await new Promise((resolve) => setTimeout(resolve, 300));

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      element.style.cssText = originalStyle;

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Einsatzkraefte_Strichcode_Verzeichnis_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('PDF Export Error:', err);
      window.print();
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[6000] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto font-sans">
      <div className="bg-[#1E293B] border border-slate-700 rounded-2xl shadow-2xl w-full max-w-5xl text-slate-100 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto">
        {/* Top Header */}
        <div className="bg-slate-900 p-4 border-b border-slate-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center font-bold">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white uppercase tracking-wide">
                Mitglieder- & Einsatzkräfteverzeichnis mit Strichcode
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Offizielles Dokument mit 1D-Barcodes zur Schnellabmessung an der EZ ({filteredUsers.length} Kräfte)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-lg disabled:opacity-50"
            >
              {isExportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span className="hidden sm:inline">{isExportingPdf ? 'Erstelle PDF...' : 'PDF Speichern'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-lg"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Drucken</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="p-3 bg-slate-900/60 border-b border-slate-700/80 flex flex-wrap items-center justify-between gap-2 shrink-0 font-mono text-xs">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Name, Funkrufname, KFZ oder Ausweisnummer filtern..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[11px]">Rolle:</span>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
            >
              <option value="all">Alle Rollen ({allUsers.length})</option>
              <option value="admin">Administratoren ({allUsers.filter((u) => u.role === 'admin').length})</option>
              <option value="einsatzleitung">Einsatzleitung ({allUsers.filter((u) => u.role === 'einsatzleitung').length})</option>
              <option value="responder">Suchkräfte / Helfer ({allUsers.filter((u) => u.role === 'responder').length})</option>
              <option value="active">Nur Aktive Online ({allUsers.filter((u) => u.isActive).length})</option>
            </select>
          </div>
        </div>

        {/* Scrollable Preview Grid inside Modal */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-[#0F172A]/50 font-sans">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredUsers.map((u) => (
              <div
                key={u.id}
                className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-md relative text-slate-900 dark:text-slate-100"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 shrink-0 flex items-center justify-center font-bold text-lg text-slate-500">
                      {u.photoUrl ? (
                        <img src={u.photoUrl} alt={u.name} className="w-full h-full object-cover" />
                      ) : (
                        u.name.charAt(0)
                      )}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{u.name}</span>
                        {u.role === 'admin' && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-950 text-red-300 font-mono font-bold">
                            ADMIN
                          </span>
                        )}
                      </h4>
                      <div className="text-xs text-blue-500 dark:text-blue-400 font-mono font-bold flex items-center gap-2 mt-0.5">
                        <span>Funk: {u.callSign}</span>
                        {u.licensePlate && <span>• KFZ: {u.licensePlate}</span>}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                        {u.organization || 'Spürhunde-Salzlandkreis e.V.'} • Ausweis: {u.memberId || u.id}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-[9px] px-2 py-0.5 rounded-full font-bold font-mono ${
                      u.isActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-slate-500/20 text-slate-400'
                    }`}
                  >
                    {u.isActive ? '● Bereitschaft' : 'Abgemeldet'}
                  </span>
                </div>

                {/* Equipment Badges */}
                {u.equipment && u.equipment.length > 0 && (
                  <div className="flex flex-wrap gap-1 text-[10px] font-mono pt-1">
                    {u.equipment.map((eq) => (
                      <span key={eq} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                        {eq === 'drone' ? '🚁 Drohne' : eq === 'k9_mantrailer' ? '🐕 Mantrailer' : eq === 'k9_area' ? '🐾 Flächenhund' : eq === 'flir' ? '🌡️ FLIR' : eq}
                      </span>
                    ))}
                  </div>
                )}

                {/* Strichcode Canvas Container */}
                <div className="bg-white p-2 rounded-xl border border-slate-300 flex flex-col items-center justify-center shadow-inner mt-2">
                  <canvas id={`user-barcode-canvas-${u.id}`} className="max-w-full h-auto" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* HIDDEN PRINTABLE DOM ELEMENT FOR PDF EXPORT & SYSTEM PRINT */}
        <div id="printable-user-list-pdf" className="hidden font-sans text-black bg-white">
          <div className="border-b-2 border-black pb-4 mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-black uppercase tracking-wide">
                SPÜRHUNDE-SALZLANDKREIS E.V.
              </h1>
              <h2 className="text-sm font-bold text-gray-700">
                Einsatzkräfte- & Mitgliederverzeichnis mit 1D-Strichcodes (Code 128)
              </h2>
              <p className="text-xs text-gray-500 font-mono mt-1">
                Hohe Straße 15, 06449 Aschersleben • Stand: {new Date().toLocaleDateString('de-DE')} • Erstellt von: {currentUser?.name || 'Administrator'}
              </p>
            </div>
            <div className="text-right text-xs font-mono border-l border-gray-300 pl-4">
              <div>Gesamtzahl: <strong>{filteredUsers.length} Kräfte</strong></div>
              <div>Dokument: <strong>SHS-ROSTER-{new Date().toISOString().slice(0, 10)}</strong></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {filteredUsers.map((u) => (
              <div
                key={u.id}
                className="border border-gray-400 p-3 rounded-lg flex flex-col justify-between bg-white text-black break-inside-avoid"
              >
                <div className="flex items-start justify-between gap-2 border-b border-gray-300 pb-2 mb-2">
                  <div>
                    <h3 className="font-bold text-sm text-black uppercase">{u.name}</h3>
                    <div className="text-xs text-blue-900 font-mono font-bold">
                      Funkrufname: {u.callSign} {u.licensePlate ? `• KFZ: ${u.licensePlate}` : ''}
                    </div>
                    <div className="text-[10px] text-gray-600 font-mono">
                      Rolle: {u.role.toUpperCase()} • Ausweis-ID: {u.memberId || u.id}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-center p-1 bg-white border border-gray-300 rounded">
                  <canvas id={`user-barcode-canvas-${u.id}-print`} className="max-w-full h-auto" />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 pt-4 border-t border-gray-400 text-[10px] text-gray-500 font-mono flex items-center justify-between">
            <span>Spürhunde-Salzlandkreis e.V. • Internes Einsatzdokument</span>
            <span>Druckdatum: {new Date().toLocaleString('de-DE')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
