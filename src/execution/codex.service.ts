import fs from "fs";
import path from "path";
import { exec, execSync } from "child_process";

export interface CodexResponse {
  success: boolean;
  output: string;
  error: string;
}

export interface CompiledProgram {
  run: (input?: string) => Promise<CodexResponse>;
  cleanup: () => Promise<void>;
}

export const compileJavaCode = async (code: string): Promise<CompiledProgram> => {
  // Use a temporary folder in the backend directory to compile and run code
  const tempDir = path.join(process.cwd(), `temp_exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
  const timeoutMs = 10000; // 10 seconds execution timeout

  // 1. Create temp directory
  fs.mkdirSync(tempDir, { recursive: true });

  // 2. Write Main.java
  const filePath = path.join(tempDir, "Main.java");
  fs.writeFileSync(filePath, code, "utf8");

  // 3. Compile code
  console.log(`Compiling Java code locally in ${tempDir}...`);
  try {
    execSync("javac Main.java", { cwd: tempDir, stdio: "pipe", timeout: 15000 });
  } catch (compileError: any) {
    const stderr = (compileError.stderr && compileError.stderr.toString().trim())
      ? compileError.stderr.toString()
      : compileError.message;

    // Cleanup temp directory on compilation error
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (cleanupError: any) {
      console.error("Cleanup error in execution service after compilation failure:", cleanupError.message);
    }

    throw {
      isCompilationError: true,
      error: stderr,
    };
  }

  // 4. Return program runner interface
  return {
    run: (input = ""): Promise<CodexResponse> => {
      return new Promise<CodexResponse>((resolve) => {
        const child = exec("java -cp . Main", {
          cwd: tempDir,
          timeout: timeoutMs,
          killSignal: "SIGKILL",
        }, (error: any, stdout, stderr) => {
          if (error) {
            if (error.killed) {
              resolve({
                success: false,
                output: "",
                error: `Time Limit Exceeded (${timeoutMs / 1000} seconds)`,
              });
            } else {
              resolve({
                success: false,
                output: stdout,
                error: stderr || error.message,
              });
            }
          } else {
            resolve({
              success: true,
              output: stdout,
              error: stderr,
            });
          }
        });

        if (input) {
          child.stdin?.write(input);
          child.stdin?.end();
        } else {
          child.stdin?.end();
        }
      });
    },
    cleanup: async () => {
      try {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch (cleanupError: any) {
        console.error("Cleanup error in execution service:", cleanupError.message);
      }
    },
  };
};

export const executeJavaCode = async (code: string, input = ""): Promise<CodexResponse> => {
  try {
    const program = await compileJavaCode(code);
    try {
      return await program.run(input);
    } finally {
      await program.cleanup();
    }
  } catch (err: any) {
    if (err.isCompilationError) {
      return {
        success: false,
        output: "",
        error: err.error,
      };
    }
    return {
      success: false,
      output: "",
      error: `Execution system error: ${err.message || err}`,
    };
  }
};
