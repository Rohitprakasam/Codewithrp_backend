import { Response } from "express";
import { query } from "../db";
import { AuthenticatedRequest } from "../middlewares/auth";
import { executeJavaCode } from "./codex.service";
import { executeRunSchema, executeSubmitSchema } from "../validators/schemas";
import { sendSuccess, sendError } from "../utils/response";

// Utility to clean and format output for comparison
const cleanOutput = (str: string): string => {
  if (!str) return "";
  return str
    .trim()
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\s+\n/g, "\n"); // remove trailing whitespaces on lines
};

const getErrorStatus = (errorMsg: string) => {
  if (!errorMsg) return "Compilation Error";
  const msg = errorMsg.toLowerCase();
  if (msg.includes("time limit exceeded") || msg.includes("etimedout") || msg.includes("timeout")) return "TLE";
  if (msg.includes("exception in thread") || msg.includes("java.lang.")) return "Runtime Error";
  return "Compilation Error";
};

// POST /execute/run - Run code against visible testcases only (fast execution, no storage)
export const executeRun = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validation = executeRunSchema.safeParse(req.body);
    if (!validation.success) {
      return sendError(res, "Validation failed", 400, validation.error.flatten().fieldErrors);
    }

    const { problem_id, source_code } = validation.data;

    // 1. Java class validation
    if (!source_code.includes("public class Main")) {
      return res.status(200).json({
        stdout: "",
        stderr: "Please use class Main (e.g., 'public class Main { ... }' as the entry point)",
        status: "Compilation Error",
      });
    }

    // 2. Fetch visible testcases
    const tcResult = await query(
      "SELECT input, expected_output FROM testcases WHERE problem_id = $1 AND is_hidden = FALSE ORDER BY created_at ASC",
      [problem_id]
    );

    if (tcResult.rows.length === 0) {
      return sendError(res, "No visible testcases found for this problem", 404);
    }

    const testcases = tcResult.rows;
    let allPassed = true;
    let stdout = "";
    let stderr = "";
    let status = "Accepted";

    // 3. Execute against testcases
    // Run the first visible testcase
    const firstTc = testcases[0];
    const codexRes = await executeJavaCode(source_code, firstTc.input);

    if (codexRes.error) {
      allPassed = false;
      stderr = codexRes.error;
      status = getErrorStatus(stderr);
    } else {
      stdout = codexRes.output;
      const actual = cleanOutput(stdout);
      const expected = cleanOutput(firstTc.expected_output);

      if (actual !== expected) {
        allPassed = false;
        status = "Wrong Answer";
        stdout = `Test Case 1 Failed:\nInput:\n${firstTc.input}\n\nExpected:\n${firstTc.expected_output}\n\nActual Output:\n${stdout}`;
      } else {
        // Run remaining testcases if the first one passes
        for (let i = 1; i < testcases.length; i++) {
          const tc = testcases[i];
          const tcRes = await executeJavaCode(source_code, tc.input);

          if (tcRes.error) {
            allPassed = false;
            stderr = tcRes.error;
            status = getErrorStatus(stderr);
            break;
          }

          const act = cleanOutput(tcRes.output);
          const exp = cleanOutput(tc.expected_output);

          if (act !== exp) {
            allPassed = false;
            status = "Wrong Answer";
            stdout = `Test Case ${i + 1} Failed:\nInput:\n${tc.input}\n\nExpected:\n${tc.expected_output}\n\nActual Output:\n${tcRes.output}`;
            break;
          }
        }
      }
    }

    if (allPassed && status === "Accepted") {
      stdout = stdout || "All visible testcases passed successfully.";
    }

    return res.status(200).json({
      stdout,
      stderr,
      status,
    });
  } catch (error) {
    console.error("Execute run error:", error);
    return sendError(res, "Failed to execute code run", 500);
  }
};

// POST /execute/submit - Execute code against ALL testcases and record submission
export const executeSubmit = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  try {
    const validation = executeSubmitSchema.safeParse(req.body);
    if (!validation.success) {
      return sendError(res, "Validation failed", 400, validation.error.flatten().fieldErrors);
    }

    const { problem_id, source_code } = validation.data;

    // Fetch all testcases (both visible and hidden)
    const tcResult = await query(
      "SELECT input, expected_output, is_hidden FROM testcases WHERE problem_id = $1 ORDER BY created_at ASC",
      [problem_id]
    );

    const totalCount = tcResult.rows.length;
    if (totalCount === 0) {
      return sendError(res, "No testcases found for this problem", 404);
    }

    const testcases = tcResult.rows;

    // 1. Java class validation
    if (!source_code.includes("public class Main")) {
      // Record failed compilation submission
      const subResult = await query(
        `INSERT INTO submissions (user_id, problem_id, source_code, status, runtime, memory, passed_count, total_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [userId, problem_id, source_code, "Compilation Error", "0s", "0 MB", 0, totalCount]
      );
      
      return res.status(200).json({
        status: "Compilation Error",
        passed: 0,
        total: totalCount,
      });
    }

    let passedCount = 0;
    let finalStatus = "Accepted";
    let runtimeSum = 0;
    let lastCodexResponse: any = null;

    // 2. Execute all testcases
    // Run testcases in sequence (or Promise.all for faster grading, let's use sequence to avoid overwhelming Codex API)
    for (const tc of testcases) {
      const startTime = Date.now();
      const codexRes = await executeJavaCode(source_code, tc.input);
      const executionTime = Date.now() - startTime;
      runtimeSum += executionTime;
      lastCodexResponse = codexRes;

      if (codexRes.error) {
        finalStatus = getErrorStatus(codexRes.error);
        break; // Stop running testcases if compilation/runtime error is found
      }

      const actual = cleanOutput(codexRes.output);
      const expected = cleanOutput(tc.expected_output);

      if (actual === expected) {
        passedCount++;
      } else {
        finalStatus = "Wrong Answer";
        // Do not break here; LeetCode runs all testcases to count total passes
      }
    }

    // Adjust status if compilation failed vs wrong answer
    if (finalStatus === "Accepted" && passedCount < totalCount) {
      finalStatus = "Wrong Answer";
    }

    const calculatedRuntime = `${(runtimeSum / 1000).toFixed(2)}s`;
    const memoryUsage = "N/A"; // Codex API doesn't return memory

    // 3. Save Submission Record
    const subResult = await query(
      `INSERT INTO submissions (user_id, problem_id, source_code, status, runtime, memory, passed_count, total_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, submitted_at`,
      [userId, problem_id, source_code, finalStatus, calculatedRuntime, memoryUsage, passedCount, totalCount]
    );

    const submissionId = subResult.rows[0].id;

    // 4. Save Execution Log (for debugging)
    if (lastCodexResponse) {
      await query(
        `INSERT INTO execution_logs (submission_id, judge0_token, raw_response)
         VALUES ($1, $2, $3)`,
        [submissionId, "local-exec", lastCodexResponse]
      );
    }

    return res.status(200).json({
      status: finalStatus,
      passed: passedCount,
      total: totalCount,
      runtime: calculatedRuntime,
    });
  } catch (error) {
    console.error("Execute submit error:", error);
    return sendError(res, "Failed to submit code execution", 500);
  }
};
