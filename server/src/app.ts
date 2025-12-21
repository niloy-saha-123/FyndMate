import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  // Register plugins
  await app.register(cors, {
    origin: true,
  });

  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'your-secret-key',
  });

  await app.register(multipart);

  // Register routes will be added here

  return app;
}

