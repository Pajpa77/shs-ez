import fs from 'fs';

let content = fs.readFileSync('src/components/DroneFeedWidget.tsx', 'utf8');

if (!content.includes('mpegts')) {
  // 1. imports
  content = content.replace(
    /import React, \{ useState \} from 'react';/,
    "import React, { useState, useEffect, useRef } from 'react';\nimport mpegts from 'mpegts.js';"
  );
  
  // 2. Add videoRef and useEffect for mpegts
  content = content.replace(
    /const \{ dragRef, position, dragProps \} = useDraggable\(\{ storageKey: 'drone_feed_widget' \}\);/,
    `const { dragRef, position, dragProps } = useDraggable({ storageKey: 'drone_feed_widget' });
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null); // mpegts.Player types might be missing

  useEffect(() => {
    if (mpegts.getFeatureList().mseLivePlayback) {
      if (videoRef.current) {
        // Connect to local Node Media Server on Port 8000 via WS-FLV
        // In production, localhost should be replaced by window.location.hostname
        const wsUrl = \`ws://\${window.location.hostname}:8000/live/drone.flv\`;
        
        const player = mpegts.createPlayer({
          type: 'flv',
          isLive: true,
          url: wsUrl, 
          hasAudio: false,
        });
        player.attachMediaElement(videoRef.current);
        player.load();
        
        // Auto-play might be blocked by browsers, but muted usually works
        player.play().catch(e => console.log('Autoplay blocked', e));
        playerRef.current = player;
      }
    }
    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, []);`
  );
  
  // 3. update UI text
  content = content.replace(
    /rtmp:\/\/shs-ez\.test\/drone/,
    "rtmp://&lt;SERVER-IP&gt;:1935/live/drone"
  );
  
  // 4. Update the video element
  content = content.replace(
    /<video\s+autoPlay\s+loop\s+muted\s+playsInline\s+className="w-full h-full object-cover opacity-60"\s*>\s*\{\/\* Public domain aerial video from pixabay \*\/\}\s*<source src="[^"]*" type="video\/mp4" \/>\s*<\/video>/,
    `<video 
          ref={videoRef}
          autoPlay 
          muted 
          playsInline
          className="w-full h-full object-cover relative z-30"
        ></video>`
  );
  
  fs.writeFileSync('src/components/DroneFeedWidget.tsx', content, 'utf8');
  console.log('Drone widget patched.');
} else {
  console.log('Already patched.');
}
