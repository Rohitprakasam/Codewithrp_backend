import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { initDb } from "./db";
import authRoutes from "./auth/auth.routes";
import problemRoutes from "./problems/problems.routes";
import executionRoutes from "./execution/execution.routes";
import submissionRoutes from "./submissions/submissions.routes";
import adminRoutes from "./admin/admin.routes";
import messageRoutes from "./messages/messages.routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend integration
app.use(cors());

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check Endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", time: new Date() });
});

// Register Endpoints
app.use("/auth", authRoutes);
app.use("/", problemRoutes);
app.use("/execute", executionRoutes);
app.use("/", submissionRoutes);
app.use("/", adminRoutes);
app.use("/", messageRoutes);

// Error Handling Middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// Initialize database schema and start server
const startServer = async () => {
  // Initialize and seed database tables
  await initDb();

  app.listen(PORT, () => {
    console.log(`CodeWithRP Backend is running on port ${PORT}`);
  });
};

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
