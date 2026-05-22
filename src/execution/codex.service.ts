import fs from "fs";
import path from "path";
import { exec, execSync } from "child_process";

export interface CodexResponse {
  success: boolean;
  output: string;
  error: string;
}

export const executeJavaCode = async (code: string, input = ""): Promise<CodexResponse> => {
  // Use a temporary folder in the backend directory to compile and run code
  const tempDir = path.join(process.cwd(), `temp_exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
  const timeoutMs = 8000; // 8 seconds execution timeout

  try {
    // 1. Create temp directory
    fs.mkdirSync(tempDir, { recursive: true });

    // 2. Write Main.java
    const filePath = path.join(tempDir, "Main.java");
    fs.writeFileSync(filePath, code, "utf8");

    // 3. Compile code
    console.log(`Compiling Java code locally in ${tempDir}...`);

    try {
      execSync("javac Main.java", { cwd: tempDir, stdio: "pipe", timeout: 5000 });
    } catch (compileError: any) {
      const stderr = compileError.stderr ? compileError.stderr.toString() : compileError.message;
      return {
        success: false,
        output: "",
        error: stderr,
      };
    }

    // 4. Run code
    console.log("Running Java code locally...");
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
  } catch (err: any) {
    console.error("Local execution system error:", err);
    return {
      success: false,
      output: "",
      error: `Execution system error: ${err.message}`,
    };
  } finally {
    // 5. Cleanup temp directory asynchronously to avoid blocking
    setTimeout(() => {
      try {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch (cleanupError: any) {
        console.error("Cleanup error in execution service:", cleanupError.message);
      }
    }, 1000);
  }
};
