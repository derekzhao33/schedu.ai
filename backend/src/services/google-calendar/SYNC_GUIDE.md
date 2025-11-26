# Google Calendar Two-Way Sync

This service provides two-way synchronization between your app's tasks and Google Calendar.

## Features

### App → Google Calendar (Automatic)
- **Create**: When you create a task, it automatically creates an event in Google Calendar
- **Update**: When you update a task, it updates the corresponding Google Calendar event
- **Delete**: When you delete a task, it removes the event from Google Calendar

### Google Calendar → App (Manual Sync)
- **Pull Changes**: Call the sync endpoint to pull changes from Google Calendar
- **Incremental Sync**: Uses sync tokens for efficient incremental updates
- **Smart Sync**: Only fetches changes since last sync

## API Endpoints

### 1. Sync Google Calendar to App
```
POST /api/google-calendar/sync
```

**Request Body:**
```json
{
  "userId": 1
}
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "created": 5,
    "updated": 3,
    "deleted": 1
  }
}
```

This endpoint:
- Fetches all changes from Google Calendar since last sync
- Creates new tasks for new Google Calendar events
- Updates existing tasks if Google Calendar events changed
- Deletes tasks if Google Calendar events were deleted
- Stores a sync token for next incremental sync

### 2. Get Events (Read-Only)
```
GET /api/google-calendar/events?userId=1&timeMin=2024-01-01&timeMax=2024-12-31
```

**Response:**
```json
{
  "events": [...],
  "nextSyncToken": "abc123..."
}
```

## How to Use

### Initial Setup
1. Authenticate with Google Calendar using `/auth/url` endpoint
2. Complete OAuth flow via `/auth/callback`

### Ongoing Sync
1. **Automatic**: Tasks created/updated/deleted in your app automatically sync to Google Calendar
2. **Manual**: Call `/sync` endpoint periodically (e.g., every 5 minutes) to pull Google Calendar changes

### Recommended Sync Strategy
```javascript
// Frontend: Set up periodic sync
setInterval(async () => {
  await fetch('/api/google-calendar/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 1 })
  });
}, 5 * 60 * 1000); // Sync every 5 minutes
```

## Database Schema

### User Table
- `google_access_token`: Google OAuth access token
- `google_refresh_token`: Google OAuth refresh token
- `google_token_expiry`: When the access token expires
- `google_calendar_sync_token`: Token for incremental sync
- `google_calendar_last_sync`: Timestamp of last successful sync

### Task Table
- `google_event_id`: Links task to Google Calendar event

## Sync Loop Prevention

The system prevents infinite sync loops:
- When syncing FROM Google Calendar, it uses `skipGoogleSync: true` flag
- This prevents the task update from syncing back to Google Calendar
- Only user-initiated changes in the app sync to Google Calendar

## Error Handling

- **Token Expired**: Automatically refreshes using refresh token
- **Auth Required**: Returns `needsAuth: true` if user needs to re-authenticate
- **Sync Failures**: Logged but don't fail the entire sync operation
