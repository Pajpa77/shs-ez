const fs = require('fs');
let c = fs.readFileSync('src/components/MemberCardModal.tsx', 'utf8');

c = c.replace(
  `import { User } from '../types';`,
  `import { User, isUserAdmin } from '../types';\nimport { useRescue } from '../context/RescueContext';`
);

c = c.replace(
  `export const MemberCardModal: React.FC<MemberCardModalProps> = ({ user, onClose }) => {`,
  `export const MemberCardModal: React.FC<MemberCardModalProps> = ({ user, onClose }) => {\n  const { currentUser } = useRescue();\n  const isAdmin = currentUser ? isUserAdmin(currentUser) : false;`
);

c = c.replace(
  /<div \n                onClick=\{handleDownloadPNG\}\n                className="p-4 bg-white rounded-2xl border-2 border-slate-300 shadow-xl max-w-full overflow-x-auto cursor-pointer hover:scale-\[1.02\] hover:border-blue-500 transition-all duration-200 group relative"\n                title="Klicke auf den Strichcode, um ihn sofort als PNG-Bildspeichern"\n              >/g,
  `<div \n                onClick={isAdmin ? handleDownloadPNG : undefined}\n                className={\`p-4 bg-white rounded-2xl border-2 border-slate-300 shadow-xl max-w-full overflow-x-auto transition-all duration-200 group relative \${isAdmin ? 'cursor-pointer hover:scale-[1.02] hover:border-blue-500' : ''}\`}\n                title={isAdmin ? "Klicke auf den Strichcode, um ihn sofort als PNG-Bildspeichern" : undefined}\n              >`
);

c = c.replace(
  /<div className="absolute inset-0 bg-blue-600\/10 opacity-0 group-hover:opacity-100 rounded-2xl transition flex items-center justify-center font-bold text-blue-900 text-xs font-mono">\n                  💾 Klick = PNG Speichern\n                <\/div>\n              <\/div>\n              <p className="text-\[11px\] text-emerald-400 font-mono font-semibold text-center flex items-center gap-1">\n                <span>💡 Tipp:<\/span>\n                <span>Klicke direkt auf den Strichcode, um ihn als PNG-Bilddatei herunterzuladen\.<\/span>\n              <\/p>/g,
  `{isAdmin && (\n                  <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 rounded-2xl transition flex items-center justify-center font-bold text-blue-900 text-xs font-mono">\n                    💾 Klick = PNG Speichern\n                  </div>\n                )}\n              </div>\n              {isAdmin && (\n                <p className="text-[11px] text-emerald-400 font-mono font-semibold text-center flex items-center gap-1">\n                  <span>💡 Tipp:</span>\n                  <span>Klicke direkt auf den Strichcode, um ihn als PNG-Bilddatei herunterzuladen.</span>\n                </p>\n              )}`
);

c = c.replace(
  /<div \n                onClick=\{handleDownloadPNG\}\n                className="p-4 bg-white rounded-2xl border-2 border-slate-300 shadow-xl cursor-pointer hover:scale-\[1.02\] hover:border-blue-500 transition-all duration-200 group relative"\n                title="Klicke auf den QR-Code, um ihn sofort als PNG-Bild zu speichern"\n              >/g,
  `<div \n                onClick={isAdmin ? handleDownloadPNG : undefined}\n                className={\`p-4 bg-white rounded-2xl border-2 border-slate-300 shadow-xl transition-all duration-200 group relative \${isAdmin ? 'cursor-pointer hover:scale-[1.02] hover:border-blue-500' : ''}\`}\n                title={isAdmin ? "Klicke auf den QR-Code, um ihn sofort als PNG-Bild zu speichern" : undefined}\n              >`
);

c = c.replace(
  /<div className="absolute inset-0 bg-blue-600\/10 opacity-0 group-hover:opacity-100 rounded-2xl transition flex items-center justify-center font-bold text-blue-900 text-xs font-mono">\n                  💾 Klick = PNG Speichern\n                <\/div>\n              <\/div>\n              <p className="text-\[11px\] text-emerald-400 font-mono font-semibold text-center flex items-center gap-1">\n                <span>💡 Tipp:<\/span>\n                <span>Klicke direkt auf den QR-Code, um ihn als PNG-Bilddatei herunterzuladen\.<\/span>\n              <\/p>/g,
  `{isAdmin && (\n                  <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 rounded-2xl transition flex items-center justify-center font-bold text-blue-900 text-xs font-mono">\n                    💾 Klick = PNG Speichern\n                  </div>\n                )}\n              </div>\n              {isAdmin && (\n                <p className="text-[11px] text-emerald-400 font-mono font-semibold text-center flex items-center gap-1">\n                  <span>💡 Tipp:</span>\n                  <span>Klicke direkt auf den QR-Code, um ihn als PNG-Bilddatei herunterzuladen.</span>\n                </p>\n              )}`
);

c = c.replace(
  /<div className="flex items-center gap-2">\n            <button\n              onClick=\{handleCopyToClipboard\}[\s\S]+?Als PNG Speichern<\/span>\n            <\/button>\n          <\/div>/,
  `{isAdmin && (\n          <div className="flex items-center gap-2">\n            <button\n              onClick={handleCopyToClipboard}\n              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer border border-slate-700 shadow"\n              title="Code-Bild in Zwischenablage kopieren (Strg+V)"\n            >\n              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}\n              <span>{copied ? 'Kopiert! ✓' : 'In Zwischenablage'}</span>\n            </button>\n            <button\n              onClick={handleDownloadPNG}\n              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow"\n              title="Als Bild-Datei (PNG) herunterladen"\n            >\n              <Download className="w-4 h-4" />\n              <span>Als PNG Speichern</span>\n            </button>\n          </div>\n          )}`
);

fs.writeFileSync('src/components/MemberCardModal.tsx', c);
console.log('MemberCardModal updated');
