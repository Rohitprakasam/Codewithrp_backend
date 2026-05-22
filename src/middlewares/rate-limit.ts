import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth";
import { sendError } from "../utils/response";

// In-memory store for last execution times
const lastExecutionTimes = new Map<string, number>();

export const rateLimitMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id;

  if (!userId) {
    return sendError(res, "User not authenticated for rate limiting", 401);
  }

  // Admins bypass rate limiting
  if (req.user?.role === "admin") {
    return next();
  }

  const now = Date.now();
  const lastTime = lastExecutionTimes.get(userId);

  if (lastTime && now - lastTime < 5000) {
    const waitTime = Math.ceil((5000 - (now - lastTime)) / 1000);
    return sendError(
      res,
      `Rate limit exceeded. Please wait ${waitTime} seconds before running or submitting code again.`,
      429
    );
  }

  // Record the current time and proceed
  lastExecutionTimes.set(userId, now);
  next();
};
