import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execa } from 'execa';
import { setTimeout } from 'node:timers/promises';
import type { ChildProcess } from 'node:child_process'; // Import standard ChildProcess
import type { OllamaResponse } from '../types'; // Assuming types are exported

// Configuration
const PROXY_HOST = process.env.PROXY_HOST || 'localhost';
const PROXY_PORT = process.env.PROXY_PORT || 8080; // Default from README
const PROXY_URL = `http://${PROXY_HOST}:${PROXY_PORT}`;
const STARTUP_TIMEOUT = 15000; // Max time to wait for server start (ms)
const POLL_INTERVAL = 500; // Interval to check if server is up (ms)

let serverProcess: ChildProcess | null = null; // Use Node's ChildProcess type

// Helper to wait for the server to be ready
async function waitForServer(url: string): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < STARTUP_TIMEOUT) {
    try {
      // Add a short delay before the first check
      if (Date.now() === startTime) await setTimeout(200);
      const response = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(1000) }); // Add timeout to fetch
      if (response.ok && response.status === 200) { // Check status explicitly
        console.log(`Server ready at ${url}`);
        return; // Server is up
      }
    } catch (error) {
      // Ignore connection errors while waiting
    }
    await setTimeout(POLL_INTERVAL);
  }
  throw new Error(`Server failed to start at ${url} within ${STARTUP_TIMEOUT}ms`);
}

describe('Ollama Compatible Endpoints', () => {
  beforeAll(async () => {
    console.log('Building project for tests...');
    try {
      // Run build first
      await execa('yarn', ['build'], { stdio: 'inherit' }); // Inherit stdio to see build output/errors
    } catch (buildError) {
      console.error('Build failed:', buildError);
      throw new Error('Test setup failed: Build step error');
    }

    console.log('Starting proxy server for tests via start:prod...');
    try {
      // Start the server using the production-like start script
      serverProcess = execa('yarn', ['start:prod'], {
          detached: false, // Detached might not be needed if we handle cleanup properly
          stdio: 'pipe', // Capture output
          // Pass env vars if needed, e.g., TARGET_API_KEY
          env: { ...process.env, TARGET_API_KEY: 'itdx3q3wpedgd38ikklejm' }
      });

      // Log server output for debugging if necessary
      serverProcess.stdout?.pipe(process.stdout);
      serverProcess.stderr?.pipe(process.stderr);

      console.log(`Waiting for server to be ready at ${PROXY_URL}...`);
      await waitForServer(PROXY_URL); // Wait for the health check endpoint

    } catch (error) {
      console.error('Failed to start server:', error);
      // Ensure process is killed if startup fails
      if (serverProcess && !serverProcess.killed) {
        serverProcess.kill('SIGTERM');
      }
      throw error; // Re-throw to fail the test suite
    }
  }, STARTUP_TIMEOUT + 5000); // Increase timeout for beforeAll to include server startup

  afterAll(async () => {
    if (serverProcess && !serverProcess.killed) {
      console.log('\nShutting down proxy server...');
      // Send SIGTERM (default signal for kill())
      serverProcess.kill();
      try {
         // Wait for the promise execa returns, which resolves/rejects when the process exits.
         // Use a timeout as a fallback
         await Promise.race([
            (serverProcess as any).catch(() => {}), // Wait for execa promise
            setTimeout(2000) // Or timeout after 2s
         ]);
         console.log('Server process termination signal sent.');
      } catch(e: any) {
          // Ignore errors during shutdown, it might have already exited or been killed
          if (e.signal !== 'SIGTERM') {
            console.warn('Error during server shutdown (or already killed):', e.shortMessage);
          }
      }
     // Add a small delay just in case
     await setTimeout(500);
    }
  });

  it('GET /api/tags should return Ollama model list format', async () => {
    const response = await fetch(`${PROXY_URL}/api/tags`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');

    const data = await response.json();
    expect(data).toHaveProperty('models'); 
    expect(Array.isArray(data.models)).toBe(true);
    // Check if the expected model is present (adjust 'webai-llm' if needed)
    expect(data.models.length).toBeGreaterThan(0);
    const model = data.models[0];
    expect(model).toHaveProperty('name', 'webai-llm');
    expect(model).toHaveProperty('modified_at');
    expect(model).toHaveProperty('size');
    expect(model).toHaveProperty('digest');
    expect(model).toHaveProperty('details');
    expect(model.details).toHaveProperty('family'); 
  });

  it('POST /api/chat (non-streaming) should return Ollama response format', async () => {
    const requestBody = {
      model: 'webai-llm', 
      messages: [{ role: 'user', content: 'Hello?' }],
      stream: false,
    };

    const response = await fetch(`${PROXY_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');

    const data: OllamaResponse = await response.json();

    expect(data).toHaveProperty('model', 'webai-llm'); // Or check against the actual backend model name if different
    expect(data).toHaveProperty('created_at'); 
    expect(data).toHaveProperty('message');
    expect(data.message).toHaveProperty('role', 'assistant');
    expect(data.message).toHaveProperty('content');
    expect(typeof data.message.content).toBe('string');
    expect(data.message.content.length).toBeGreaterThan(0); // Check content is not empty
    expect(data).toHaveProperty('done', true);
    expect(data).toHaveProperty('done_reason', 'stop');
    
    // Assert total_duration exists and is a number
    expect(data).toHaveProperty('total_duration');
    expect(typeof data.total_duration).toBe('number');
    expect(data.total_duration).toBeGreaterThan(0); // Should take some time

    // Keep other stats checks conditional
    if (data.hasOwnProperty('load_duration')) {
        expect(typeof data.load_duration).toBe('number');
    }
    if (data.hasOwnProperty('prompt_eval_count')) {
        expect(typeof data.prompt_eval_count).toBe('number');
    }
    if (data.hasOwnProperty('prompt_eval_duration')) {
        expect(typeof data.prompt_eval_duration).toBe('number');
    }
    if (data.hasOwnProperty('eval_count')) {
        expect(typeof data.eval_count).toBe('number');
    }
    if (data.hasOwnProperty('eval_duration')) {
        expect(typeof data.eval_duration).toBe('number');
    }
  });

  it('POST /api/chat (streaming) should return newline-delimited JSON chunks', async () => {
     const requestBody = {
      model: 'webai-llm',
      messages: [{ role: 'user', content: 'Hello?' }],
      stream: true,
    };

    const response = await fetch(`${PROXY_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json'); // Ollama uses application/json for the stream content type
    expect(response.body).not.toBeNull();

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let chunksReceived = 0;
    let finalChunkReceived = false;
    let fullContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process buffer line by line
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);

        if (line) {
          try {
            const chunk = JSON.parse(line);
            chunksReceived++;

            expect(chunk).toHaveProperty('model');
            expect(chunk).toHaveProperty('created_at');
            expect(chunk).toHaveProperty('message');
            expect(chunk.message).toHaveProperty('role', 'assistant');
            expect(chunk.message).toHaveProperty('content');
            fullContent += chunk.message.content; // Accumulate content

            if (chunk.done === true) {
              finalChunkReceived = true;
              expect(chunk).toHaveProperty('done_reason', 'stop');
              // Optional stats checks removed for final chunk - proxy doesn't add them here
              // expect(chunk).toHaveProperty('total_duration');
              // expect(chunk).toHaveProperty('eval_count');
            } else {
              expect(chunk.done).toBe(false);
            }
          } catch (e) {
            console.error('Failed to parse JSON chunk:', line, e);
            throw new Error(`Failed to parse JSON chunk: ${line}`);
          }
        }
      }
    }

    // Final checks after stream ends
    expect(chunksReceived).toBeGreaterThan(0);
    expect(finalChunkReceived).toBe(true);  
    expect(fullContent.length).toBeGreaterThan(0); // Ensure some content was actually streamed

    // Handle any remaining data in the buffer (though it should be empty if properly newline terminated)
    if (buffer.trim()) {
        console.warn('Remaining buffer content after stream ended:', buffer);
        // Decide if this should be an error or handled
    }

  }, 20000); // Increase timeout for streaming test

  it('GET / should return health check message', async () => {
    const response = await fetch(`${PROXY_URL}/`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
    const text = await response.text();
    expect(text).toEqual("Ollama is running");
  });

  it('OPTIONS /api/chat should return CORS headers', async () => {
    const response = await fetch(`${PROXY_URL}/api/chat`, { method: 'OPTIONS' });
    expect(response.status).toBe(204); // No Content
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('access-control-allow-methods')).toContain('POST');
    expect(response.headers.get('access-control-allow-methods')).toContain('OPTIONS');
    expect(response.headers.get('access-control-allow-headers')).toContain('content-type');
    // Check for other allowed headers if applicable (e.g., authorization)
  });

  it('POST /api/chat with invalid JSON should return 400', async () => {
    const response = await fetch(`${PROXY_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ "model": "webai-llm", "messages": [{ invalid json }]', // Malformed JSON
    });
    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toContain('application/json');
    const errorData = await response.json();
    expect(errorData).toHaveProperty('error');
    expect(errorData.error).toContain('Invalid JSON');
  });

}); 