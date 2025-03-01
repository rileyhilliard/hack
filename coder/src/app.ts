import { Hono } from 'hono'
import { setupRoutes } from '@/setupRoutes'
import { setupErrorHandlers } from '@/setupErrorHandlers'
import configureApp from '@/configureApp'

// Create a single instance
const app = new Hono()

setupErrorHandlers()
configureApp(app)
setupRoutes(app)

export default app
