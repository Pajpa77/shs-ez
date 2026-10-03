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
  const nmsConfig = {
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
    }
  };
  
  const nms = new NodeMediaServer(nmsConfig);
  nms.run();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] Rescuetrack Engine running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[FATAL] Server failed to start:', err);
});
