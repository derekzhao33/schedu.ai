import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

export function useCanvasSync() {
  const { user } = useAuth();
  const syncIntervalRef = useRef(null);
  const isInitialized = useRef(false);

  const syncCanvas = useCallback(async () => {
    const canvasConnected = localStorage.getItem('canvas_connected') === 'true';

    if (!canvasConnected || !user?.id) {
      return;
    }

    try {
      console.log('Syncing Canvas events...');
      const response = await fetch(`https://schedu-ai-zocp.onrender.com/api/canvas/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id })
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`Canvas sync complete: ${data.eventsAdded} events added`);
      } else {
        console.error('Canvas sync failed');
      }
    } catch (error) {
      console.error('Error syncing Canvas:', error);
    }
  }, [user]);

  useEffect(() => {
    const canvasConnected = localStorage.getItem('canvas_connected') === 'true';

    if (canvasConnected && !isInitialized.current) {
      // Initial sync on mount
      syncCanvas();
      isInitialized.current = true;

      // Set up interval for syncing every 5 minutes
      syncIntervalRef.current = setInterval(() => {
        syncCanvas();
      }, 5 * 60 * 1000); // 5 minutes
    }

    // Cleanup on unmount
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [syncCanvas]);

  return { syncCanvas };
}
