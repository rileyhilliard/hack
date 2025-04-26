# WebAI Proxy Quick Start

This NodeJS proxy server provides Ollama and OpenAI compatible interfaces for a backend AI service (e.g., one using WebAI's `/prompt` endpoint).

## Features

*   `GET /`: Health check.
*   `GET /api/tags`: Ollama model listing.
*   `POST /api/chat`: Ollama chat completions (streaming/non-streaming).
*   `GET /v1/models`: OpenAI model listing.
*   `POST /v1/chat/completions`: OpenAI chat completions (streaming/non-streaming).
*   `OPTIONS` requests for CORS preflight.

## Setup

1.  **Clone & Navigate:**
    ```bash
    git clone git@github.com:rileyhilliard/hack.git # Or your fork
    cd hack
    ```
2.  **Install Dependencies:**
    ```bash
    yarn install
    # or npm install
    ```

## Configuration

Configuration is primarily managed via a `.env` file in the `webai-proxy` directory. Create this file by copying the example:

```bash
cp .env.example .env
```

Then, edit `.env` to set your desired configuration:

*   `TARGET_DOMAIN`: Backend hostname (Default: `localhost`)
*   `TARGET_PORT`: Backend port (Default: `10501`)
*   `PROXY_DOMAIN`: Proxy hostname (Default: `localhost`)
*   `PROXY_PORT`: Proxy port (Default: `8080`)
*   `TARGET_API_KEY`: API key of the WebAI LLM server (sent as `X-API-Key` header).

## Running the Proxy

Ensure your `.env` file is configured correcrtly, then start the server using the compiled output:

```bash
# Run the proxy (reads settings from .env)
yarn start
```

The proxy will log its listening address and target connection status based on the `.env` settings.

## Endpoint Examples

*(Examples assume the proxy is running on `http://localhost:8080`)*

### Health Check (`GET /`)

```bash
curl http://localhost:8080/
# Expected: Ollama is running
```

--- 

### Ollama Compatibility

*(Note: The proxy prioritizes the `Authorization: Bearer <token>` header from your request. If not provided, it falls back to using the `TARGET_API_KEY` from the `.env` file*

#### List Models (`GET /api/tags`)

```bash
curl http://localhost:8080/api/tags
```
*(Returns a JSON list with a model named `webai-llm`)*

#### Chat (`POST /api/chat`)

**Non-Streaming:**
```bash
curl http://localhost:8080/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer the-machine-auth-token" \
  -d '{
    "model": "webai-llm",
    "messages": [{"role": "user", "content": "Why is the sky blue?"}],
    "stream": false
  }'
```
*(Returns a single Ollama-formatted JSON response)*

**Streaming:**
```bash
curl -N http://localhost:8080/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer the-machine-auth-token" \
  -d '{
    "model": "webai-llm",
    "messages": [{"role": "user", "content": "Why is the sky blue?"}],
    "stream": true
  }'
```
*(Returns newline-delimited Ollama JSON chunks, ending with `done: true`)*

--- 

### OpenAI Compatibility

#### List Models (`GET /v1/models`)

```bash
curl http://localhost:8080/v1/models
```
*(Returns an OpenAI-formatted JSON list with a model `id: "webai-llm"`)*

#### Chat Completions (`POST /v1/chat/completions`)

*(Note: The proxy prioritizes the `Authorization: Bearer <token>` header from your request. If not provided, it falls back to using the `TARGET_API_KEY` from the `.env` file, sending it as `X-API-Key` to the backend.)*

**Non-Streaming:**
```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer the-machine-auth-token" \
  -d '{
    "model": "webai-llm",
    "messages": [{"role": "user", "content": "Explain recursion."}],
    "stream": false
  }'
```
*(Returns a single OpenAI-formatted JSON response with approximated token usage)*

**Streaming:**
```bash
curl -N http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer the-machine-auth-token" \
  -d '{
    "model": "webai-llm",
    "messages": [{"role": "user", "content": "Explain recursion."}],
    "stream": true
  }'
```
*(Returns Server-Sent Events (SSE) stream ending with `data: [DONE]`)*
