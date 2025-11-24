import { useState, useCallback } from 'react';

const API_BASE_URL = 'http://localhost:3001/api/google-calendar';

export function useGoogleCalendar() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check authentication status
  const checkAuthStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/status`);
      const data = await response.json();
      setIsAuthenticated(data.authenticated);
      return data.authenticated;
    } catch (err) {
      console.error('Error checking auth status:', err);
      setIsAuthenticated(false);
      return false;
    }
  }, []);

  // Start Google OAuth flow
  const connectGoogleCalendar = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/auth/url`);
      const data = await response.json();

      // Open Google OAuth in a popup or redirect
      window.location.href = data.authUrl;
    } catch (err) {
      console.error('Error connecting to Google Calendar:', err);
      setError('Failed to connect to Google Calendar');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch Google Calendar events
  const fetchGoogleCalendarEvents = useCallback(async (timeMin, timeMax) => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (timeMin) params.append('timeMin', timeMin.toISOString());
      if (timeMax) params.append('timeMax', timeMax.toISOString());

      const response = await fetch(`${API_BASE_URL}/events?${params}`);
      const data = await response.json();

      if (!response.ok) {
        if (data.needsAuth) {
          setIsAuthenticated(false);
          throw new Error('Please connect your Google Calendar');
        }
        throw new Error(data.error || 'Failed to fetch events');
      }

      setIsAuthenticated(true);
      return data.events;
    } catch (err) {
      console.error('Error fetching Google Calendar events:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Disconnect Google Calendar
  const disconnectGoogleCalendar = useCallback(async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/disconnect`, {
        method: 'POST',
      });
      setIsAuthenticated(false);
    } catch (err) {
      console.error('Error disconnecting Google Calendar:', err);
      setError('Failed to disconnect');
    }
  }, []);

  return {
    isAuthenticated,
    isLoading,
    error,
    checkAuthStatus,
    connectGoogleCalendar,
    fetchGoogleCalendarEvents,
    disconnectGoogleCalendar,
  };
}
