import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execa } from 'execa';
import { setTimeout } from 'node:timers/promises';
import type { ChildProcess } from 'node:child_process';
import type { ChatCompletion, ChatCompletionChunk } from 'openai/resources/chat/completions'; // Use OpenAI types for validation

const TARGET_API_KEY = 'itdx3q3wpedgd38ikklejm'
// Configuration (same as ollama.test.ts)
const PROXY_HOST = process.env.PROXY_HOST || 'localhost';
const PROXY_PORT = process.env.PROXY_PORT || 8080;
const PROXY_URL = `http://${PROXY_HOST}:${PROXY_PORT}`;
const STARTUP_TIMEOUT = 30000;
const POLL_INTERVAL = 500;

let serverProcess: ChildProcess | null = null;

// Helper to wait for the server (same as ollama.test.ts)
async function waitForServer(url: string): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < STARTUP_TIMEOUT) {
    try {
      if (Date.now() === startTime) await setTimeout(200);
      const response = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(1000) });
      if (response.ok && response.status === 200) {
        console.log(`Server ready at ${url}`);
        return;
      }
    } catch (error) {
      // Ignore errors while waiting
    }
    await setTimeout(POLL_INTERVAL);
  }
  throw new Error(`Server failed to start at ${url} within ${STARTUP_TIMEOUT}ms`);
}

describe('OpenAI Compatible Endpoints', () => {
  // beforeAll (same setup as ollama.test.ts)
  beforeAll(async () => {
    console.log('Building project for tests...');
    try {
      await execa('yarn', ['build'], { stdio: 'inherit' });
    } catch (buildError) {
      console.error('Build failed:', buildError);
      throw new Error('Test setup failed: Build step error');
    }

    console.log('Starting proxy server for tests via start:prod...');
    try {
      serverProcess = execa('yarn', ['start:prod'], {
          detached: false,
          stdio: 'pipe',
          env: {
              ...process.env,
              TARGET_API_KEY, // Ensure API key is passed if needed by target
          }
      });

      serverProcess.stdout?.pipe(process.stdout);
      serverProcess.stderr?.pipe(process.stderr);

      console.log(`Waiting for server to be ready at ${PROXY_URL}...`);
      await waitForServer(PROXY_URL);

    } catch (error) {
      console.error('Failed to start server:', error);
      if (serverProcess && !serverProcess.killed) {
        serverProcess.kill('SIGTERM');
      }
      throw error;
    }
  }, STARTUP_TIMEOUT + 5000);

  // afterAll (same teardown as ollama.test.ts)
  afterAll(async () => {
    if (serverProcess && !serverProcess.killed) {
      console.log('\nShutting down proxy server...');
      serverProcess.kill();
      try {
         await Promise.race([
            (serverProcess as any).catch(() => {}),
            setTimeout(2000)
         ]);
         console.log('Server process termination signal sent.');
      } catch(e: any) {
          if (e.signal !== 'SIGTERM') {
            console.warn('Error during server shutdown:', e.shortMessage);
          }
      }
     await setTimeout(500);
    }
  });

  // --- OpenAI Specific Tests ---

  it('GET /v1/models should return OpenAI model list format', async () => {
    const response = await fetch(`${PROXY_URL}/v1/models`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');

    const data = await response.json();
    expect(data).toHaveProperty('object', 'list');
    expect(data).toHaveProperty('data');
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);

    const model = data.data[0];
    expect(model).toHaveProperty('id', 'webai-llm'); // Should match the ID defined in the handler
    expect(model).toHaveProperty('object', 'model');
    expect(model).toHaveProperty('created');
    expect(typeof model.created).toBe('number');
    expect(model).toHaveProperty('owned_by', 'webai-proxy');
  });

  it('POST /v1/chat/completions (non-streaming) should return OpenAI ChatCompletion format', async () => {
    const requestBody = {
      model: 'webai-llm', // Must match one of the IDs from /v1/models
      messages: [{ role: 'user', content: 'Hello?' }],
      stream: false,
    };

    const response = await fetch(`${PROXY_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TARGET_API_KEY}` // OpenAI endpoints often require auth
      },
      body: JSON.stringify(requestBody),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');

    const data: ChatCompletion = await response.json();

    // Basic structure checks based on OpenAI spec
    expect(data).toHaveProperty('id');
    expect(typeof data.id).toBe('string');
    expect(data.id).toMatch(/^chatcmpl-/); // OpenAI IDs usually start with this prefix
    expect(data).toHaveProperty('object', 'chat.completion');
    expect(data).toHaveProperty('created');
    expect(typeof data.created).toBe('number');
    expect(data).toHaveProperty('model', 'webai-llm'); // Should reflect the requested/served model
    expect(data).toHaveProperty('choices');
    expect(Array.isArray(data.choices)).toBe(true);
    expect(data.choices.length).toBeGreaterThan(0);

    // Check the first choice
    const choice = data.choices[0];
    expect(choice).toHaveProperty('index', 0);
    expect(choice).toHaveProperty('message');
    expect(choice.message).toHaveProperty('role', 'assistant');
    expect(choice.message).toHaveProperty('content');
    expect(typeof choice.message.content).toBe('string');
    expect(choice.message.content).not.toBeNull();
    expect(choice.message.content!.length).toBeGreaterThan(0);
    expect(choice).toHaveProperty('finish_reason', 'stop'); // Common finish reason

    // Check usage field for non-zero token counts (approximation)
    expect(data).toHaveProperty('usage');
    expect(typeof data.usage!.prompt_tokens).toBe('number');
    expect(data.usage!.prompt_tokens).toBeGreaterThan(0); // Should be > 0 for "Hello?"
    expect(typeof data.usage!.completion_tokens).toBe('number');
    expect(data.usage!.completion_tokens).toBeGreaterThan(0); // Response has content
    expect(typeof data.usage!.total_tokens).toBe('number');
    expect(data.usage!.total_tokens).toBeGreaterThan(0);
    expect(data.usage!.total_tokens).toEqual(data.usage!.prompt_tokens + data.usage!.completion_tokens);

  }, 20000);

  it('POST /v1/chat/completions (streaming) should return text/event-stream chunks', async () => {
    const requestBody = {
      model: 'webai-llm',
      messages: [{ role: 'user', content: 'Hello?' }],
      stream: true,
    };

    const response = await fetch(`${PROXY_URL}/v1/chat/completions`, {
      method: 'POST', 
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TARGET_API_KEY}`  
      },
      body: JSON.stringify(requestBody),
    });

    expect(response.status).toBe(200);
    // IMPORTANT: OpenAI streaming uses text/event-stream
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(response.body).not.toBeNull();

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let chunksReceived = 0;
    let doneReceived = false;
    let fullContent = '';
    let firstChunkReceived = false;
    let modelName = '';
    let completionId = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process buffer line by line (event stream can have multiple lines per chunk)
      let eventEndIndex;
      while ((eventEndIndex = buffer.indexOf('\n\n')) >= 0) {
        const eventBlock = buffer.slice(0, eventEndIndex);
        buffer = buffer.slice(eventEndIndex + 2); // Move past the double newline

        if (eventBlock.startsWith('data: ')) {
            const dataLine = eventBlock.substring(5).trim(); // Get content after 'data: '

            if (dataLine === '[DONE]') {
                doneReceived = true;
                break; // Exit inner loop once [DONE] is found
            }

             try {
                const chunk: ChatCompletionChunk = JSON.parse(dataLine);
                chunksReceived++;

                // Common properties for all chunks
                expect(chunk).toHaveProperty('id');
                expect(typeof chunk.id).toBe('string');
                expect(chunk.id).toMatch(/^chatcmpl-/);
                expect(chunk).toHaveProperty('object', 'chat.completion.chunk');
                expect(chunk).toHaveProperty('created');
                expect(typeof chunk.created).toBe('number');
                expect(chunk).toHaveProperty('model'); // Should contain the model name

                // Store ID and model from the first chunk
                if (!firstChunkReceived) {
                    firstChunkReceived = true;
                    completionId = chunk.id;
                    modelName = chunk.model;
                } else {
                    // Ensure consistent ID and model across chunks
                    expect(chunk.id).toEqual(completionId);
                    expect(chunk.model).toEqual(modelName);
                }

                expect(chunk).toHaveProperty('choices');
                expect(Array.isArray(chunk.choices)).toBe(true);
                expect(chunk.choices.length).toBeGreaterThan(0);

                const choice = chunk.choices[0];
                expect(choice).toHaveProperty('index', 0);
                expect(choice).toHaveProperty('delta');

                // Role usually appears only in the first delta
                if (choice.delta.role) {
                    expect(choice.delta.role).toBe('assistant');
                }

                // Accumulate content
                if (choice.delta.content) {
                    expect(typeof choice.delta.content).toBe('string');
                    fullContent += choice.delta.content;
                }

                 // Check for finish_reason (should be null until the last chunk)
                 // The actual last content chunk might have finish_reason: null
                 // A separate chunk might arrive with ONLY finish_reason: 'stop'
                 if (choice.finish_reason !== null && choice.finish_reason !== undefined) {
                     expect(choice.finish_reason).toBe('stop');
                 }

            } catch (e) {
                console.error('Failed to parse JSON chunk:', dataLine, e);
                throw new Error(`Failed to parse JSON chunk: ${dataLine}`);
            }
        }
      }
      if (doneReceived) break; // Exit outer loop if [DONE] was processed
    }

    // Final checks after stream ends
    expect(chunksReceived).toBeGreaterThan(0);
    expect(doneReceived).toBe(true);
    expect(fullContent.length).toBeGreaterThan(0); // Ensure some content was actually streamed
    expect(modelName).toEqual('webai-llm'); // Verify the model name was consistent
    expect(completionId).toMatch(/^chatcmpl-/); // Verify a valid-looking ID was generated

    // Handle any remaining data in the buffer
    if (buffer.trim() && buffer.trim() !== 'data: [DONE]') {
      console.warn('Remaining buffer content after stream ended:', buffer);
    }

  }, 40000); // Increased timeout for streaming test

  it('OPTIONS /v1/chat/completions should return CORS headers', async () => {
    const response = await fetch(`${PROXY_URL}/v1/chat/completions`, { method: 'OPTIONS' });
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('access-control-allow-methods')).toContain('POST');
    expect(response.headers.get('access-control-allow-methods')).toContain('OPTIONS');
    expect(response.headers.get('access-control-allow-headers')).toContain('content-type');
    expect(response.headers.get('access-control-allow-headers')).toContain('authorization');
  });

  it('POST /v1/chat/completions with invalid JSON should return 400', async () => {
    const response = await fetch(`${PROXY_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TARGET_API_KEY}`
      },
      body: '{ "model": "webai-llm", "messages": [{\"role\": \"user\", \"content\": \"bad json\"] }',
    });
    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toContain('application/json');
    const errorData = await response.json();
    expect(errorData).toHaveProperty('error', 'Invalid JSON in Request Body');
  });

  // --- Authentication Scenario Tests ---

  it('POST /v1/chat/completions with NO Authorization header should SUCCEED (using TARGET_API_KEY from env)', async () => {
    const requestBody = {
      model: 'webai-llm',
      messages: [{ role: 'user', content: 'Hello?' }],
      stream: false,
    };

    const response = await fetch(`${PROXY_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // No Authorization header
      },
      body: JSON.stringify(requestBody),
    });

    // Expect success because TARGET_API_KEY in env should be used as fallback
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('object', 'chat.completion');
  }, 10000); // Add timeout

  it('POST /v1/chat/completions with INVALID Authorization header should SUCCEED (using TARGET_API_KEY from env)', async () => {
    const requestBody = {
      model: 'webai-llm',
      messages: [{ role: 'user', content: 'Hello?' }],
      stream: false,
    };

    const response = await fetch(`${PROXY_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic dXNlcjpwYXNz' // Invalid format (should be Bearer)
      },
      body: JSON.stringify(requestBody),
    });

    // Expect success because the invalid header should be ignored, falling back to TARGET_API_KEY
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('object', 'chat.completion');
  }, 10000); // Add timeout

  it('POST /v1/chat/completions with INCORRECT Bearer token should return specific 401 message', async () => {
    const requestBody = {
      model: 'webai-llm',
      messages: [{ role: 'user', content: 'Hello?' }],
      stream: false,
    };

    const response = await fetch(`${PROXY_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer incorrect-token-value' // Correct format, wrong key
      },
      body: JSON.stringify(requestBody),
    });

    // Expect failure because the proxy should forward the incorrect token, and the backend should reject it.
    expect(response.status).toBe(401);
    expect(response.headers.get('content-type')).toContain('application/json');
    const errorData = await response.json();
    // Check the original error message format
    expect(errorData).toHaveProperty('error');
    expect(errorData.error).toContain('Authentication error: Unauthorized access to the target server.');
    expect(errorData.error).toContain("Setting the TARGET_API_KEY environment variable");
    expect(errorData.error).toContain("Sending an 'Authorization: Bearer <your-token>' header");
     // expect(errorData).toHaveProperty('details'); // Original format didn't have details key
  });

  // Add more tests here (e.g., invalid auth, multiple messages)

});

// --- Timeout Test Suite ---
describe('OpenAI Timeout Handling', () => {
  let timeoutServerProcess: ChildProcess | null = null;
  const SHORT_TIMEOUT_MS = 10; // Very short timeout

  beforeAll(async () => {
    console.log(`Starting proxy server for TIMEOUT test with TARGET_TIMEOUT_MS=${SHORT_TIMEOUT_MS}...`);
    try {
      // Assuming build is already done by the main suite's beforeAll
      timeoutServerProcess = execa('yarn', ['start:prod'], {
          detached: false,
          stdio: 'pipe',
          env: {
              ...process.env,
              TARGET_API_KEY, // Use the same valid API key
              PROXY_PORT: String(parseInt(process.env.PROXY_PORT || '8080') + 1), // Use a different port to avoid collision
              TARGET_TIMEOUT_MS: String(SHORT_TIMEOUT_MS),
          }
      });

      timeoutServerProcess.stdout?.pipe(process.stdout);
      timeoutServerProcess.stderr?.pipe(process.stderr);

      const timeoutProxyUrl = `http://${PROXY_HOST}:${parseInt(process.env.PROXY_PORT || '8080') + 1}`;
      console.log(`Waiting for TIMEOUT server to be ready at ${timeoutProxyUrl}...`);
      // Use the same waitForServer helper
      await waitForServer(timeoutProxyUrl);

    } catch (error) {
      console.error('Failed to start server for TIMEOUT test:', error);
      if (timeoutServerProcess && !timeoutServerProcess.killed) {
        timeoutServerProcess.kill('SIGTERM');
      }
      throw error;
    }
  }, STARTUP_TIMEOUT + 5000); // Use similar timeout as main suite

  afterAll(async () => {
    if (timeoutServerProcess && !timeoutServerProcess.killed) {
      console.log('\nShutting down TIMEOUT proxy server...');
      timeoutServerProcess.kill();
      try {
         await Promise.race([
            (timeoutServerProcess as any).catch(() => {}),
            setTimeout(2000)
         ]);
         console.log('TIMEOUT Server process termination signal sent.');
      } catch(e: any) {
          if (e.signal !== 'SIGTERM') {
            console.warn('Error during TIMEOUT server shutdown:', e.shortMessage);
          }
      }
     await setTimeout(500);
    }
  });

  it('POST /v1/chat/completions should return 504 when backend times out', async () => {
    const requestBody = {
      model: 'webai-llm',
      messages: [{ role: 'user', content: 'This request will time out' }],
      stream: false,
    };
    const timeoutProxyUrl = `http://${PROXY_HOST}:${parseInt(process.env.PROXY_PORT || '8080') + 1}`;

    const response = await fetch(`${timeoutProxyUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TARGET_API_KEY}` // Need valid auth even for timeout test
      },
      body: JSON.stringify(requestBody),
    });

    expect(response.status).toBe(504); // Gateway Timeout
    expect(response.headers.get('content-type')).toContain('application/json');
    const errorData = await response.json();
    // Check the original error message format
    expect(errorData).toHaveProperty('error', 'Backend server response timed out.');
     // expect(errorData).toHaveProperty('details'); // Original format didn't have details key

  }, SHORT_TIMEOUT_MS + 5000); // Test timeout slightly longer than the server timeout
}); 