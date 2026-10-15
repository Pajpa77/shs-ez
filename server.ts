// Server entry point for SHS-EZ
import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import NodeMediaServer from 'node-media-server';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parsing
  app.use(express.json());

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Vite middleware for development vs production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Setup Node Media Server (RTMP Ingest + HTTP-FLV Out)
  // Drone (DJI Fly -> RTMP) publishes to rtmp://<LAPTOP-TAILSCALE-IP>:1935/live/<key>
  // Viewers play ws(s)://<host>/live/<key>.flv  (Port 8000 is the only port to be tunneled via HTTPS)
  const nmsConfig = {
    bind: '0.0.0.0',
    rtmp: {
      port: 1935,
      chunk_size: 60000,
      gop_cache: true,
      ping: 30,
      ping_timeout: 60
    },
    http: {
      port: 8000,
      allow_origin: '*'
    },
    // Never expose the bundled NMS web console when port 8000 is tunneled to the internet
    webadmin: {
      enable: false
    }
  };
  
  const nms = new NodeMediaServer(nmsConfig as any);
  nms.run();
  nms.on('postPublish', (session: any) => {
    console.log(`[DRONE] Stream gestartet: ${session?.streamPath ?? '?'} -> Wiedergabe: <host>${session?.streamPath ?? ''}.flv`);
  });
  nms.on('donePublish', (session: any) => {
    console.log(`[DRONE] Stream beendet: ${session?.streamPath ?? '?'}`);
  });
  console.log('[DRONE] RTMP-Ingest: rtmp://<LAPTOP-IP>:1935/live/<key>  |  HTTP/WS-FLV: Port 8000');
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] Rescuetrack Engine running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[FATAL] Server failed to start:', err);
});
