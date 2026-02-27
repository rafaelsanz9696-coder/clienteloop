import { createServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const server = await createServer({
  root: __dirname,
  configFile: path.join(__dirname, 'vite.config.ts'),
  server: { port: 3000, host: '0.0.0.0' },
});
await server.listen();
server.printUrls();
