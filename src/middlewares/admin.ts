import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth";
import { sendError } from "../utils/response";

export const adminMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return sendError(res, "Access denied. User not authenticated.", 401);
  }

  if (req.user.role !== "admin") {
    return sendError(res, "Forbidden. Admin access required.", 403);
  }

  next();
};
