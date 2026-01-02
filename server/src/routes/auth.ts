import { Router } from "express";
import { signupUser } from "../services/auth.service.js";

const router = Router();

router.post("/signup", async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: "Missing fields" });
    }

    await signupUser({ email, password, name });

    res.status(201).json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
