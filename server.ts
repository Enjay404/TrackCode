import 'dotenv/config';
import express from 'express';
import { createServer as createHttpServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import apiApp from './server/api.js';

const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const app = express();
app.disable('x-powered-by');
app.use(apiApp);

async function startLocalServer() {
  const httpServer = createHttpServer(app);
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  if (!IS_PRODUCTION) {
    const viteModule = 'vite';
    const { createServer: createViteServer } = (await import(
      viteModule
    )) as typeof import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(
      '/assets',
      express.static(path.join(distDir, 'assets'), {
        maxAge: '1y',
        immutable: true,
      })
    );
    app.use(
      express.static(distDir, {
        maxAge: '1h',
      })
    );
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0');
}

if (!process.env.VERCEL) {
  startLocalServer().catch((err) => {
    console.error('Failed to start TrackCode server:', err);
    process.exit(1);
  });
}

export default app;
