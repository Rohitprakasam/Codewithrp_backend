import { Router } from "express";
import { getStudents, assignProblem, getProblemAssignments, createStudent, deleteStudent } from "./admin.controller";
import { authMiddleware } from "../middlewares/auth";
import { adminMiddleware } from "../middlewares/admin";

const router = Router();

router.get("/admin/users", authMiddleware, adminMiddleware, getStudents);
router.post("/admin/users", authMiddleware, adminMiddleware, createStudent);
router.delete("/admin/users/:id", authMiddleware, adminMiddleware, deleteStudent);
router.get("/admin/problems/:id/assign", authMiddleware, adminMiddleware, getProblemAssignments);
router.post("/admin/problems/:id/assign", authMiddleware, adminMiddleware, assignProblem);

export default router;
