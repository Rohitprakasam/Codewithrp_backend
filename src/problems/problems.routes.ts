import { Router } from "express";
import {
  listProblems,
  getProblemBySlug,
  createProblem,
  editProblem,
} from "./problems.controller";
import { authMiddleware } from "../middlewares/auth";
import { adminMiddleware } from "../middlewares/admin";

const router = Router();

// Student / general authenticated routes
router.get("/problems", authMiddleware, listProblems);
router.get("/problems/:slug", authMiddleware, getProblemBySlug);

// Admin-only routes
router.post("/admin/problems", authMiddleware, adminMiddleware, createProblem);
router.put("/admin/problems/:id", authMiddleware, adminMiddleware, editProblem);

export default router;
