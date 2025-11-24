import { Router } from 'express';
import { googleCalendarService } from './google-calendar.service.js';

const router = Router();

// Store tokens temporarily (in production, store in database)
const userTokens = new Map<string, any>();

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
  const { code } = req.query;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Authorization code is required' });
  }

  try {
    const tokens = await googleCalendarService.getTokens(code);

    // Generate a simple user ID (in production, use actual user authentication)
    const userId = 'default-user';
    userTokens.set(userId, tokens);

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
    const userId = 'default-user';
    const tokens = userTokens.get(userId);

    if (!tokens) {
      return res.status(401).json({
        error: 'Not authenticated with Google Calendar',
        needsAuth: true
      });
    }

    // Parse date range from query params
    const { timeMin, timeMax } = req.query;
    const minDate = timeMin ? new Date(timeMin as string) : new Date();
    const maxDate = timeMax ? new Date(timeMax as string) : undefined;

    const events = await googleCalendarService.getEvents(
      tokens.access_token,
      tokens.refresh_token,
      minDate,
      maxDate
    );

    res.json({ events });
  } catch (error: any) {
    console.error('Error fetching events:', error);

    if (error.message === 'Token expired or invalid') {
      // Try to refresh token
      try {
        const userId = 'default-user';
        const tokens = userTokens.get(userId);

        if (tokens?.refresh_token) {
          const newTokens = await googleCalendarService.refreshAccessToken(tokens.refresh_token);
          userTokens.set(userId, { ...tokens, ...newTokens });

          // Retry fetching events
          const { timeMin, timeMax } = req.query;
          const minDate = timeMin ? new Date(timeMin as string) : new Date();
          const maxDate = timeMax ? new Date(timeMax as string) : undefined;

          const events = await googleCalendarService.getEvents(
            newTokens.access_token!,
            tokens.refresh_token,
            minDate,
            maxDate
          );

          return res.json({ events });
        }
      } catch (refreshError) {
        console.error('Error refreshing token:', refreshError);
      }

      return res.status(401).json({
        error: 'Token expired. Please re-authenticate.',
        needsAuth: true
      });
    }

    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

// Check authentication status
router.get('/auth/status', (req, res) => {
  const userId = 'default-user';
  const tokens = userTokens.get(userId);

  res.json({
    authenticated: !!tokens,
    hasRefreshToken: !!(tokens?.refresh_token)
  });
});

// Logout / disconnect
router.post('/auth/disconnect', (req, res) => {
  const userId = 'default-user';
  userTokens.delete(userId);
  res.json({ success: true });
});

export default router;
