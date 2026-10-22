import React, { useState } from 'react';
import {
  HeartPulse,
  Sparkles,
  Award,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RotateCcw,
  BookOpen,
  Activity,
  ShieldAlert,
  ChevronRight,
  Flame,
  Droplets,
  Search,
  Compass,
  AlertTriangle,
  Tent,
  Volume2,
} from 'lucide-react';
import { YOUTH_QUIZ_QUESTIONS } from '../quizData';

export const YouthKnowledgeCenter: React.FC = () => {
  const [subTab, setSubTab] = useState<'quiz' | 'firstaid_human' | 'firstaid_dog' | 'survival'>('quiz');

  // Quiz State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  const currentQ = YOUTH_QUIZ_QUESTIONS[currentIndex];

  const handleSelectOption = (idx: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(idx);
    if (idx === currentQ.correctIndex) {
      setScore((prev) => prev + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex + 1 < YOUTH_QUIZ_QUESTIONS.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
    } else {
      setQuizFinished(true);
    }
  };

  const handleResetQuiz = () => {
    setCurrentIndex(0);
    setSelectedOption(null);
    setScore(0);
    setQuizFinished(false);
  };

  return (
    <div className="w-full flex-1 flex flex-col bg-[#00083D] text-white p-3 sm:p-6 overflow-y-auto font-sans pb-28">
      {/* Header Banner */}
      <div className="mb-4 p-4 rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-900 border border-cyan-400/50 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 flex items-center justify-center text-2xl shadow-inner shrink-0">
            🧭
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-white font-mono uppercase tracking-wide flex items-center gap-2">
              <span>Wissens-, Erste-Hilfe- &amp; Survival-Center</span>
              <span className="text-[10px] bg-amber-400 text-slate-950 px-2 py-0.5 rounded font-bold font-mono">
                U18
              </span>
            </h2>
            <p className="text-xs text-cyan-200">
              Quiz, Erste Hilfe Mensch &amp; Hund sowie Outdoor-Überlebenstipps (Salzlandkreis &amp; Harzvorland)
            </p>
          </div>
        </div>

        {/* 4 Subtabs */}
        <div className="flex flex-wrap items-center gap-1 bg-[#000529] p-1 rounded-2xl border border-blue-900 text-[11px] font-mono font-bold">
          <button
            type="button"
            onClick={() => setSubTab('quiz')}
            className={`px-3 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
              subTab === 'quiz'
                ? 'bg-amber-500 text-slate-950 shadow font-black'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Quiz</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('firstaid_human')}
            className={`px-3 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
              subTab === 'firstaid_human'
                ? 'bg-rose-600 text-white shadow font-black'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <HeartPulse className="w-3.5 h-3.5" />
            <span>1. Hilfe Mensch</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('firstaid_dog')}
            className={`px-3 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
              subTab === 'firstaid_dog'
                ? 'bg-emerald-600 text-white shadow font-black'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <span>🐕</span>
            <span>1. Hilfe Hund</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('survival')}
            className={`px-3 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
              subTab === 'survival'
                ? 'bg-cyan-500 text-slate-950 shadow font-black'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <span>🌲</span>
            <span>Survival-Tipps</span>
          </button>
        </div>
      </div>

      {/* ──────────────── TAB 1: QUIZ ──────────────── */}
      {subTab === 'quiz' && (
        <div className="space-y-4 max-w-2xl mx-auto w-full">
          {!quizFinished ? (
            <div className="p-5 sm:p-7 rounded-3xl bg-[#000E66] border border-blue-900 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-blue-800 pb-3 text-xs font-mono">
                <span className="text-cyan-300 font-bold">
                  Frage {currentIndex + 1} von {YOUTH_QUIZ_QUESTIONS.length}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-amber-950 text-amber-300 border border-amber-600 font-bold">
                  Punkte: {score} 🏆
                </span>
              </div>

              {/* Question Text */}
              <h3 className="text-base sm:text-lg font-bold text-white leading-relaxed">
                {currentQ.question}
              </h3>

              {/* Options */}
              <div className="space-y-2.5">
                {currentQ.options.map((opt, idx) => {
                  const isSelected = selectedOption === idx;
                  const isCorrect = idx === currentQ.correctIndex;
                  const showResult = selectedOption !== null;

                  let btnStyle = 'bg-[#00083D] border-blue-900 hover:border-cyan-400 text-slate-200';
                  if (showResult) {
                    if (isCorrect) {
                      btnStyle = 'bg-emerald-950 border-emerald-500 text-emerald-200 font-bold';
                    } else if (isSelected) {
                      btnStyle = 'bg-rose-950 border-rose-500 text-rose-200';
                    } else {
                      btnStyle = 'bg-[#00083D] border-blue-950 text-slate-500 opacity-50';
                    }
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={showResult}
                      onClick={() => handleSelectOption(idx)}
                      className={`w-full p-4 rounded-2xl border text-left text-xs sm:text-sm transition cursor-pointer flex items-center justify-between gap-3 ${btnStyle}`}
                    >
                      <span>{opt}</span>
                      {showResult && isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
                      {showResult && isSelected && !isCorrect && (
                        <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Explanation & Next */}
              {selectedOption !== null && (
                <div className="p-4 rounded-2xl bg-blue-950/80 border border-blue-800 space-y-3 animate-in fade-in">
                  <p className="text-xs text-blue-200 leading-relaxed font-sans">
                    💡 <strong>Erklärung:</strong> {currentQ.explanation}
                  </p>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleNext}
                      className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black font-mono text-xs uppercase flex items-center gap-1.5 transition cursor-pointer shadow"
                    >
                      <span>{currentIndex + 1 < YOUTH_QUIZ_QUESTIONS.length ? 'Nächste Frage' : 'Quiz auswerten'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 rounded-3xl bg-[#000E66] border-2 border-amber-400 shadow-2xl text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-amber-500/20 border-2 border-amber-400 mx-auto flex items-center justify-center text-4xl shadow-inner">
                🏆
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-amber-300 font-mono uppercase">
                Quiz Meisterhaft Beendet!
              </h3>
              <p className="text-sm text-slate-200">
                Du hast <strong className="text-amber-400 font-mono text-lg">{score}</strong> von{' '}
                <strong className="text-white font-mono text-lg">{YOUTH_QUIZ_QUESTIONS.length}</strong> Fragen richtig
                beantwortet.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleResetQuiz}
                  className="px-6 py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black font-mono text-xs uppercase inline-flex items-center gap-2 cursor-pointer shadow-lg"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Nochmal spielen</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ──────────────── TAB 2: ERSTE HILFE AM MENSCHEN ──────────────── */}
      {subTab === 'firstaid_human' && (
        <div className="space-y-4 max-w-4xl mx-auto w-full">
          <div className="p-4 rounded-3xl bg-rose-950/50 border border-rose-500/60 flex items-center gap-3">
            <span className="text-2xl">🚑</span>
            <div>
              <h3 className="text-sm font-bold text-rose-300 font-mono uppercase">
                Erste-Hilfe-Leitfaden: Am Menschen (Suchgelände &amp; Wald)
              </h3>
              <p className="text-xs text-slate-300">
                Die wichtigsten Schritte, wenn du im Suchsektor eine verletzte oder hilflose Person auffindest.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* 1. Eigensicherung & Notruf */}
            <div className="p-4 rounded-3xl bg-[#000E66] border border-blue-900 space-y-2.5">
              <div className="flex items-center gap-2 font-bold font-mono text-xs text-amber-300 uppercase">
                <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center text-xs">
                  1
                </span>
                <span>Eigensicherung &amp; Ruhe bewahren</span>
              </div>
              <ul className="text-xs text-slate-200 space-y-1.5 list-disc pl-4 leading-relaxed">
                <li>Gefahren prüfen: Steinschlag, herabfallende Äste, Verkehr, Gewässer.</li>
                <li><strong>Nicht alleine losrennen:</strong> Im Team bleiben und sofort die Jugendleitung per Funk oder App informieren.</li>
                <li><strong>Notruf 112:</strong> Wo ist es passiert? Was ist passiert? Wer ist betroffen?</li>
              </ul>
            </div>

            {/* 2. Bewusstsein & Atmung */}
            <div className="p-4 rounded-3xl bg-[#000E66] border border-blue-900 space-y-2.5">
              <div className="flex items-center gap-2 font-bold font-mono text-xs text-cyan-300 uppercase">
                <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-xs">
                  2
                </span>
                <span>Bewusstsein &amp; Atmung prüfen</span>
              </div>
              <ul className="text-xs text-slate-200 space-y-1.5 list-disc pl-4 leading-relaxed">
                <li>Laut ansprechen: <em>„Hallo! Können Sie mich hören?“</em></li>
                <li>Vorsichtig an beiden Schultern rütteln.</li>
                <li><strong>Kopf überstrecken</strong>, Kinn anheben, Ohr über Mund/Nase halten: 10 Sekunden lang hören, sehen, fühlen ob Atemzüge da sind.</li>
              </ul>
            </div>

            {/* 3. Stabile Seitenlage */}
            <div className="p-4 rounded-3xl bg-[#000E66] border border-blue-900 space-y-2.5">
              <div className="flex items-center gap-2 font-bold font-mono text-xs text-emerald-300 uppercase">
                <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-xs">
                  3
                </span>
                <span>Bewusstlos, aber atmet: Stabile Seitenlage</span>
              </div>
              <ul className="text-xs text-slate-200 space-y-1.5 list-disc pl-4 leading-relaxed">
                <li>Verhindert, dass die Zunge die Atemwege blockiert oder Erbrochenes in die Lunge gerät.</li>
                <li>Nahen Arm im rechten Winkel nach oben legen.</li>
                <li>Fernen Arm über die Brust ziehen und Hand an die Wange legen.</li>
                <li>Fernes Bein beugen und Person sanft zu sich herüberziehen. Kopf nackenwärts überstrecken, Mund leicht öffnen.</li>
              </ul>
            </div>

            {/* 4. Schock, Unterkühlung & Wunden */}
            <div className="p-4 rounded-3xl bg-[#000E66] border border-blue-900 space-y-2.5">
              <div className="flex items-center gap-2 font-bold font-mono text-xs text-purple-300 uppercase">
                <span className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center text-xs">
                  4
                </span>
                <span>Unterkühlung &amp; Wundversorgung</span>
              </div>
              <ul className="text-xs text-slate-200 space-y-1.5 list-disc pl-4 leading-relaxed">
                <li><strong>Rettungsdecke nutzen:</strong> Silberseite zum Körper wärmt! Gegen feuchten Waldboden isolieren.</li>
                <li><strong>Blutungen stoppen:</strong> Saubere Wundauflage auflegen und Druckverband anlegen.</li>
                <li>Gut zureden, Hand halten und niemals allein lassen, bis die Einsatzleitung eintrifft.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── TAB 3: ERSTE HILFE AM RETTUNGSHUND ──────────────── */}
      {subTab === 'firstaid_dog' && (
        <div className="space-y-4 max-w-4xl mx-auto w-full">
          <div className="p-4 rounded-3xl bg-emerald-950/50 border border-emerald-500/60 flex items-center gap-3">
            <span className="text-2xl">🐕</span>
            <div>
              <h3 className="text-sm font-bold text-emerald-300 font-mono uppercase">
                Erste-Hilfe-Leitfaden: Am Rettungshund (K9 Notfall)
              </h3>
              <p className="text-xs text-slate-300">
                Unsere Hunde arbeiten mit vollem Einsatz im Gelände. So hilfst du dem Hund bei Pfotenverletzungen, Hitzschlag oder Insektenstichen.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* 1. Vitalwerte des Hundes */}
            <div className="p-4 rounded-3xl bg-[#000E66] border border-blue-900 space-y-2.5">
              <div className="flex items-center gap-2 font-bold font-mono text-xs text-amber-300 uppercase">
                <Activity className="w-4 h-4 text-amber-400" />
                <span>Normale Vitalwerte beim Hund</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-[#00083D] border border-blue-900">
                  <span className="text-[9px] text-slate-400 block uppercase">Körpertemperatur:</span>
                  <span className="font-bold text-white text-sm">38,0 – 39,0 °C</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#00083D] border border-blue-900">
                  <span className="text-[9px] text-slate-400 block uppercase">Puls / Herzschlag:</span>
                  <span className="font-bold text-cyan-300 text-sm">70 – 120 / Min.</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#00083D] border border-blue-900">
                  <span className="text-[9px] text-slate-400 block uppercase">Atmung in Ruhe:</span>
                  <span className="font-bold text-white text-sm">15 – 30 / Min.</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#00083D] border border-blue-900">
                  <span className="text-[9px] text-slate-400 block uppercase">Schleimhaut (Zahnfleisch):</span>
                  <span className="font-bold text-emerald-300 text-sm">Rosa (gut durchblutet)</span>
                </div>
              </div>
            </div>

            {/* 2. Pfotenverband */}
            <div className="p-4 rounded-3xl bg-[#000E66] border border-blue-900 space-y-2.5">
              <div className="flex items-center gap-2 font-bold font-mono text-xs text-cyan-300 uppercase">
                <span>🐾</span>
                <span>Pfotenverletzung &amp; Pfotenverband</span>
              </div>
              <ul className="text-xs text-slate-200 space-y-1.5 list-disc pl-4 leading-relaxed">
                <li>Scherben, Dornen oder scharfe Steine können die Ballen verletzen.</li>
                <li><strong>Wichtig:</strong> Vor dem Verbinden immer Watte zwischen alle Zehen und die Daumenkralle polstern (sonst Druckstellen!).</li>
                <li>Wundauflage auf die Wunde, Verband von unten über die Pfote nach oben wickeln, elastische Binde fixieren (nicht abschnüren!).</li>
              </ul>
            </div>

            {/* 3. Überhitzung / Hitzschlag */}
            <div className="p-4 rounded-3xl bg-[#000E66] border border-blue-900 space-y-2.5">
              <div className="flex items-center gap-2 font-bold font-mono text-xs text-rose-300 uppercase">
                <Flame className="w-4 h-4 text-rose-400" />
                <span>Überhitzung / Hitzschlag beim Suchen</span>
              </div>
              <ul className="text-xs text-slate-200 space-y-1.5 list-disc pl-4 leading-relaxed">
                <li>Symptome: Extremes Hecheln, glasiger Blick, taumelnder Gang, dunkelrote Zunge.</li>
                <li><strong>Sofortmaßnahmen:</strong> Hund sofort in den Schatten bringen.</li>
                <li><strong>Vorsichtig kühlen:</strong> Pfoten und Beine mit feuchten Tüchern kühlen. Niemals eiskaltes Wasser über den Rücken schütten (Kreislaufschock!).</li>
                <li>Schluckweise handwarmes Wasser anbieten.</li>
              </ul>
            </div>

            {/* 4. Insektenstich & Giftköder */}
            <div className="p-4 rounded-3xl bg-[#000E66] border border-blue-900 space-y-2.5">
              <div className="flex items-center gap-2 font-bold font-mono text-xs text-emerald-300 uppercase">
                <ShieldAlert className="w-4 h-4 text-emerald-400" />
                <span>Wespenstich, Magendrehung &amp; Gift</span>
              </div>
              <ul className="text-xs text-slate-200 space-y-1.5 list-disc pl-4 leading-relaxed">
                <li><strong>Stich in Mund/Rachen:</strong> Sofort kühlen (Eisbeutel von außen) und sofort zum Tierarzt, da Erstickungsgefahr droht!</li>
                <li><strong>Verdacht auf Giftköder:</strong> Niemals eigenmächtig Erbrechen auslösen (Verätzungsgefahr). Reste sichern und sofort Tiernotruf!</li>
                <li><strong>Eigenschutz beachten:</strong> Ein verletzter Hund hat Schmerzen und kann aus Reflex schnappen – ruhig sprechen, Maulschlinge anlegen.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── TAB 4: SURVIVAL-TIPPS (FÜR WALD & ZELTLAGER) ──────────────── */}
      {subTab === 'survival' && (
        <div className="space-y-4 max-w-4xl mx-auto w-full">
          <div className="p-4 rounded-3xl bg-cyan-950/60 border border-cyan-400/60 flex items-center gap-3">
            <span className="text-2xl">🌲</span>
            <div>
              <h3 className="text-sm font-bold text-cyan-300 font-mono uppercase">
                Outdoor- &amp; Survival-Tipps (Salzlandkreis, Harzvorland &amp; Zeltlager)
              </h3>
              <p className="text-xs text-slate-300">
                Praktisches Wissen für Zeltlager und Notfälle im Wald: Warmhalten, Wasser filtern, Notsignale, Unterschlupf und giftige Pflanzen.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* 1. Warmhalten gegen Auskühlung */}
            <div className="p-4 rounded-3xl bg-[#000E66] border border-blue-900 space-y-2.5">
              <div className="flex items-center gap-2 font-bold font-mono text-xs text-amber-300 uppercase">
                <span>🧥</span>
                <span>Warmhalten &amp; Zwiebelprinzip</span>
              </div>
              <ul className="text-xs text-slate-200 space-y-1.5 list-disc pl-4 leading-relaxed">
                <li><strong>Bodenkälte ist der Feind:</strong> Niemals direkt auf den nackten, feuchten Boden setzen! Baue dir eine Unterlage aus trockenem Moos, Tannenzweigen oder Laub.</li>
                <li><strong>Zwiebelprinzip:</strong> Mehrere dünne Schichten wärmen viel besser als eine dicke Jacke, weil die Luft dazwischen isoliert.</li>
                <li><strong>Kopf &amp; Nacken schützen:</strong> Bis zu 30 % der Körperwärme gehen über den Kopf verloren. Mütze aufsetzen oder Kapuze hochziehen!</li>
                <li><strong>Trocken bleiben:</strong> Nassgeschwitzte Kleidung kühlt den Körper 25-mal schneller aus. Vor Überanstrengung eine Schicht ausziehen.</li>
              </ul>
            </div>

            {/* 2. Trinkwasser beschaffen & filtern */}
            <div className="p-4 rounded-3xl bg-[#000E66] border border-blue-900 space-y-2.5">
              <div className="flex items-center gap-2 font-bold font-mono text-xs text-cyan-300 uppercase">
                <Droplets className="w-4 h-4 text-cyan-400" />
                <span>Trinkwasser finden &amp; filtern</span>
              </div>
              <ul className="text-xs text-slate-200 space-y-1.5 list-disc pl-4 leading-relaxed">
                <li><strong>Faustregel:</strong> Niemals stehendes Wasser aus Pfützen oder Altwassern trinken! Immer fließendes Wasser (Bäche) bevorzugen.</li>
                <li><strong>Natur-Schichtenfilter basteln:</strong> Aus einer Plastikflasche oder Stofftuch: Oben Sand/Kies, in die Mitte Holzkohle (bindet Giftstoffe) und unten Stoff/Moos gegen Schwebeteilchen.</li>
                <li><strong>Abkochen ist Pflicht:</strong> Wasser mindestens 3 bis 5 Minuten sprudelnd kochen lassen, um Bakterien und Parasiten abzutöten.</li>
                <li><strong>Morgentau sammeln:</strong> Mit einem sauberen Baumwolltuch morgens über feuchtes Wiesen-Gras streifen und das Wasser auswringen.</li>
              </ul>
            </div>

            {/* 3. Hilfe auf sich aufmerksam machen */}
            <div className="p-4 rounded-3xl bg-[#000E66] border border-blue-900 space-y-2.5">
              <div className="flex items-center gap-2 font-bold font-mono text-xs text-rose-300 uppercase">
                <Volume2 className="w-4 h-4 text-rose-400" />
                <span>Auf sich aufmerksam machen (Notsignale)</span>
              </div>
              <ul className="text-xs text-slate-200 space-y-1.5 list-disc pl-4 leading-relaxed">
                <li><strong>Alpines Notsignal / Pfeife:</strong> 6 Signale (Töne oder Lichtblitze) innerhalb einer Minute, dann 1 Minute Pause, dann wiederholen!</li>
                <li><strong>Pfeife statt Schreien:</strong> Rufen macht schnell heiser. Die Notfallpfeife ist viel lauter und spart deine Kräfte.</li>
                <li><strong>Optische Signale:</strong> Rettungsdecke oder bunte Warnweste an einen erhöhten Ast binden (Spiegelung ist aus der Luft sichtbar!).</li>
                <li><strong>Taschenlampe nachts:</strong> Dreimal kurz, dreimal lang, dreimal kurz (SOS: · · · − − − · · ·).</li>
              </ul>
            </div>

            {/* 4. Not-Unterschlupf bauen */}
            <div className="p-4 rounded-3xl bg-[#000E66] border border-blue-900 space-y-2.5">
              <div className="flex items-center gap-2 font-bold font-mono text-xs text-emerald-300 uppercase">
                <Tent className="w-4 h-4 text-emerald-400" />
                <span>Not-Unterschlupf (Shelter) bauen</span>
              </div>
              <ul className="text-xs text-slate-200 space-y-1.5 list-disc pl-4 leading-relaxed">
                <li><strong>Standortwahl:</strong> Niemals unter morschen Bäumen (Astbruchgefahr) oder in Senken bauen (Regenwasser sammelt sich dort).</li>
                <li><strong>Schrägdach (Lean-To):</strong> Einen stabilen Hauptast zwischen zwei Bäumen einklemmen. Daran Äste im 45°-Winkel anlehnen.</li>
                <li><strong>Dach abdichten:</strong> Von unten nach oben wie Dachziegel mit dichten Tannenzweigen und Laub bedecken.</li>
                <li><strong>Nur so groß wie nötig:</strong> Je kleiner der Unterschlupf, desto besser wärmt ihn die eigene Körperwärme!</li>
              </ul>
            </div>

            {/* 5. Feuer machen (MIT STRENGER SICHERHEITSWARNUNG!) */}
            <div className="p-4 rounded-3xl bg-[#000E66] border border-blue-900 space-y-2.5">
              <div className="flex items-center gap-2 font-bold font-mono text-xs text-amber-300 uppercase">
                <Flame className="w-4 h-4 text-amber-400" />
                <span>Feuer im Notfall &amp; Brandschutz</span>
              </div>
              <div className="p-2.5 rounded-xl bg-red-950/80 border border-red-500/80 text-[11px] text-red-200 font-bold leading-snug">
                ⚠️ <strong>ACHTUNG:</strong> Niemals ohne Aufsicht der Jugendleitung Feuer machen! Im Wald herrscht im Sommer extreme Waldbrandgefahr.
              </div>
              <ul className="text-xs text-slate-200 space-y-1.5 list-disc pl-4 leading-relaxed">
                <li><strong>Feuerstelle sichern:</strong> Mindestens 3 Meter Umkreis von Laub und Ästen befreien. Steinkreis um die Feuerstelle legen.</li>
                <li><strong>Zunder:</strong> Birkenrinde (brennt auch bei Nässe!), trockenes Gras oder Wattepad aus dem Erste-Hilfe-Kasten.</li>
                <li><strong>Aufbau:</strong> Erst feine trockene Ästchen (Pyramide), dann langsam dickeres Holz nachlegen.</li>
                <li><strong>Löschwasser bereithalten:</strong> Feuer erst verlassen, wenn keine Glut mehr glimmt (mit Wasser und Erde ablöschen!).</li>
              </ul>
            </div>

            {/* 6. Giftige Pflanzen & Beeren aus unserer Region (Salzlandkreis / Mitteldeutschland) */}
            <div className="p-4 rounded-3xl bg-[#000E66] border border-blue-900 space-y-2.5">
              <div className="flex items-center gap-2 font-bold font-mono text-xs text-rose-300 uppercase">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Giftige Beeren &amp; Pflanzen (Regional)</span>
              </div>
              <div className="p-2.5 rounded-xl bg-purple-950/80 border border-purple-500/80 text-[11px] text-purple-200 font-bold leading-snug">
                🚫 <strong>GRUNDREGEL:</strong> Was du nicht 100 % sicher kennst, wird niemals in den Mund gesteckt!
              </div>
              <ul className="text-xs text-slate-200 space-y-1.5 list-disc pl-4 leading-relaxed">
                <li><strong>Tollkirsche (Atropa belladonna):</strong> Glänzend schwarze Beeren mit fünfblättrigem Kelch – extrem giftig, bereits 3 Beeren sind lebensgefährlich!</li>
                <li><strong>Gefleckter Schierling &amp; Riesen-Bärenklau:</strong> Häufig an Saale, Bode und Feldrändern – Schierling ist tödlich giftig; Bärenklau-Pflanzensaft führt bei Sonnenlicht zu schwersten Brandblasen auf der Haut.</li>
                <li><strong>Roter Holunder &amp; Eibe:</strong> Rote Eibensamen und unreife Beeren sind hochgiftig für Mensch und Hund.</li>
                <li><strong>Pilze:</strong> Grüner Knollenblätterpilz (sieht Champignons ähnlich) ist absolut tödlich. Ohne Pilzexperte niemals Waldpilze pflücken!</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
