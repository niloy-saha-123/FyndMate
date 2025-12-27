/**
 * @file src/server.ts
 * @description Entry point for the server. Bootstraps the Fastify application
 *              and starts listening on the configured port. This file should
 *              contain minimal logic - just startup and error handling.
 */

import { buildApp } from './app.js';

const start = async () => {
  const app = await buildApp();

  try {
    const port = Number(process.env.PORT) || 3000;
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`Server listening on port ${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

