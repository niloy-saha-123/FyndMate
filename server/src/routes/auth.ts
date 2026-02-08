/**
 * @file src/routes/auth.ts
 * @description Authentication routes.
 */

import { FastifyInstance } from 'fastify';
import { signupUser } from "../services/auth.service.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { prisma } from "../lib/prisma.js";
import { rateLimit } from "../middleware/rateLimit.js";

export default async function authRoutes(app: FastifyInstance) {
  app.post("/signup", {
    preHandler: [
      rateLimit({ limit: 10, windowSec: 24 * 60 * 60, keyPrefix: 'signup' })
    ]
  }, async (request, reply) => {
    // TODO [POST-MVP]: Gate signup with CAPTCHA (hCaptcha/reCAPTCHA).
    // TODO [POST-MVP]: Enforce verified email before feed visibility.
    // TODO [POST-MVP]: Monitor signup patterns for bot detection and abuse scoring.
    try {
      const { email, password, name } = request.body as any;

      if (!email || !password || !name) {
        return reply.status(400).send({ error: "Missing fields" });
      }

      await signupUser({ email, password, name });

      return reply.status(201).send({ success: true });
    } catch (e: any) {
      return reply.status(400).send({ error: e.message });
    }
  });

  /**
   * GET /auth/me
   * Smoke test endpoint for debugging auth issues.
   * Returns current user info if authenticated.
   */
  app.get("/me", { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      // request.user is attached by authMiddleware
      const user = request.user!;

      // Optionally fetch more user data from DB
      const fullUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          supabaseId: true,
          email: true,
          name: true,
          profilePicture: true,
          createdAt: true,
        },
      });

      return reply.send({
        success: true,
        user: {
          appUserId: user.id,
          supabaseId: user.supabaseId,
          email: user.email,
          name: fullUser?.name,
          profilePicture: fullUser?.profilePicture,
          createdAt: fullUser?.createdAt,
        },
      });
    } catch (e: any) {
      request.log.error(e, 'Error in /me endpoint');
      return reply.status(500).send({ error: e.message });
    }
  });
}
