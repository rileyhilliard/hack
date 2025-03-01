import { Hono } from 'hono';
import PostPr from '@/routes/pr/post';

export function setupRoutes(app: Hono): void {
  app.post('/pr', PostPr);
}
