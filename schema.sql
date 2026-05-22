-- Database schema for CodeWithRP
-- Set up table definitions and seed initial mock data

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'admin')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Problems Table
CREATE TABLE IF NOT EXISTS problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id SERIAL UNIQUE,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  description TEXT NOT NULL,
  starter_code TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Testcases Table
CREATE TABLE IF NOT EXISTS testcases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id UUID REFERENCES problems(id) ON DELETE CASCADE,
  input TEXT NOT NULL,
  expected_output TEXT NOT NULL,
  is_hidden BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Submissions Table
CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  problem_id UUID REFERENCES problems(id) ON DELETE CASCADE,
  source_code TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Accepted', 'Wrong Answer', 'Runtime Error', 'Compilation Error', 'Time Limit Exceeded')),
  runtime TEXT,
  memory TEXT,
  passed_count INTEGER NOT NULL DEFAULT 0,
  total_count INTEGER NOT NULL DEFAULT 0,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Execution Logs Table (Optional)
CREATE TABLE IF NOT EXISTS execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  judge0_token TEXT,
  raw_response JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_problems_slug ON problems(slug);
CREATE INDEX IF NOT EXISTS idx_testcases_problem_id ON testcases(problem_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_problem_id ON submissions(problem_id);

-- 6. Problem Assignments Table
CREATE TABLE IF NOT EXISTS problem_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  problem_id UUID REFERENCES problems(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, problem_id)
);

-- 7. Messages Table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_problem_assignments_user_id ON problem_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id);

-- Seed Initial Users (Password: 123456)
INSERT INTO users (id, name, email, password_hash, role)
VALUES 
  ('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Test Student', 'student@test.com', '$2a$10$r.zmyzgNOvEmbIZQueaFluz/SRNLbzOadIJGXxp075bC6MoMcIG1C', 'student'),
  ('f1e2d3c4-b5a6-7988-9c0d-1e2f3a4b5c6d', 'Test Admin', 'admin@test.com', '$2a$10$r.zmyzgNOvEmbIZQueaFluz/SRNLbzOadIJGXxp075bC6MoMcIG1C', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Seed a Sample Java Problem: Two Sum
INSERT INTO problems (id, title, slug, difficulty, description, starter_code, tags, created_by)
VALUES (
  'e2b34a66-ef12-4c6e-8555-4927cbcd36f1',
  'Two Sum',
  'two-sum',
  'Easy',
  'Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.\n\nInput format:\nFirst line: Number of array elements N.\nSecond line: N space-separated integers.\nThird line: Target integer.',
  'import java.util.*;

public class Main {
    public static int[] twoSum(int[] nums, int target) {
        // Write your Java code here
        return new int[]{0, 1};
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (!sc.hasNextInt()) return;
        int n = sc.nextInt();
        int[] nums = new int[n];
        for (int i = 0; i < n; i++) {
            nums[i] = sc.nextInt();
        }
        int target = sc.nextInt();
        int[] ans = twoSum(nums, target);
        System.out.println(ans[0] + " " + ans[1]);
    }
}',
  ARRAY['Array', 'Hash Table'],
  'f1e2d3c4-b5a6-7988-9c0d-1e2f3a4b5c6d'
) ON CONFLICT (slug) DO NOTHING;

-- Seed Testcases for Two Sum
INSERT INTO testcases (problem_id, input, expected_output, is_hidden)
VALUES 
  ('e2b34a66-ef12-4c6e-8555-4927cbcd36f1', '4' || chr(10) || '2 7 11 15' || chr(10) || '9', '0 1', FALSE),
  ('e2b34a66-ef12-4c6e-8555-4927cbcd36f1', '3' || chr(10) || '3 2 4' || chr(10) || '6', '1 2', FALSE),
  ('e2b34a66-ef12-4c6e-8555-4927cbcd36f1', '2' || chr(10) || '3 3' || chr(10) || '6', '0 1', TRUE)
ON CONFLICT DO NOTHING;

-- Seed initial assignment (Assign Two Sum to Test Student)
INSERT INTO problem_assignments (user_id, problem_id, assigned_by)
VALUES (
  'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  'e2b34a66-ef12-4c6e-8555-4927cbcd36f1',
  'f1e2d3c4-b5a6-7988-9c0d-1e2f3a4b5c6d'
) ON CONFLICT DO NOTHING;
