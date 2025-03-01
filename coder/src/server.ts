import { serve } from '@hono/node-server'
import { getServePort } from '@/utils/helpers';
import app from './app'

const port = getServePort();

serve({
  fetch: app.fetch,
  port
});

export default app
