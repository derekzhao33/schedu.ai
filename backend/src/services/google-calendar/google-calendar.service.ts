import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import dotenv from 'dotenv';

dotenv.config();

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

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

  // Fetch calendar events
  async getEvents(
    accessToken: string,
    refreshToken?: string,
    timeMin?: Date,
    timeMax?: Date
  ) {
    try {
      // Set credentials
      const oauth2Client = this.getOAuth2Client();
      oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: timeMin ? timeMin.toISOString() : new Date().toISOString(),
        timeMax: timeMax ? timeMax.toISOString() : undefined,
        maxResults: 100,
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items || [];

      // Transform Google Calendar events to our format
      return events.map((event) => {
        const start = event.start?.dateTime || event.start?.date;
        const end = event.end?.dateTime || event.end?.date;

        const startDate = start ? new Date(start) : new Date();
        const endDate = end ? new Date(end) : new Date();

        return {
          id: event.id,
          name: event.summary || 'Untitled Event',
          description: event.description || '',
          date: startDate.toISOString().split('T')[0],
          startTime: event.start?.dateTime
            ? `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`
            : undefined,
          endTime: event.end?.dateTime
            ? `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`
            : undefined,
          location: event.location,
          source: 'google-calendar',
          googleEventId: event.id,
        };
      });
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
}

export const googleCalendarService = new GoogleCalendarService();
