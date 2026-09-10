import React from 'react';
import { Minus, Plus, Moon, Sun, RadioTower, GripVertical, RotateCcw } from 'lucide-react';
import { useDraggable } from '../hooks/useDraggable';

interface FloatingMapControlsBarProps {
  uiScale: number;
  setUiScale: (scale: number) => void;
  isMapLight: boolean;
  setIsMapLight: (light: boolean) => void;
  showDroneFeed: boolean;
  setShowDroneFeed: (show: boolean) => void;
  isAdmin: boolean;
}

export const FloatingMapControlsBar: React.FC<FloatingMapControlsBarProps> = ({
  uiScale,
  setUiScale,
  isMapLight,
  setIsMapLight,
  showDroneFeed,
  setShowDroneFeed,
  isAdmin,
}) => {
  const { dragRef, position, isDragging, dragProps, resetPosition } = useDraggable({
    storageKey: 'map_controls_bar',
  });

  return (
    <div
      ref={dragRef}
      {...dragProps}
      style={
        position
          ? {
              position: 'fixed',
              left: `${position.x}px`,
              top: `${position.y}px`,
              zIndex: 1200,
            }
          : undefined
      }
      className={`${
        position ? '' : 'fixed top-[56px] sm:top-[64px] right-2 sm:right-6 z-[1200]'
      } pointer-events-auto flex items-center gap-1.5 max-w-[calc(100vw-1rem)] bg-[#1E293B]/95 border border-slate-700/90 rounded-full px-2 py-1.5 sm:px-2.5 shadow-2xl backdrop-blur-md text-xs font-mono select-none ring-1 ring-white/10 text-slate-200 transition-shadow touch-none cursor-grab active:cursor-grabbing ${
        isDragging ? 'shadow-blue-500/20 scale-[1.02] cursor-grabbing' : ''
      }`}
    >
      {/* Drag Handle */}
      <div
        className="flex items-center justify-center text-slate-500 hover:text-slate-300 px-0.5 border-r border-slate-700/80 pr-1.5"
        title="Bedienelemente verschieben (Ziehen)"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </div>

      {/* UI Zoom Out */}
      <button
        type="button"
        onClick={() => setUiScale(Math.max(0.7, Number((uiScale - 0.05).toFixed(2))))}
        className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 active:bg-blue-600 text-blue-400 active:text-white transition active:scale-90 cursor-pointer border border-slate-700 shrink-0"
        title="UI Verkleinern"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>

      {/* Zoom % Indicator */}
      <span className="text-[10px] font-bold text-blue-400 min-w-[32px] text-center shrink-0">
        {Math.round(uiScale * 100)}%
      </span>

      {/* UI Zoom In */}
      <button
        type="button"
        onClick={() => setUiScale(Math.min(1.4, Number((uiScale + 0.05).toFixed(2))))}
        className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 active:bg-blue-600 text-blue-400 active:text-white transition active:scale-90 cursor-pointer border border-slate-700 shrink-0"
        title="UI Vergrößern"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>

      {/* UI Scale Reset */}
      {Math.abs(uiScale - 1.0) > 0.01 && (
        <button
          type="button"
          onClick={() => setUiScale(1.0)}
          className="text-[9px] font-bold text-slate-400 hover:text-white px-1 hover:underline cursor-pointer transition border-l border-slate-700 ml-0.5 pl-1.5 shrink-0"
          title="UI Reset (100%)"
        >
          Reset
        </button>
      )}

      <div className="w-[1px] h-4 bg-slate-700 mx-0.5 shrink-0" />

      {/* Map Tile Dark/Light Toggle */}
      <button
        type="button"
        onClick={() => setIsMapLight(!isMapLight)}
        className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 active:bg-amber-600 text-amber-400 active:text-white transition active:scale-90 cursor-pointer border border-slate-700 shrink-0"
        title={isMapLight ? 'Karte auf Dunkelmodus umschalten' : 'Karte auf Hellmodus umschalten'}
      >
        {isMapLight ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
      </button>

      {/* Admin Drone Feed Toggle */}
      {isAdmin && (
        <>
          <div className="w-[1px] h-4 bg-slate-700 mx-0.5 shrink-0" />
          <button
            type="button"
            onClick={() => setShowDroneFeed(!showDroneFeed)}
            className={`w-6 h-6 flex items-center justify-center rounded-full transition active:scale-90 cursor-pointer border shrink-0 ${
              showDroneFeed
                ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-500/50'
                : 'bg-slate-800 text-red-400 hover:bg-slate-700 border-slate-700'
            }`}
            title="Drohnen-Livestream Widget umschalten"
          >
            <RadioTower className="w-3.5 h-3.5" />
          </button>
        </>
      )}

      {/* Reset Position Button if dragged away */}
      {position && (
        <button
          type="button"
          onClick={resetPosition}
          className="text-slate-500 hover:text-slate-300 p-0.5 rounded-full hover:bg-slate-800 transition border-l border-slate-700 ml-1 pl-1"
          title="Position auf Standard zurücksetzen"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};
