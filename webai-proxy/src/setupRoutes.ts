import { Hono } from 'hono';

export function setupRoutes(app: Hono): void {
  app.get('/', (c) => c.text("It's alive!"));
}
