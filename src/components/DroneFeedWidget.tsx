import React, { useState } from 'react';
import { Video, X, Maximize2, Minimize2, RadioTower } from 'lucide-react';

interface DroneFeedWidgetProps {
  onClose: () => void;
}

export const DroneFeedWidget: React.FC<DroneFeedWidgetProps> = ({ onClose }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div 
      className={`fixed z-[1000] bottom-20 right-4 md:right-6 md:bottom-24 bg-slate-900 border-2 border-slate-700 shadow-2xl rounded-xl overflow-hidden flex flex-col transition-all duration-300 ${isExpanded ? 'w-[85vw] h-[60vh] md:w-[640px] md:h-[480px]' : 'w-[280px] h-[200px] md:w-[320px] md:h-[240px]'}`}
    >
      {/* Header Bar */}
      <div className="bg-slate-800 px-3 py-2 flex items-center justify-between border-b border-slate-700 select-none">
        <div className="flex items-center gap-2">
          <RadioTower className="w-4 h-4 text-red-500 animate-pulse" />
          <span className="text-xs font-bold font-mono text-slate-200 tracking-wider">DROHNEN-UPLINK (TEST)</span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-slate-400 hover:text-white transition cursor-pointer"
            title="Vergrößern/Verkleinern"
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-red-400 transition cursor-pointer"
            title="Schließen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Video Container */}
      <div className="flex-1 bg-black relative flex items-center justify-center">
        <div className="absolute inset-0 border-[4px] border-black/20 pointer-events-none z-10"></div>
        {/* Placeholder for RTMP/WebRTC Player */}
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none bg-black/40">
           <div className="text-[10px] font-mono text-red-500 bg-black/60 px-2 py-1 rounded mb-2 border border-red-500/30">LIVE ◉</div>
           <div className="w-12 h-12 border-2 border-slate-600 border-t-white rounded-full animate-spin mb-4"></div>
           <span className="text-xs font-mono text-slate-300">Warte auf Videosignal...</span>
           <span className="text-[9px] font-mono text-slate-500 mt-1">Server: rtmp://shs-ez.test/drone</span>
        </div>
        
        {/* Dummy Video loop for demonstration */}
        <video 
          autoPlay 
          loop 
          muted 
          playsInline
          className="w-full h-full object-cover opacity-60"
        >
          {/* Public domain aerial video from pixabay */}
          <source src="https://cdn.pixabay.com/video/2021/08/17/85378-589632870_tiny.mp4" type="video/mp4" />
        </video>
        
        {/* Tactical Crosshair Overlay */}
        <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center opacity-30">
          <div className="w-0.5 h-10 bg-green-500"></div>
          <div className="absolute h-0.5 w-10 bg-green-500"></div>
          <div className="absolute border border-green-500 w-32 h-32 rounded-full"></div>
        </div>
      </div>
    </div>
  );
};
