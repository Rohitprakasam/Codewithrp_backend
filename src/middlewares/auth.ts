import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { sendError } from "../utils/response";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: "student" | "admin";
  };
}

const JWT_SECRET = process.env.JWT_SECRET || "rohit";

export const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return sendError(res, "Access denied. No token provided.", 401);
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      email: string;
      role: "student" | "admin";
    };

    req.user = decoded;
    next();
  } catch (error) {
    return sendError(res, "Invalid or expired token.", 401);
  }
};
