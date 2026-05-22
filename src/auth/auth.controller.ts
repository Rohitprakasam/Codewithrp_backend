import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "../db";
import { loginSchema } from "../validators/schemas";
import { sendSuccess, sendError } from "../utils/response";

const JWT_SECRET = process.env.JWT_SECRET || "rohit";

export const login = async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      return sendError(res, "Validation failed", 400, validation.error.flatten().fieldErrors);
    }

    const { email, password } = validation.data;

    // Retrieve user from DB
    const result = await query("SELECT * FROM users WHERE email = $1", [email.toLowerCase()]);
    if (result.rows.length === 0) {
      return sendError(res, "Invalid email or password", 401);
    }

    const user = result.rows[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return sendError(res, "Invalid email or password", 401);
    }

    // Generate JWT
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    return sendSuccess(res, {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    }, "Login successful");
  } catch (error) {
    console.error("Login error:", error);
    return sendError(res, "An error occurred during login", 500);
  }
};
