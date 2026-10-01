const fs = require('fs');
let c = fs.readFileSync('src/components/OperationsArchive.tsx', 'utf8');

const target1 = `                    <button
                      onClick={handleExportCsv}
                      disabled={!selectedOp?.logs || selectedOp.logs.length === 0}
                      className="px-3 py-2 bg-emerald-950/70 hover:bg-emerald-900 disabled:opacity-40 disabled:cursor-not-allowed text-emerald-300 rounded-xl border border-emerald-700/60 transition flex items-center gap-1.5 cursor-pointer text-xs font-mono"
                      title="Protokoll als CSV für Microsoft Excel oder Dienstsoftware exportieren"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                      <span>CSV Export</span>
                    </button>

                    {selectedOp?.archivedTracks && selectedOp.archivedTracks.length > 0 && (
                      <button
                        onClick={() => exportOperationTracksAsGpx(selectedOp)}
                        className="px-3 py-2 bg-indigo-950/70 hover:bg-indigo-900 text-indigo-300 rounded-xl border border-indigo-700/60 transition flex items-center gap-1.5 cursor-pointer text-xs font-mono"
                        title="Alle Such- und Hundespuren als standardisiertes GPX (Garmin / QGIS / Polizei) exportieren"
                      >
                        <Download className="w-3.5 h-3.5 text-indigo-400" />
                        <span>GPX Spuren</span>
                      </button>
                    )}

                    <button
                      onClick={handlePrint}
                      disabled={isExportingPdf}
                      className="px-3 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-blue-300 rounded-xl border border-slate-300 dark:border-slate-700 transition flex items-center gap-1.5 cursor-pointer text-xs font-mono"
                      title="Offizielles Behördenprotokoll als PDF drucken / speichern"
                    >
                      {isExportingPdf ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                      ) : (
                        <Printer className="w-3.5 h-3.5 text-blue-400" />
                      )}
                      <span>{isExportingPdf ? 'Erzeuge PDF...' : 'Drucken / PDF'}</span>
                    </button>`;

const replacement1 = `                    {isAdmin && (
                      <>
                        <button
                          onClick={handleExportCsv}
                          disabled={!selectedOp?.logs || selectedOp.logs.length === 0}
                          className="px-3 py-2 bg-emerald-950/70 hover:bg-emerald-900 disabled:opacity-40 disabled:cursor-not-allowed text-emerald-300 rounded-xl border border-emerald-700/60 transition flex items-center gap-1.5 cursor-pointer text-xs font-mono"
                          title="Protokoll als CSV für Microsoft Excel oder Dienstsoftware exportieren"
                        >
                          <Download className="w-3.5 h-3.5 text-emerald-400" />
                          <span>CSV Export</span>
                        </button>

                        {selectedOp?.archivedTracks && selectedOp.archivedTracks.length > 0 && (
                          <button
                            onClick={() => exportOperationTracksAsGpx(selectedOp)}
                            className="px-3 py-2 bg-indigo-950/70 hover:bg-indigo-900 text-indigo-300 rounded-xl border border-indigo-700/60 transition flex items-center gap-1.5 cursor-pointer text-xs font-mono"
                            title="Alle Such- und Hundespuren als standardisiertes GPX (Garmin / QGIS / Polizei) exportieren"
                          >
                            <Download className="w-3.5 h-3.5 text-indigo-400" />
                            <span>GPX Spuren</span>
                          </button>
                        )}

                        <button
                          onClick={handlePrint}
                          disabled={isExportingPdf}
                          className="px-3 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-blue-300 rounded-xl border border-slate-300 dark:border-slate-700 transition flex items-center gap-1.5 cursor-pointer text-xs font-mono"
                          title="Offizielles Behördenprotokoll als PDF drucken / speichern"
                        >
                          {isExportingPdf ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                          ) : (
                            <Printer className="w-3.5 h-3.5 text-blue-400" />
                          )}
                          <span>{isExportingPdf ? 'Erzeuge PDF...' : 'Drucken / PDF'}</span>
                        </button>
                      </>
                    )}`;

const regexTarget = /<button[\s\S]*?onClick=\{handleExportCsv\}[\s\S]*?<span>\{isExportingPdf \? 'Erzeuge PDF\.\.\.' : 'Drucken \/ PDF'\}<\/span>\n                    <\/button>/;

c = c.replace(regexTarget, replacement1);

fs.writeFileSync('src/components/OperationsArchive.tsx', c);
console.log('Done');
