import { Response } from "express";
import { query, pool } from "../db";
import { AuthenticatedRequest } from "../middlewares/auth";
import { sendSuccess, sendError } from "../utils/response";
import bcrypt from "bcryptjs";

export const getStudents = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      "SELECT id, name, email FROM users WHERE role = 'student' ORDER BY name ASC"
    );
    return sendSuccess(res, result.rows, "Students retrieved successfully");
  } catch (error) {
    console.error("Get students error:", error);
    return sendError(res, "Failed to retrieve students", 500);
  }
};

export const getProblemAssignments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query(
      "SELECT user_id FROM problem_assignments WHERE problem_id = $1",
      [id]
    );
    const userIds = result.rows.map(r => r.user_id);
    return sendSuccess(res, userIds, "Assignments retrieved successfully");
  } catch (error) {
    console.error("Get assignments error:", error);
    return sendError(res, "Failed to retrieve assignments", 500);
  }
};

export const assignProblem = async (req: AuthenticatedRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { id } = req.params; // problem_id
    const { user_ids } = req.body as { user_ids: string[] };

    if (!Array.isArray(user_ids)) {
      return sendError(res, "user_ids must be an array", 400);
    }

    await client.query("BEGIN");
    
    // First, delete all existing assignments for this problem
    await client.query("DELETE FROM problem_assignments WHERE problem_id = $1", [id]);

    // Insert new assignments
    for (const userId of user_ids) {
      await client.query(
        "INSERT INTO problem_assignments (user_id, problem_id, assigned_by) VALUES ($1, $2, $3)",
        [userId, id, req.user?.id]
      );
    }

    await client.query("COMMIT");
    return sendSuccess(res, { assigned_count: user_ids.length }, "Assignments updated successfully");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Assign problem error:", error);
    return sendError(res, "Failed to assign problem", 500);
  } finally {
    client.release();
  }
};

export const createStudent = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return sendError(res, "Name, email, and password are required", 400);
    }

    const emailCheck = await query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
    if (emailCheck.rows.length > 0) {
      return sendError(res, "Email already exists", 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'student') RETURNING id, name, email, role, created_at",
      [name, email.toLowerCase(), passwordHash]
    );

    return sendSuccess(res, result.rows[0], "Student created successfully");
  } catch (error) {
    console.error("Create student error:", error);
    return sendError(res, "Failed to create student", 500);
  }
};
