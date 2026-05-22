import { Response } from "express";
import { query, pool } from "../db";
import { AuthenticatedRequest } from "../middlewares/auth";
import { createProblemSchema, editProblemSchema } from "../validators/schemas";
import { sendSuccess, sendError } from "../utils/response";

// GET /problems - List all problems
export const listProblems = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    let result;

    if (userRole === "admin") {
      result = await query(
        "SELECT id, display_id, title, slug, difficulty, tags FROM problems ORDER BY display_id ASC"
      );
    } else {
      result = await query(
        `SELECT p.id, p.display_id, p.title, p.slug, p.difficulty, p.tags 
         FROM problems p
         INNER JOIN problem_assignments pa ON p.id = pa.problem_id
         WHERE pa.user_id = $1
         ORDER BY p.display_id ASC`,
         [req.user?.id]
      );
    }
    return sendSuccess(res, result.rows, "Problems retrieved successfully");
  } catch (error) {
    console.error("List problems error:", error);
    return sendError(res, "Failed to retrieve problems", 500);
  }
};

// GET /problems/:slug - Retrieve problem details by slug (visible testcases only)
export const getProblemBySlug = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const problemResult = await query(
      "SELECT id, display_id, title, slug, difficulty, description, starter_code, tags FROM problems WHERE slug = $1",
      [slug]
    );

    if (problemResult.rows.length === 0) {
      return sendError(res, "Problem not found", 404);
    }

    const problem = problemResult.rows[0];

    // Authorization check for students
    if (req.user?.role !== "admin") {
      const assignmentCheck = await query(
        "SELECT id FROM problem_assignments WHERE user_id = $1 AND problem_id = $2",
        [req.user?.id, problem.id]
      );
      if (assignmentCheck.rows.length === 0) {
        return sendError(res, "You do not have access to this problem", 403);
      }
    }

    // Fetch ONLY visible testcases
    const tcResult = await query(
      "SELECT id, input, expected_output FROM testcases WHERE problem_id = $1 AND is_hidden = FALSE ORDER BY created_at ASC",
      [problem.id]
    );

    const problemDetails = {
      id: problem.id,
      display_id: problem.display_id,
      title: problem.title,
      slug: problem.slug,
      difficulty: problem.difficulty,
      description: problem.description,
      starter_code: problem.starter_code,
      tags: problem.tags,
      visible_testcases: tcResult.rows,
    };

    return sendSuccess(res, problemDetails, "Problem details retrieved successfully");
  } catch (error) {
    console.error("Get problem by slug error:", error);
    return sendError(res, "Failed to retrieve problem details", 500);
  }
};

// POST /admin/problems - Create problem (Admin only)
export const createProblem = async (req: AuthenticatedRequest, res: Response) => {
  const client = await pool.connect();
  try {
    // Validate request body
    const validation = createProblemSchema.safeParse(req.body);
    if (!validation.success) {
      return sendError(res, "Validation failed", 400, validation.error.flatten().fieldErrors);
    }

    const {
      title,
      difficulty,
      description,
      starter_code,
      tags,
      visible_testcases,
      hidden_testcases,
    } = validation.data;

    // Generate slug from title
    const slug = title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const createdBy = req.user?.id;

    // Start database transaction
    await client.query("BEGIN");

    // Check slug collision
    const slugCheck = await client.query("SELECT id FROM problems WHERE slug = $1", [slug]);
    if (slugCheck.rows.length > 0) {
      await client.query("ROLLBACK");
      return sendError(res, `A problem with title/slug "${slug}" already exists`, 409);
    }

    // Insert problem
    const problemInsertResult = await client.query(
      `INSERT INTO problems (title, slug, difficulty, description, starter_code, tags, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [title, slug, difficulty, description, starter_code, tags, createdBy]
    );

    const problem = problemInsertResult.rows[0];

    // Insert visible testcases
    for (const tc of visible_testcases) {
      await client.query(
        "INSERT INTO testcases (problem_id, input, expected_output, is_hidden) VALUES ($1, $2, $3, FALSE)",
        [problem.id, tc.input, tc.expected_output]
      );
    }

    // Insert hidden testcases
    for (const tc of hidden_testcases) {
      await client.query(
        "INSERT INTO testcases (problem_id, input, expected_output, is_hidden) VALUES ($1, $2, $3, TRUE)",
        [problem.id, tc.input, tc.expected_output]
      );
    }

    // Commit transaction
    await client.query("COMMIT");

    return sendSuccess(res, problem, "Problem created successfully", 201);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create problem error:", error);
    return sendError(res, "Failed to create problem", 500);
  } finally {
    client.release();
  }
};

// PUT /admin/problems/:id - Edit problem (Admin only)
export const editProblem = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    // Validate request body
    const validation = editProblemSchema.safeParse(req.body);
    if (!validation.success) {
      return sendError(res, "Validation failed", 400, validation.error.flatten().fieldErrors);
    }

    // Check if problem exists
    const problemCheck = await client.query("SELECT * FROM problems WHERE id = $1", [id]);
    if (problemCheck.rows.length === 0) {
      return sendError(res, "Problem not found", 404);
    }

    const {
      title,
      difficulty,
      description,
      starter_code,
      tags,
      visible_testcases,
      hidden_testcases,
    } = validation.data;

    await client.query("BEGIN");

    // Build update query dynamically
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let valCounter = 1;

    if (title !== undefined) {
      updateFields.push(`title = $${valCounter++}`);
      updateValues.push(title);

      const slug = title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
      
      updateFields.push(`slug = $${valCounter++}`);
      updateValues.push(slug);
    }

    if (difficulty !== undefined) {
      updateFields.push(`difficulty = $${valCounter++}`);
      updateValues.push(difficulty);
    }

    if (description !== undefined) {
      updateFields.push(`description = $${valCounter++}`);
      updateValues.push(description);
    }

    if (starter_code !== undefined) {
      updateFields.push(`starter_code = $${valCounter++}`);
      updateValues.push(starter_code);
    }

    if (tags !== undefined) {
      updateFields.push(`tags = $${valCounter++}`);
      updateValues.push(tags);
    }

    if (updateFields.length > 0) {
      updateValues.push(id);
      await client.query(
        `UPDATE problems SET ${updateFields.join(", ")} WHERE id = $${valCounter}`,
        updateValues
      );
    }

    // Update testcases if provided
    if (visible_testcases !== undefined || hidden_testcases !== undefined) {
      // If either list is provided, delete all current testcases and replace
      // Fetch current testcases if we only update one to prevent wiping out the other
      let currentVisible = visible_testcases;
      let currentHidden = hidden_testcases;

      if (visible_testcases === undefined) {
        const visRes = await client.query(
          "SELECT input, expected_output FROM testcases WHERE problem_id = $1 AND is_hidden = FALSE",
          [id]
        );
        currentVisible = visRes.rows;
      }

      if (hidden_testcases === undefined) {
        const hidRes = await client.query(
          "SELECT input, expected_output FROM testcases WHERE problem_id = $1 AND is_hidden = TRUE",
          [id]
        );
        currentHidden = hidRes.rows;
      }

      // Delete existing testcases
      await client.query("DELETE FROM testcases WHERE problem_id = $1", [id]);

      // Re-insert visible testcases
      if (currentVisible) {
        for (const tc of currentVisible) {
          await client.query(
            "INSERT INTO testcases (problem_id, input, expected_output, is_hidden) VALUES ($1, $2, $3, FALSE)",
            [id, tc.input, tc.expected_output]
          );
        }
      }

      // Re-insert hidden testcases
      if (currentHidden) {
        for (const tc of currentHidden) {
          await client.query(
            "INSERT INTO testcases (problem_id, input, expected_output, is_hidden) VALUES ($1, $2, $3, TRUE)",
            [id, tc.input, tc.expected_output]
          );
        }
      }
    }

    await client.query("COMMIT");

    const updatedProblem = await query("SELECT * FROM problems WHERE id = $1", [id]);
    return sendSuccess(res, updatedProblem.rows[0], "Problem updated successfully");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Edit problem error:", error);
    return sendError(res, "Failed to edit problem", 500);
  } finally {
    client.release();
  }
};
