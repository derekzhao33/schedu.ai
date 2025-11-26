import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import dotenv from 'dotenv';

dotenv.config();

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events'
];

export class GoogleCalendarService {
  private oauth2Client: OAuth2Client | null = null;

  private getOAuth2Client(): OAuth2Client {
    if (!this.oauth2Client) {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const redirectUri = process.env.GOOGLE_REDIRECT_URI;

      if (!clientId || !clientSecret || !redirectUri) {
        throw new Error(
          `Missing Google OAuth credentials. Make sure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI are set in .env file.\n` +
          `GOOGLE_CLIENT_ID: ${clientId ? 'present' : 'MISSING'}\n` +
          `GOOGLE_CLIENT_SECRET: ${clientSecret ? 'present' : 'MISSING'}\n` +
          `GOOGLE_REDIRECT_URI: ${redirectUri ? 'present' : 'MISSING'}`
        );
      }

      this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    }
    return this.oauth2Client;
  }

  // Generate authentication URL
  getAuthUrl(): string {
    console.log('Generating auth URL with client_id:', process.env.GOOGLE_CLIENT_ID);
    const oauth2Client = this.getOAuth2Client();
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
    });
  }

  // Exchange authorization code for tokens
  async getTokens(code: string) {
    try {
      const oauth2Client = this.getOAuth2Client();
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);
      return tokens;
    } catch (error) {
      console.error('Error getting tokens:', error);
      throw new Error('Failed to get tokens');
    }
  }

  // Set credentials for an authenticated user
  setCredentials(tokens: any) {
    const oauth2Client = this.getOAuth2Client();
    oauth2Client.setCredentials(tokens);
  }

  // Fetch calendar events with optional sync token for incremental sync
  async getEvents(
    accessToken: string,
    refreshToken?: string,
    timeMin?: Date,
    timeMax?: Date,
    syncToken?: string
  ) {
    try {
      // Set credentials
      const oauth2Client = this.getOAuth2Client();
      oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      // Use sync token for incremental sync if available, otherwise use time range
      const requestParams: any = {
        calendarId: 'primary',
        maxResults: 100,
        singleEvents: true,
      };

      if (syncToken) {
        // Incremental sync using sync token
        requestParams.syncToken = syncToken;
      } else {
        // Full sync with time range
        requestParams.timeMin = timeMin ? timeMin.toISOString() : new Date().toISOString();
        requestParams.timeMax = timeMax ? timeMax.toISOString() : undefined;
        requestParams.orderBy = 'startTime';
      }

      const response = await calendar.events.list(requestParams);

      const events = response.data.items || [];
      const newSyncToken = response.data.nextSyncToken;

      // Transform Google Calendar events to our format
      const transformedEvents = events.map((event) => {
        const start = event.start?.dateTime || event.start?.date;
        const end = event.end?.dateTime || event.end?.date;

        // Handle all-day events (date-only format) vs timed events (dateTime format)
        let date: string;
        let startTime: string | undefined;
        let endTime: string | undefined;

        if (event.start?.dateTime) {
          // Timed event - use dateTime
          const startDate = new Date(event.start.dateTime);
          const endDate = new Date(event.end?.dateTime || event.start.dateTime);

          date = startDate.toISOString().split('T')[0]!;
          startTime = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;
          endTime = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
        } else {
          // All-day event - use date string directly without timezone conversion
          date = (event.start?.date || new Date().toISOString().split('T')[0])!;
          startTime = undefined;
          endTime = undefined;
        }

        return {
          id: event.id,
          name: event.summary || 'Untitled Event',
          description: event.description || '',
          date,
          startTime,
          endTime,
          location: event.location,
          source: 'google-calendar',
          googleEventId: event.id,
          status: event.status, // 'confirmed', 'cancelled', etc.
          updated: event.updated,
        };
      });

      return {
        events: transformedEvents,
        nextSyncToken: newSyncToken
      };
    } catch (error: any) {
      console.error('Error fetching calendar events:', error);

      // Handle token expiration
      if (error.code === 401) {
        throw new Error('Token expired or invalid');
      }

      throw new Error('Failed to fetch calendar events');
    }
  }

  // Refresh access token
  async refreshAccessToken(refreshToken: string) {
    try {
      const oauth2Client = this.getOAuth2Client();
      oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });

      const { credentials } = await oauth2Client.refreshAccessToken();
      return credentials;
    } catch (error) {
      console.error('Error refreshing token:', error);
      throw new Error('Failed to refresh token');
    }
  }

  // Create a new event in Google Calendar
  async createEvent(
    accessToken: string,
    refreshToken: string | undefined,
    eventData: {
      name: string;
      description?: string;
      startTime: Date;
      endTime: Date;
      recurrence?: string[];
    }
  ) {
    try {
      const oauth2Client = this.getOAuth2Client();
      oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      const event: any = {
        summary: eventData.name,
        description: eventData.description || '',
        start: {
          dateTime: eventData.startTime.toISOString(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: eventData.endTime.toISOString(),
          timeZone: 'UTC',
        },
      };

      // Add recurrence rules if provided
      if (eventData.recurrence && eventData.recurrence.length > 0) {
        event.recurrence = eventData.recurrence;
      }

      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
      });

      return response.data;
    } catch (error: any) {
      console.error('Error creating calendar event:', error);
      if (error.code === 401) {
        throw new Error('Token expired or invalid');
      }
      throw new Error('Failed to create calendar event');
    }
  }

  // Update an existing event in Google Calendar
  async updateEvent(
    accessToken: string,
    refreshToken: string | undefined,
    eventId: string,
    eventData: {
      name: string;
      description?: string;
      startTime: Date;
      endTime: Date;
    }
  ) {
    try {
      const oauth2Client = this.getOAuth2Client();
      oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      const event = {
        summary: eventData.name,
        description: eventData.description || '',
        start: {
          dateTime: eventData.startTime.toISOString(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: eventData.endTime.toISOString(),
          timeZone: 'UTC',
        },
      };

      const response = await calendar.events.update({
        calendarId: 'primary',
        eventId: eventId,
        requestBody: event,
      });

      return response.data;
    } catch (error: any) {
      console.error('Error updating calendar event:', error);
      if (error.code === 401) {
        throw new Error('Token expired or invalid');
      }
      throw new Error('Failed to update calendar event');
    }
  }

  // Delete an event from Google Calendar
  async deleteEvent(
    accessToken: string,
    refreshToken: string | undefined,
    eventId: string
  ) {
    try {
      const oauth2Client = this.getOAuth2Client();
      oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      await calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
      });

      return { success: true };
    } catch (error: any) {
      console.error('Error deleting calendar event:', error);
      if (error.code === 401) {
        throw new Error('Token expired or invalid');
      }
      throw new Error('Failed to delete calendar event');
    }
  }
}

export const googleCalendarService = new GoogleCalendarService();
