import { Response } from "express";
import { query } from "../db";
import { AuthenticatedRequest } from "../middlewares/auth";
import { sendSuccess, sendError } from "../utils/response";

// GET /submissions/me - Get current student's submissions
export const getMySubmissions = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  try {
    const result = await query(
      `SELECT s.id, s.problem_id, p.title AS problem_title, s.status, s.runtime, s.passed_count, s.total_count, s.submitted_at 
       FROM submissions s 
       JOIN problems p ON s.problem_id = p.id 
       WHERE s.user_id = $1 
       ORDER BY s.submitted_at DESC`,
      [userId]
    );
    return sendSuccess(res, result.rows, "Submissions history retrieved");
  } catch (error) {
    console.error("Get my submissions error:", error);
    return sendError(res, "Failed to retrieve submission history", 500);
  }
};

// GET /admin/submissions - View all submissions (Admin only)
export const getAllSubmissions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT s.id, s.user_id, u.email AS user_email, u.name AS user_name, s.problem_id, p.title AS problem_title, s.status, s.runtime, s.passed_count, s.total_count, s.submitted_at 
       FROM submissions s 
       JOIN users u ON s.user_id = u.id 
       JOIN problems p ON s.problem_id = p.id 
       ORDER BY s.submitted_at DESC`
    );
    return sendSuccess(res, result.rows, "All submissions retrieved successfully");
  } catch (error) {
    console.error("Get all submissions error:", error);
    return sendError(res, "Failed to retrieve submissions", 500);
  }
};

// GET /admin/submissions/:id - View specific submission details with code (Admin only)
export const getSubmissionDetails = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const result = await query(
      `SELECT s.id, s.user_id, u.email AS user_email, u.name AS user_name, s.problem_id, p.title AS problem_title, s.source_code, s.status, s.runtime, s.memory, s.passed_count, s.total_count, s.submitted_at 
       FROM submissions s 
       JOIN users u ON s.user_id = u.id 
       JOIN problems p ON s.problem_id = p.id 
       WHERE s.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return sendError(res, "Submission not found", 404);
    }

    return sendSuccess(res, result.rows[0], "Submission details retrieved");
  } catch (error) {
    console.error("Get submission details error:", error);
    return sendError(res, "Failed to retrieve submission details", 500);
  }
};
