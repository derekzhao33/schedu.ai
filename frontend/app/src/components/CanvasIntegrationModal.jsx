import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { AlertCircle, CheckCircle } from 'lucide-react';

export function CanvasIntegrationModal({ isOpen, onClose, onSuccess }) {
  const [icsUrl, setIcsUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userId = localStorage.getItem('userId') || 1;
      const response = await fetch(`https://schedu-ai-zocp.onrender.com/api/canvas/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: parseInt(userId),
          icsUrl: icsUrl.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect Canvas');
      }

      setSuccess(true);
      localStorage.setItem('canvas_ics_url', icsUrl.trim());
      localStorage.setItem('canvas_connected', 'true');
      
      setTimeout(() => {
        onSuccess?.(data.addedEvents);
        onClose();
        setSuccess(false);
        setIcsUrl('');
      }, 1500);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIcsUrl('');
    setError('');
    setSuccess(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Connect Canvas Integration</DialogTitle>
          <DialogDescription>
            Sync your Canvas assignments and deadlines automatically
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <CheckCircle className="w-16 h-16 text-green-500" />
            <p className="text-lg font-medium">Canvas Connected Successfully!</p>
            <p className="text-sm text-gray-600">Your Canvas events are now syncing...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-blue-900">How to get your Canvas .ics URL:</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
                <li>Log in to your Canvas account</li>
                <li>Click on "Calendar" in the left sidebar</li>
                <li>Click the "Calendar Feed" button (usually in the bottom right)</li>
                <li>Copy the .ics URL that appears</li>
                <li>Paste it in the field below</li>
              </ol>
              <p className="text-xs text-blue-700 mt-2">
                💡 Tip: The URL should end with ".ics" and look something like: 
                <code className="block mt-1 p-1 bg-white rounded">
                  https://canvas.example.edu/feeds/calendars/user_xyz.ics
                </code>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="icsUrl">Canvas .ics URL</Label>
              <Input
                id="icsUrl"
                type="url"
                placeholder="https://canvas.example.edu/feeds/calendars/user_xyz.ics"
                value={icsUrl}
                onChange={(e) => setIcsUrl(e.target.value)}
                required
                className="w-full"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || !icsUrl.trim()}
                className="bg-red-600 hover:bg-red-700"
              >
                {loading ? 'Connecting...' : 'Connect Canvas'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
