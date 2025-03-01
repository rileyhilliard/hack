import { spawn } from 'child_process';
import readline from 'readline';

export function runCodebuff(repoPath: string, instructions: string, context: string): Promise<{ result: string }> {
  return new Promise((resolve, reject) => {
    const ___rez = `
      Codebuff: Reading files:
      - set-gifs.js
      - index.html
      - gifs.js

      I can see the issue in the \`set-gifs.js\` file. There's a bug where the line that creates the image element is commented out, but then the code tries to use the \`img\` variable which hasn't been defined.

      Let me fix this issue:

      - Editing file: set-gifs.js ...

      The issue has been fixed. I uncommented the line \`const img = document.createElement('img');\` which was previously commented out. This was causing the error because the code was trying to use the \`img\` variable before it was defined.

      Now when you click the "hit me" button, the application should properly:
      1. Show a loading message
      2. Create an image element
      3. Set the source to a random GIF from your array
      4. Display the image once it's loaded
      5. Show an error message if the image fails to load

      The error "ReferenceError: img is not defined" should no longer occur.

      Applying file changes, please wait.

      - Updated set-gifs.js
    `;
    return resolve({ result: ___rez });
    // disabling for now so I dont burn credits

    const folderName = repoPath.split('/').pop();

    // Spawn the Codebuff process in the specified repository path
    const codebuff = spawn('yarn', ['codebuff'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: repoPath
    });

    // Create interface to read output
    const rl = readline.createInterface({
      input: codebuff.stdout,
      output: process.stdout
    });

    let hasSubmittedInstructions = false;
    let isCompleted = false;
    let result = '';

    // Listen for prompts and respond
    rl.on('line', (line) => {
      console.log(`Received: ${line}`);

      // When you see the prompt for the first time, send instructions
      if (line.includes(`${folderName} >`) && !hasSubmittedInstructions) {
        console.log('Sending instructions...');
        codebuff.stdin.write(`I need help fixing an issue: ${instructions}. Here's some log context: ${context}\n`);
        hasSubmittedInstructions = true;
      }
      // When you see "Complete!" and then the prompt again, send exit command
      else if (isCompleted && line.includes(`${folderName} >`)) {
        console.log('Task completed, exiting...');
        codebuff.stdin.write('exit\n');
      }

      // Check for completion message
      if (!isCompleted && line.includes('used for this request')) {
        isCompleted = true;
        resolve({ result });
      }

      // Collect output after instructions have been submitted
      if (hasSubmittedInstructions) {
        result += line + '\n';
      }
    });

    // Handle process errors
    codebuff.stderr.on('data', (data) => {
      console.error(`Error: ${data}`);
    });

    // Handle process exit
    codebuff.on('close', (code) => {
      console.log('Codebuff has been closed');
    });

    // Handle potential errors
    codebuff.on('error', (err) => {
      console.error('Failed to start Codebuff process:', err);
      reject(err);
    });
  });
}
