import { useEffect, useRef, useCallback } from 'react';

export function useCanvasSync() {
  const syncIntervalRef = useRef(null);
  const isInitialized = useRef(false);

  const syncCanvas = useCallback(async () => {
    const canvasConnected = localStorage.getItem('canvas_connected') === 'true';
    const userId = localStorage.getItem('userId') || 1;

    if (!canvasConnected) {
      return;
    }

    try {
      console.log('Syncing Canvas events...');
      const response = await fetch(`https://schedu-ai-zocp.onrender.com/api/canvas/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: parseInt(userId) })
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
  }, []);

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
