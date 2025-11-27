import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const API_BASE_URL = 'https://schedu-ai-zocp.onrender.com/api/google-calendar';

export function useGoogleCalendar() {
  const { user } = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check authentication status
  const checkAuthStatus = useCallback(async () => {
    try {
      if (!user?.id) {
        setIsAuthenticated(false);
        return false;
      }

      const response = await fetch(`${API_BASE_URL}/auth/status?userId=${user.id}`);
      const data = await response.json();
      setIsAuthenticated(data.authenticated);
      return data.authenticated;
    } catch (err) {
      console.error('Error checking auth status:', err);
      setIsAuthenticated(false);
      return false;
    }
  }, [user]);

  // Start Google OAuth flow
  const connectGoogleCalendar = useCallback(async () => {
    try {
      if (!user?.id) {
        throw new Error('Please log in to connect Google Calendar');
      }

      setIsLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE_URL}/auth/url?userId=${user.id}`);
      
      if (!response.ok) {
        throw new Error('Failed to get authentication URL');
      }
      
      const data = await response.json();
      
      if (!data.authUrl) {
        throw new Error('No authentication URL received');
      }

      // Redirect to Google OAuth
      window.location.href = data.authUrl;
    } catch (err) {
      console.error('Error connecting to Google Calendar:', err);
      setError(err.message || 'Failed to connect to Google Calendar');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Fetch Google Calendar events
  const fetchGoogleCalendarEvents = useCallback(async (timeMin, timeMax) => {
    try {
      if (!user?.id) {
        throw new Error('Please log in to fetch Google Calendar events');
      }

      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append('userId', user.id.toString());
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
  }, [user]);

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
