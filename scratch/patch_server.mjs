import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf8');

if (!content.includes('NodeMediaServer')) {
  // Add import using require to avoid commonjs/esm interop issues
  content = content.replace(
    /import dotenv from 'dotenv';/,
    "import dotenv from 'dotenv';\nimport NodeMediaServer from 'node-media-server';"
  );
  
  // Add RTMP setup
  content = content.replace(
    /app\.listen\(PORT, '0\.0\.0\.0', \(\) => \{/,
    `// Setup Node Media Server (RTMP Ingest + HTTP-FLV Out)
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
  
  app.listen(PORT, '0.0.0.0', () => {`
  );
  
  fs.writeFileSync('server.ts', content, 'utf8');
}
console.log('Server patched.');
