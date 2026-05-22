import { Router } from "express";
import { executeRun, executeSubmit } from "./execution.controller";
import { authMiddleware } from "../middlewares/auth";
import { rateLimitMiddleware } from "../middlewares/rate-limit";

const router = Router();

// Apply auth and rate-limiting to execution endpoints
router.post("/run", authMiddleware, rateLimitMiddleware, executeRun);
router.post("/submit", authMiddleware, rateLimitMiddleware, executeSubmit);

export default router;
