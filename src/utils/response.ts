import { Response } from "express";

export const sendSuccess = (res: Response, data: any, message = "Success", status = 200) => {
  return res.status(status).json({
    success: true,
    message,
    data,
  });
};

export const sendError = (res: Response, message: string, status = 500, errors: any = null) => {
  return res.status(status).json({
    success: false,
    message,
    errors,
  });
};
