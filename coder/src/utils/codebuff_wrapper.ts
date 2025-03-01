import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

/**
 * Run Codebuff using the shell script
 * @param repoPath Path to the repository
 * @param instructions Instructions for Codebuff
 * @param context Context information
 * @returns Promise with the result
 */
export function runCodebuff(repoPath: string, instructions: string, context: string): Promise<{ result: string }> {
  return new Promise((resolve, reject) => {
    // Get the path to the shell script
    const scriptPath = path.join(__dirname, 'codebuff_cli.sh');

    // Make sure the script is executable
    try {
      fs.chmodSync(scriptPath, '755');
    } catch (error) {
      console.error(`Failed to make script executable: ${error}`);
      return reject(error);
    }

    // Spawn the shell script process
    const process = spawn(scriptPath, [
      repoPath,
      instructions,
      context
    ], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    // Collect stdout
    process.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      console.log(chunk); // Log output in real-time
    });

    // Collect stderr
    process.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      console.error(chunk); // Log errors in real-time
    });

    // Handle process completion
    process.on('close', (code) => {
      console.log(`Codebuff process exited with code ${code}`);

      if (code !== 0) {
        console.error(`Codebuff script failed with code ${code}`);
        return reject(new Error(`Process exited with code ${code}: ${stderr}`));
      }

      // Extract the result from between the RESULT_START and RESULT_END markers
      const resultMatch = stdout.match(/RESULT_START\n([\s\S]*)\nRESULT_END/);
      const result = resultMatch ? resultMatch[1] : stdout;

      console.log('Codebuff execution completed successfully');
      resolve({ result });
    });

    // Handle process errors
    process.on('error', (err) => {
      console.error(`Failed to start Codebuff process: ${err}`);
      reject(err);
    });

    // Set a timeout (10 minutes)
    const timeout = setTimeout(() => {
      process.kill();
      reject(new Error('Codebuff process timed out after 10 minutes'));
    }, 10 * 60 * 1000);

    // Clear the timeout when the process exits
    process.on('exit', () => {
      clearTimeout(timeout);
    });
  });
}
