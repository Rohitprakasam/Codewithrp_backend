import { Router } from "express";
import {
  getMySubmissions,
  getAllSubmissions,
  getSubmissionDetails,
} from "./submissions.controller";
import { authMiddleware } from "../middlewares/auth";
import { adminMiddleware } from "../middlewares/admin";

const router = Router();

// Student submission route
router.get("/submissions/me", authMiddleware, getMySubmissions);

// Admin submission logs
router.get("/admin/submissions", authMiddleware, adminMiddleware, getAllSubmissions);
router.get("/admin/submissions/:id", authMiddleware, adminMiddleware, getSubmissionDetails);

export default router;
