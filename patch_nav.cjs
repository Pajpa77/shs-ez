const fs = require('fs');
let nav = fs.readFileSync('src/components/Navbar.tsx', 'utf8');
const replacement = `<div className="grid grid-cols-3 gap-1 pt-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (currentUser && (currentOperation?.status === 'active' || currentOperation?.status === 'paused')) setUserArrivalStatus(currentUser.id, 'in_transit');
                            }}
                            disabled={!(currentOperation?.status === 'active' || currentOperation?.status === 'paused')}
                            className={\`py-1.5 px-1 rounded-lg text-[9px] font-mono font-bold transition border cursor-pointer \${
                              !(currentOperation?.status === 'active' || currentOperation?.status === 'paused') ? 'opacity-50 cursor-not-allowed bg-slate-800 text-slate-500 border-slate-700' :
                              currentUser?.arrivalStatus === 'in_transit' || !currentUser?.arrivalStatus
                                ? 'bg-rose-700 text-white border-rose-400 shadow'
                                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                            }\`}
                          >
                            🚨 Anfahrt
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (currentUser && (currentOperation?.status === 'active' || currentOperation?.status === 'paused')) setUserArrivalStatus(currentUser.id, 'near_ez');
                            }}
                            disabled={!(currentOperation?.status === 'active' || currentOperation?.status === 'paused')}
                            className={\`py-1.5 px-1 rounded-lg text-[9px] font-mono font-bold transition border cursor-pointer \${
                              !(currentOperation?.status === 'active' || currentOperation?.status === 'paused') ? 'opacity-50 cursor-not-allowed bg-slate-800 text-slate-500 border-slate-700' :
                              currentUser?.arrivalStatus === 'near_ez'
                                ? 'bg-amber-600 text-white border-amber-400 shadow'
                                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                            }\`}
                          >
                            🟡 Im Gebiet
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (currentUser && (currentOperation?.status === 'active' || currentOperation?.status === 'paused')) setUserArrivalStatus(currentUser.id, 'ready');
                            }}
                            disabled={!(currentOperation?.status === 'active' || currentOperation?.status === 'paused')}
                            className={\`py-1.5 px-1 rounded-lg text-[9px] font-mono font-bold transition border cursor-pointer \${
                              !(currentOperation?.status === 'active' || currentOperation?.status === 'paused') ? 'opacity-50 cursor-not-allowed bg-slate-800 text-slate-500 border-slate-700' :
                              currentUser?.arrivalStatus === 'ready' || currentUser?.arrivalStatus === 'ez_reached'
                                ? 'bg-emerald-600 text-white border-emerald-400 shadow'
                                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                            }\`}
                          >
                            🟢 Bereit
                          </button>
                        </div>
                      </div>`;
nav = nav.replace(/<div className="grid grid-cols-3 gap-1 pt-0\.5">[\s\S]*?<\/div>\s*<\/div>/, replacement);
fs.writeFileSync('src/components/Navbar.tsx', nav);
console.log('Fixed Navbar buttons.');
