import React, { useState } from 'react';
import { YOUTH_QUIZ_QUESTIONS } from '../quizData';
import { X, Award, CheckCircle2, AlertCircle, ArrowRight, RotateCcw, Sparkles } from 'lucide-react';

interface YouthQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const YouthQuizModal: React.FC<YouthQuizModalProps> = ({ isOpen, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  if (!isOpen) return null;

  const currentQ = YOUTH_QUIZ_QUESTIONS[currentIndex];

  const handleSelectOption = (idx: number) => {
    if (isSubmitted) return;
    setSelectedOption(idx);
  };

  const handleConfirmAnswer = () => {
    if (selectedOption === null || isSubmitted) return;
    setIsSubmitted(true);
    if (selectedOption === currentQ.correctIndex) {
      setScore((prev) => prev + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex + 1 < YOUTH_QUIZ_QUESTIONS.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsSubmitted(false);
    } else {
      setIsFinished(true);
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsSubmitted(false);
    setScore(0);
    setIsFinished(false);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#00083D] border-2 border-yellow-400 rounded-3xl max-w-lg w-full p-6 text-white space-y-4 shadow-2xl relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 p-1 rounded-xl text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 border-b border-blue-900 pb-3">
          <span className="text-2xl">🐕</span>
          <div>
            <h3 className="text-base font-black text-amber-300 uppercase font-mono">
              Spürhunde-Junior Quiz
            </h3>
            <span className="text-[10px] text-cyan-300 font-mono">
              Wissenstest für den Bereitstellungsraum
            </span>
          </div>
        </div>

        {!isFinished ? (
          <div className="space-y-4 font-sans">
            {/* Progress & Score */}
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span>Frage {currentIndex + 1} von {YOUTH_QUIZ_QUESTIONS.length}</span>
              <span className="text-amber-400 font-bold">Punkte: {score} ⭐</span>
            </div>

            {/* Question */}
            <div className="p-4 rounded-2xl bg-[#000E66] border border-blue-800">
              <h4 className="font-bold text-sm sm:text-base text-white leading-snug">
                {currentQ.question}
              </h4>
            </div>

            {/* Options */}
            <div className="space-y-2">
              {currentQ.options.map((opt, idx) => {
                const isSelected = selectedOption === idx;
                const isCorrect = idx === currentQ.correctIndex;

                let btnStyle = 'bg-[#000E66] border-blue-900 text-slate-200 hover:border-blue-700';

                if (isSubmitted) {
                  if (isCorrect) {
                    btnStyle = 'bg-emerald-950 border-emerald-500 text-emerald-200 font-bold';
                  } else if (isSelected && !isCorrect) {
                    btnStyle = 'bg-red-950 border-red-500 text-red-200';
                  }
                } else if (isSelected) {
                  btnStyle = 'bg-cyan-500/20 border-cyan-400 text-white font-bold ring-2 ring-cyan-400/50';
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectOption(idx)}
                    disabled={isSubmitted}
                    className={`w-full p-3 rounded-2xl border-2 text-left text-xs transition cursor-pointer flex items-center justify-between gap-3 ${btnStyle}`}
                  >
                    <span>{opt}</span>
                    {isSubmitted && isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                    {isSubmitted && isSelected && !isCorrect && <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Explanation box */}
            {isSubmitted && (
              <div className="p-3.5 rounded-2xl bg-[#000529] border border-cyan-500/50 text-xs text-cyan-200 animate-in fade-in duration-200 space-y-1 font-mono">
                <span className="font-bold block">
                  {selectedOption === currentQ.correctIndex ? '🎉 Richtig!' : '💡 Erklärung:'}
                </span>
                <p className="font-sans text-slate-200">{currentQ.explanation}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-blue-900 font-mono text-xs">
              {!isSubmitted ? (
                <button
                  type="button"
                  onClick={handleConfirmAnswer}
                  disabled={selectedOption === null}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold cursor-pointer transition shadow"
                >
                  Antwort prüfen
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold cursor-pointer transition shadow flex items-center gap-1.5"
                >
                  <span>Weiter</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Finished screen */
          <div className="text-center py-6 space-y-4 font-sans">
            <div className="w-20 h-20 rounded-full bg-amber-500/20 border-2 border-amber-400 mx-auto flex items-center justify-center text-4xl shadow-xl">
              🏆
            </div>
            <h4 className="text-xl font-black text-white">Quiz abgeschlossen!</h4>
            <p className="text-sm text-slate-300">
              Du hast <strong className="text-amber-400 text-lg font-mono">{score}</strong> von{' '}
              <strong className="text-white text-lg font-mono">{YOUTH_QUIZ_QUESTIONS.length}</strong>{' '}
              Fragen richtig beantwortet.
            </p>

            <span className="inline-block px-4 py-1.5 rounded-full bg-emerald-950 border border-emerald-500 text-emerald-300 text-xs font-mono font-bold">
              {score >= 6 ? '🌟 Echter Spürhunde-Profi!' : '👍 Tolle Leistung, weiter so!'}
            </span>

            <div className="flex justify-center gap-3 pt-4 border-t border-blue-900 font-mono text-xs">
              <button
                type="button"
                onClick={handleRestart}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Nochmal spielen</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold cursor-pointer shadow"
              >
                Fertig
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
