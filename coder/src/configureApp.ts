import type { Hono } from 'hono'
import { logger } from 'hono/logger'


export default function configureApp(app: Hono): void {
  // Add Hono middleware with enhanced logging
  app.use('*', logger());
}
