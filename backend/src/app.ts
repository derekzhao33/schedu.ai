import dotenv from 'dotenv';
import express from 'express';

// Load environment variables FIRST
dotenv.config();

// Temporarily commented out - requires database setup
// import taskRoutes from './services/tasks/task.routes'
import userRoutes from './services/users/user.routes.js';
import googleCalendarRoutes from './services/google-calendar/google-calendar.routes.js';
// import { errorHandler } from './middlewares/errorHandler.js';

// import assistantRoutes from './services/assistant/assistant.routes.js'

const app = express();

// Enable CORS for frontend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// Routes
// Temporarily disabled - requires database setup
// app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);

// Google Calendar routes (works without database)
app.use('/api/google-calendar', googleCalendarRoutes);

// app.use('/api/assistant', assistantRoutes);

// Global error handler (should be after routes)
// app.use(errorHandler);

export default app;