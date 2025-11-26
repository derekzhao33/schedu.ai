import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Separator } from '../components/ui/separator';
import { useThemeSettings } from '../context/ThemeContext';
import Sidebar, { useSidebar } from '../components/Sidebar';
import { useGoogleCalendar } from '../hooks/useGoogleCalendar';
import { CanvasIntegrationModal } from '../components/CanvasIntegrationModal';
import { Mail, Calendar, CheckCircle, AlertCircle, BookOpen } from 'lucide-react';

const Integrations = () => {
  const { theme } = useThemeSettings();
  const { isCollapsed } = useSidebar();
  const { isAuthenticated, isLoading, error, checkAuthStatus, connectGoogleCalendar, disconnectGoogleCalendar } = useGoogleCalendar();
  const [googleAuthStatus, setGoogleAuthStatus] = useState(null);
  const [canvasModalOpen, setCanvasModalOpen] = useState(false);
  const [canvasConnected, setCanvasConnected] = useState(false);
  const [canvasLoading, setCanvasLoading] = useState(false);

  useEffect(() => {
    checkAuthStatus().then(setGoogleAuthStatus);
    // Check if Canvas is connected
    const connected = localStorage.getItem('canvas_connected') === 'true';
    setCanvasConnected(connected);
  }, [checkAuthStatus]);

  // Check for OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_auth') === 'success') {
      setGoogleAuthStatus(true);
      checkAuthStatus();
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get('google_auth') === 'error') {
      setGoogleAuthStatus(false);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [checkAuthStatus]);

  const handleCanvasSuccess = () => {
    setCanvasConnected(true);
  };

  const handleCanvasDisconnect = async () => {
    setCanvasLoading(true);
    try {
      const userId = localStorage.getItem('userId') || 1;
      const response = await fetch(`https://schedu-ai-zocp.onrender.com/api/canvas/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: parseInt(userId) })
      });

      if (response.ok) {
        localStorage.removeItem('canvas_ics_url');
        localStorage.removeItem('canvas_connected');
        setCanvasConnected(false);
      }
    } catch (error) {
      console.error('Error disconnecting Canvas:', error);
    } finally {
      setCanvasLoading(false);
    }
  };

  return (
    <div className={`flex min-h-screen ${theme === 'dark' ? 'dark' : ''}`} style={{ backgroundColor: '#F7F8FC' }}>
      <Sidebar />

      {/* Main content */}
      <main className={`flex-1 p-8 space-y-8 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-[#355C7D] to-[#725A7A] bg-clip-text text-transparent">
            Integrations
          </h1>
          <p className="text-muted-foreground mt-2">Connect your favorite apps and services to Flowify</p>
        </div>

        {/* Google Calendar Integration */}
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="h-6 w-6 text-blue-500" />
                <div>
                  <CardTitle className="text-2xl">Google Calendar</CardTitle>
                  <CardDescription>Sync your Google Calendar events with Flowify</CardDescription>
                </div>
              </div>
              {googleAuthStatus && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="text-sm font-medium">Connected</span>
                </div>
              )}
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-4">
              Connect your Google Calendar to automatically sync your events and stay organized. You'll have access to your calendar events within Flowify.
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-md bg-red-100 text-red-700 text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <div className="flex gap-3">
              {!googleAuthStatus ? (
                <Button
                  onClick={connectGoogleCalendar}
                  disabled={isLoading}
                  className="bg-gradient-to-r from-[#FF7582] to-[#C56C86] hover:opacity-90 text-white font-medium cursor-pointer"
                >
                  {isLoading ? 'Connecting...' : 'Connect Google Calendar'}
                </Button>
              ) : (
                <Button
                  onClick={disconnectGoogleCalendar}
                  disabled={isLoading}
                  variant="outline"
                  className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50"
                >
                  {isLoading ? 'Disconnecting...' : 'Disconnect'}
                </Button>
              )}
              
              {/* Canvas Integration Button */}
              {!canvasConnected ? (
                <Button
                  onClick={() => setCanvasModalOpen(true)}
                  disabled={canvasLoading}
                  className="bg-red-600 hover:bg-red-700 text-white font-medium"
                >
                  Add Canvas
                </Button>
              ) : (
                <Button
                  onClick={handleCanvasDisconnect}
                  disabled={canvasLoading}
                  variant="outline"
                  className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50"
                >
                  {canvasLoading ? 'Disconnecting...' : 'Remove Canvas'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Canvas Integration */}
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BookOpen className="h-6 w-6 text-red-500" />
                <div>
                  <CardTitle className="text-2xl">Canvas LMS</CardTitle>
                  <CardDescription>Sync your Canvas assignments and deadlines</CardDescription>
                </div>
              </div>
              {canvasConnected && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="text-sm font-medium">Connected</span>
                </div>
              )}
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-4">
              Connect your Canvas LMS to automatically sync assignments, quizzes, and important deadlines. 
              Canvas events will appear in red on your calendar and sync every 5 minutes.
            </p>
          </CardContent>
        </Card>

        {/* Gmail Integration Placeholder */}
        <Card className="shadow-lg opacity-50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Mail className="h-6 w-6 text-gray-400" />
              <div>
                <CardTitle className="text-2xl">Gmail</CardTitle>
                <CardDescription>Coming soon - Email integration</CardDescription>
              </div>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-4">
              Gmail integration is coming soon. You'll be able to manage your emails directly from Flowify.
            </p>
            <Button disabled className="text-gray-500">
              Coming Soon
            </Button>
          </CardContent>
        </Card>

        {/* Canvas Integration Modal */}
        <CanvasIntegrationModal
          isOpen={canvasModalOpen}
          onClose={() => setCanvasModalOpen(false)}
          onSuccess={handleCanvasSuccess}
        />
      </main>
    </div>
  );
};

export default Integrations;
