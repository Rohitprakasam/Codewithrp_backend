import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const testcaseSchema = z.object({
  input: z.string().default(""),
  expected_output: z.string().default(""),
});

export const createProblemSchema = z.object({
  title: z.string().min(1, "Title is required"),
  difficulty: z.enum(["Easy", "Medium", "Hard"]),
  description: z.string().min(1, "Description is required"),
  starter_code: z.string().min(1, "Starter code is required"),
  tags: z.array(z.string()).default([]),
  visible_testcases: z.array(testcaseSchema).min(1, "At least one visible testcase is required"),
  hidden_testcases: z.array(testcaseSchema).default([]),
});

export const editProblemSchema = z.object({
  title: z.string().min(1).optional(),
  difficulty: z.enum(["Easy", "Medium", "Hard"]).optional(),
  description: z.string().min(1).optional(),
  starter_code: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  visible_testcases: z.array(testcaseSchema).optional(),
  hidden_testcases: z.array(testcaseSchema).optional(),
});

export const executeRunSchema = z.object({
  problem_id: z.string().uuid("Invalid problem ID format"),
  source_code: z.string().min(1, "Source code cannot be empty"),
});

export const executeSubmitSchema = z.object({
  problem_id: z.string().uuid("Invalid problem ID format"),
  source_code: z.string().min(1, "Source code cannot be empty"),
});
