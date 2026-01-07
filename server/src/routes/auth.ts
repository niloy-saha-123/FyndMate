import { FastifyInstance } from 'fastify';
import { signupUser } from "../services/auth.service.js";

export default async function authRoutes(app: FastifyInstance) {
  app.post("/signup", async (request, reply) => {
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
}
