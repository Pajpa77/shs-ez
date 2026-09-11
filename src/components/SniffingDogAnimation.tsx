import React from 'react';

export const SniffingDogAnimation: React.FC = () => {
  return (
    <div className="fixed bottom-0 left-0 right-0 h-36 pointer-events-none z-[9999] overflow-hidden select-none">
      {/* Continuous Animated Neon Rainbow Ground Line */}
      <div className="absolute bottom-[18px] left-0 right-0 h-[3.5px] animate-rainbow-ground" />

      {/* Walking Dog Outer Container: Travels 100% Screen Width from Far-Right to Far-Left */}
      <div className="absolute bottom-[6px] left-0 animate-dog-walk-across flex items-end">
        {/* German Shepherd in Dynamic Animated Neon Rainbow Gradient */}
        <svg
          width="240"
          height="140"
          viewBox="0 0 240 140"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="animate-rainbow-dog-glow overflow-visible"
        >
          <defs>
            {/* Dynamic Multi-Color Neon Rainbow Linear Gradient */}
            <linearGradient id="neonRainbowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00f0ff" />
              <stop offset="20%" stopColor="#3b82f6" />
              <stop offset="40%" stopColor="#a855f7" />
              <stop offset="60%" stopColor="#ec4899" />
              <stop offset="80%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>

            <style>{`
              /* Ground Line Animated Neon Gradient Shift */
              @keyframes rainbowGroundShift {
                0% {
                  background: linear-gradient(90deg, #00f0ff, #a855f7, #ec4899, #f97316, #eab308, #10b981, #00f0ff);
                  background-size: 200% 100%;
                  background-position: 0% 50%;
                  box-shadow: 0 0 16px rgba(0, 240, 255, 0.95);
                }
                50% {
                  background-position: 100% 50%;
                  box-shadow: 0 0 22px rgba(236, 72, 153, 0.98);
                }
                100% {
                  background-position: 200% 50%;
                  box-shadow: 0 0 16px rgba(0, 240, 255, 0.95);
                }
              }

              /* Dynamic Rainbow Glow & Hue Rotation for Dog Vector */
              @keyframes rainbowDogHueShift {
                0% {
                  filter: hue-rotate(0deg) drop-shadow(0 0 16px rgba(0, 240, 255, 0.95));
                }
                33% {
                  filter: hue-rotate(120deg) drop-shadow(0 0 20px rgba(168, 85, 247, 0.98));
                }
                66% {
                  filter: hue-rotate(240deg) drop-shadow(0 0 20px rgba(236, 72, 153, 0.98));
                }
                100% {
                  filter: hue-rotate(360deg) drop-shadow(0 0 16px rgba(0, 240, 255, 0.95));
                }
              }

              /* Horizontal Travel Across Entire Screen (100vw -> -260px) */
              @keyframes dogWalkAcrossScreen {
                0% {
                  transform: translateX(100vw);
                }
                100% {
                  transform: translateX(-260px);
                }
              }

              /* Leg Stepping Animations (Laufbeine) */
              @keyframes legWalkFL {
                0%, 100% { transform: rotate(-22deg); }
                25%      { transform: rotate(0deg); }
                50%      { transform: rotate(22deg); }
                75%      { transform: rotate(0deg); }
              }
              @keyframes legWalkFR {
                0%, 100% { transform: rotate(22deg); }
                25%      { transform: rotate(0deg); }
                50%      { transform: rotate(-22deg); }
                75%      { transform: rotate(0deg); }
              }
              @keyframes legWalkBL {
                0%, 100% { transform: rotate(20deg); }
                25%      { transform: rotate(0deg); }
                50%      { transform: rotate(-20deg); }
                75%      { transform: rotate(0deg); }
              }
              @keyframes legWalkBR {
                0%, 100% { transform: rotate(-20deg); }
                25%      { transform: rotate(0deg); }
                50%      { transform: rotate(20deg); }
                75%      { transform: rotate(0deg); }
              }

              /* Head Sniffing Motion */
              @keyframes headSniffMotion {
                0%, 100% { transform: translateY(0px) rotate(0deg); }
                35%      { transform: translateY(4px) rotate(3deg); }
                70%      { transform: translateY(-1px) rotate(-1.5deg); }
              }

              /* Nose Sniffing Twitching Animation (Schnüffelnase) */
              @keyframes noseSniffTwitch {
                0%, 100% { transform: scale(1); }
                25%      { transform: scale(1.2) translate(-0.8px, -0.5px); }
                50%      { transform: scale(1); }
                75%      { transform: scale(1.25) translate(-0.5px, 0.5px); }
              }

              /* Tail Wagging Motion */
              @keyframes tailWagMotion {
                0%, 100% { transform: rotate(0deg); }
                50%      { transform: rotate(-14deg); }
              }

              /* Wagging Motion Arcs Pulse */
              @keyframes wagLinesPulse {
                0%, 100% { opacity: 0.4; transform: scale(0.95); }
                50%      { opacity: 1; transform: scale(1.15); }
              }

              /* Scent Particles Bubble Up */
              @keyframes sniffParticle {
                0%   { opacity: 0; transform: translate(0, 0) scale(0.4); }
                50%  { opacity: 0.9; }
                100% { opacity: 0; transform: translate(-14px, -12px) scale(1.25); }
              }

              .animate-rainbow-ground {
                animation: rainbowGroundShift 6s linear infinite;
              }

              .animate-rainbow-dog-glow {
                animation: rainbowDogHueShift 5s linear infinite;
              }

              .animate-dog-walk-across {
                animation: dogWalkAcrossScreen 12s linear infinite;
              }

              .anim-leg-fl {
                transform-origin: 80px 75px;
                animation: legWalkFL 0.5s linear infinite;
              }
              .anim-leg-fr {
                transform-origin: 94px 75px;
                animation: legWalkFR 0.5s linear infinite;
              }
              .anim-leg-bl {
                transform-origin: 148px 70px;
                animation: legWalkBL 0.5s linear infinite;
              }
              .anim-leg-br {
                transform-origin: 162px 70px;
                animation: legWalkBR 0.5s linear infinite;
              }

              .anim-head {
                transform-origin: 70px 50px;
                animation: headSniffMotion 1.1s ease-in-out infinite;
              }
              .anim-sniff-nose {
                transform-origin: 25px 91px;
                animation: noseSniffTwitch 0.4s ease-in-out infinite;
              }

              .anim-tail {
                transform-origin: 165px 42px;
                animation: tailWagMotion 0.45s ease-in-out infinite;
              }
              .anim-wag-lines {
                transform-origin: 200px 22px;
                animation: wagLinesPulse 0.45s ease-in-out infinite;
              }

              .sniff-dot-1 {
                animation: sniffParticle 0.9s ease-out infinite 0s;
              }
              .sniff-dot-2 {
                animation: sniffParticle 1.1s ease-out infinite 0.35s;
              }
            `}</style>
          </defs>

          {/* SCENT PARTICLES AT NOSE IN NEON RAINBOW GRADIENT */}
          <circle cx="24" cy="116" r="2.4" fill="url(#neonRainbowGrad)" className="sniff-dot-1" />
          <circle cx="18" cy="111" r="3.0" fill="url(#neonRainbowGrad)" className="sniff-dot-2" />

          {/* REALISTIC MULTI-PATH VECTOR STROKES IN NEON RAINBOW GRADIENT */}
          <g stroke="url(#neonRainbowGrad)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
            
            {/* BACKGROUND LEGS */}
            <g className="anim-leg-br" opacity="0.55">
              <path d="M162 70 C172 84 178 98 156 112 L172 112" />
            </g>
            <g className="anim-leg-fr" opacity="0.55">
              <path d="M94 75 C86 88 78 100 68 112 L82 112" />
            </g>

            {/* TAIL & ANIMATED MOTION ARCS (( )) */}
            <g className="anim-tail">
              <path d="M165 42 C178 38 192 26 200 16 C192 22 180 30 170 50" fill="#0F172A" />
            </g>

            {/* Wagging lines above tail tip (( )) */}
            <g className="anim-wag-lines">
              <path d="M204 12 C208 15 210 21 207 26" strokeWidth="3.4" />
              <path d="M212 7 C218 12 220 24 215 31" strokeWidth="3.4" />
            </g>

            {/* STABLE TORSO & BACKLINE */}
            <path d="M70 38 C86 24 138 24 165 42" fill="#0F172A" />
            <path d="M70 75 C88 72 118 68 138 70 C150 72 160 66 165 60" />

            {/* FOREGROUND LEGS */}
            <g className="anim-leg-fl">
              <path d="M80 75 C72 88 62 100 50 112 L64 112" />
            </g>
            <g className="anim-leg-bl">
              <path d="M148 70 C136 82 130 96 124 112 L140 112" />
            </g>

            {/* INDEPENDENT SNIFFING HEAD, EARS & PROMINENT ANIMATED SCHNÜFFELNASE */}
            <g className="anim-head">
              {/* Head & Muzzle contour */}
              <path
                d="M70 38 L56 26 C52 24 46 25 44 28 L38 50 L26 78 C22 82 22 90 28 95 L36 96 M36 96 C44 96 54 90 62 80 L70 74"
                fill="#0F172A"
              />

              {/* Pointed Ear 1 */}
              <path d="M56 26 L46 6 C44 2 49 2 53 9 L60 26" fill="#0F172A" />

              {/* Pointed Ear 2 */}
              <path d="M64 24 L66 4 C68 0 73 1 76 8 L72 24" fill="#0F172A" />

              {/* Expressive Eye */}
              <g stroke="none">
                <ellipse cx="46" cy="58" rx="3.5" ry="5.5" fill="url(#neonRainbowGrad)" />
                <ellipse cx="44.5" cy="58.5" rx="2" ry="3" fill="#0F172A" />
                <ellipse cx="47" cy="56" rx="1" ry="1.5" fill="url(#neonRainbowGrad)" />
              </g>

              {/* Prominent Animated Schnüffelnase */}
              <g className="anim-sniff-nose" stroke="none">
                <ellipse cx="25" cy="91" rx="4.8" ry="3.4" fill="url(#neonRainbowGrad)" />
                <ellipse cx="24" cy="91.5" rx="1.8" ry="1.2" fill="#0F172A" />
                <circle cx="26.2" cy="89.8" r="0.9" fill="url(#neonRainbowGrad)" />
              </g>
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
};
