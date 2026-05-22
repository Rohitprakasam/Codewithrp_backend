import { Response } from "express";
import { query } from "../db";
import { AuthenticatedRequest } from "../middlewares/auth";
import { sendSuccess, sendError } from "../utils/response";

export const getThreads = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== "admin") {
      return sendError(res, "Only admins can view all threads", 403);
    }
    
    // Get all students and their latest message with the admin
    const result = await query(`
      SELECT 
        u.id as user_id, 
        u.name as user_name, 
        u.email as user_email,
        (
          SELECT content 
          FROM messages m 
          WHERE (m.sender_id = u.id AND m.receiver_id = $1) 
             OR (m.sender_id = $1 AND m.receiver_id = u.id)
          ORDER BY created_at DESC 
          LIMIT 1
        ) as last_message,
        (
          SELECT created_at 
          FROM messages m 
          WHERE (m.sender_id = u.id AND m.receiver_id = $1) 
             OR (m.sender_id = $1 AND m.receiver_id = u.id)
          ORDER BY created_at DESC 
          LIMIT 1
        ) as last_message_at,
        (
          SELECT COUNT(*) 
          FROM messages m 
          WHERE m.sender_id = u.id AND m.receiver_id = $1 AND m.read_at IS NULL
        ) as unread_count
      FROM users u
      WHERE u.role = 'student'
      ORDER BY last_message_at DESC NULLS LAST, u.name ASC
    `, [req.user.id]);

    return sendSuccess(res, result.rows, "Threads retrieved");
  } catch (error) {
    console.error("Get threads error:", error);
    return sendError(res, "Failed to retrieve threads", 500);
  }
};

export const getChat = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { peerId } = req.params;
    
    const result = await query(
      `SELECT id, sender_id, receiver_id, content, read_at, created_at 
       FROM messages 
       WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)
       ORDER BY created_at ASC`,
      [req.user?.id, peerId]
    );

    // Mark as read if the current user is the receiver
    await query(
      "UPDATE messages SET read_at = CURRENT_TIMESTAMP WHERE receiver_id = $1 AND sender_id = $2 AND read_at IS NULL",
      [req.user?.id, peerId]
    );

    return sendSuccess(res, result.rows, "Chat retrieved");
  } catch (error) {
    console.error("Get chat error:", error);
    return sendError(res, "Failed to retrieve chat", 500);
  }
};

export const sendMessage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { receiver_id, content } = req.body;

    if (!receiver_id || !content) {
      return sendError(res, "receiver_id and content are required", 400);
    }

    const result = await query(
      "INSERT INTO messages (sender_id, receiver_id, content) VALUES ($1, $2, $3) RETURNING id, sender_id, receiver_id, content, read_at, created_at",
      [req.user?.id, receiver_id, content]
    );

    return sendSuccess(res, result.rows[0], "Message sent");
  } catch (error) {
    console.error("Send message error:", error);
    return sendError(res, "Failed to send message", 500);
  }
};

export const getAdminPeerId = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Helper for students to find an admin to message
    const result = await query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    if (result.rows.length === 0) {
      return sendError(res, "No admin found", 404);
    }
    return sendSuccess(res, { adminId: result.rows[0].id }, "Admin ID retrieved");
  } catch (error) {
    return sendError(res, "Failed to find admin", 500);
  }
};
