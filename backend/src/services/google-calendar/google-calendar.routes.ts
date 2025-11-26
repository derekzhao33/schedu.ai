import { Router } from 'express';
import { googleCalendarService } from './google-calendar.service.js';
import prisma from '../../shared/prisma.js';
import { updateTask } from '../tasks/task.service.js';

const router = Router();

// Get authentication URL
router.get('/auth/url', (req, res) => {
  try {
    console.log('Request to /auth/url received');
    const authUrl = googleCalendarService.getAuthUrl();
    console.log('Generated auth URL:', authUrl);
    res.json({ authUrl });
  } catch (error: any) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ error: error.message || 'Failed to generate authentication URL' });
  }
});

// Handle OAuth callback
router.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Authorization code is required' });
  }

  try {
    const tokens = await googleCalendarService.getTokens(code);

    // Get user ID from state parameter or use default
    const userId = state ? parseInt(state as string) : 1; // Default to user ID 1 for now

    // Store tokens in database
    await prisma.user.update({
      where: { id: userId },
      data: {
        google_access_token: tokens.access_token,
        google_refresh_token: tokens.refresh_token,
        google_token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null
      }
    });

    // Redirect back to frontend
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}?google_auth=success`);
  } catch (error) {
    console.error('Error handling callback:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}?google_auth=error`);
  }
});

// Get calendar events
router.get('/events', async (req, res) => {
  try {
    // Get user ID from query or default to 1
    const userId = req.query.userId ? parseInt(req.query.userId as string) : 1;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        google_access_token: true,
        google_refresh_token: true,
        google_token_expiry: true
      }
    });

    if (!user?.google_access_token || !user?.google_refresh_token) {
      return res.status(401).json({
        error: 'Not authenticated with Google Calendar',
        needsAuth: true
      });
    }

    // Check if token is expired and refresh if needed
    let accessToken = user.google_access_token;
    if (user.google_token_expiry && new Date() > user.google_token_expiry) {
      const newTokens = await googleCalendarService.refreshAccessToken(user.google_refresh_token);
      accessToken = newTokens.access_token!;
      
      await prisma.user.update({
        where: { id: userId },
        data: {
          google_access_token: newTokens.access_token,
          google_token_expiry: newTokens.expiry_date ? new Date(newTokens.expiry_date) : null
        }
      });
    }

    // Parse date range from query params
    const { timeMin, timeMax } = req.query;
    const minDate = timeMin ? new Date(timeMin as string) : new Date();
    const maxDate = timeMax ? new Date(timeMax as string) : undefined;

    const result = await googleCalendarService.getEvents(
      accessToken,
      user.google_refresh_token,
      minDate,
      maxDate
    );

    res.json(result);
  } catch (error: any) {
    console.error('Error fetching events:', error);

    if (error.message === 'Token expired or invalid') {
      return res.status(401).json({
        error: 'Token expired. Please re-authenticate.',
        needsAuth: true
      });
    }

    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

// Check authentication status
router.get('/auth/status', async (req, res) => {
  try {
    const userId = req.query.userId ? parseInt(req.query.userId as string) : 1;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        google_access_token: true,
        google_refresh_token: true
      }
    });

    res.json({
      authenticated: !!(user?.google_access_token),
      hasRefreshToken: !!(user?.google_refresh_token)
    });
  } catch (error) {
    console.error('Error checking auth status:', error);
    res.status(500).json({ error: 'Failed to check authentication status' });
  }
});

// Logout / disconnect
router.post('/auth/disconnect', async (req, res) => {
  try {
    const userId = req.body.userId || 1;

    await prisma.user.update({
      where: { id: userId },
      data: {
        google_access_token: null,
        google_refresh_token: null,
        google_token_expiry: null,
        google_calendar_sync_token: null,
        google_calendar_last_sync: null
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting:', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

// Sync Google Calendar changes to local tasks
router.post('/sync', async (req, res) => {
  try {
    const userId = req.body.userId || 1;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        google_access_token: true,
        google_refresh_token: true,
        google_token_expiry: true,
        google_calendar_sync_token: true
      }
    });

    if (!user?.google_access_token || !user?.google_refresh_token) {
      return res.status(401).json({
        error: 'Not authenticated with Google Calendar',
        needsAuth: true
      });
    }

    // Check if token is expired and refresh if needed
    let accessToken = user.google_access_token;
    if (user.google_token_expiry && new Date() > user.google_token_expiry) {
      const newTokens = await googleCalendarService.refreshAccessToken(user.google_refresh_token);
      accessToken = newTokens.access_token!;

      await prisma.user.update({
        where: { id: userId },
        data: {
          google_access_token: newTokens.access_token,
          google_token_expiry: newTokens.expiry_date ? new Date(newTokens.expiry_date) : null
        }
      });
    }

    // Fetch events using sync token for incremental sync
    const result = await googleCalendarService.getEvents(
      accessToken,
      user.google_refresh_token,
      undefined,
      undefined,
      user.google_calendar_sync_token || undefined
    );

    // Process each event and sync with local tasks
    let created = 0;
    let updated = 0;
    let deleted = 0;

    for (const event of result.events) {
      // Skip if event doesn't have proper time information
      if (!event.date) continue;

      // Parse event times
      let startTime: Date;
      let endTime: Date;

      if (event.startTime && event.endTime) {
        // Timed event
        const [startHour, startMin] = event.startTime.split(':').map(Number);
        const [endHour, endMin] = event.endTime.split(':').map(Number);

        startTime = new Date(event.date);
        startTime.setHours(startHour!, startMin!);

        endTime = new Date(event.date);
        endTime.setHours(endHour!, endMin!);
      } else {
        // All-day event
        startTime = new Date(event.date);
        startTime.setHours(0, 0, 0, 0);

        endTime = new Date(event.date);
        endTime.setHours(23, 59, 59, 999);
      }

      // Check if event is cancelled (deleted in Google Calendar)
      if (event.status === 'cancelled') {
        // Find and delete the task
        const existingTask = await prisma.task.findFirst({
          where: {
            google_event_id: event.googleEventId,
            user_id: userId
          }
        });

        if (existingTask) {
          await prisma.task.delete({ where: { id: existingTask.id } });
          deleted++;
        }
        continue;
      }

      // Check if task already exists
      const existingTask = await prisma.task.findFirst({
        where: {
          google_event_id: event.googleEventId,
          user_id: userId
        }
      });

      if (existingTask) {
        // Update existing task (skip Google sync to prevent loop)
        await updateTask(
          existingTask.id,
          {
            name: event.name,
            description: event.description || null,
            start_time: startTime,
            end_time: endTime
          },
          true // Skip Google Calendar sync
        );
        updated++;
      } else {
        // Create new task
        await prisma.task.create({
          data: {
            name: event.name,
            description: event.description || null,
            start_time: startTime,
            end_time: endTime,
            google_event_id: event.googleEventId,
            user_id: userId
          }
        });
        created++;
      }
    }

    // Update sync token and last sync time
    await prisma.user.update({
      where: { id: userId },
      data: {
        google_calendar_sync_token: result.nextSyncToken || null,
        google_calendar_last_sync: new Date()
      }
    });

    res.json({
      success: true,
      stats: {
        created,
        updated,
        deleted
      }
    });
  } catch (error: any) {
    console.error('Error syncing calendar:', error);

    if (error.message === 'Token expired or invalid') {
      return res.status(401).json({
        error: 'Token expired. Please re-authenticate.',
        needsAuth: true
      });
    }

    res.status(500).json({ error: 'Failed to sync calendar' });
  }
});

export default router;
