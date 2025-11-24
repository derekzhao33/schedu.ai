# Google Calendar Integration Guide

## ✅ Setup Complete!

Your schedu.ai app is now integrated with Google Calendar! Here's how to use it:

## 🚀 How to Use

### 1. Configure Database (Optional)

The Google Calendar integration stores tokens in memory by default. If you want to use the database features, update the `DATABASE_URL` in `backend/.env` with your PostgreSQL connection string. Otherwise, the integration will work fine without it!

### 2. Start the Backend Server

```bash
cd backend
npm run dev
```

The backend will run on `http://localhost:3001`

**Note:** If you get a Prisma error, you may need to update your database URL in `backend/.env` or simply ignore it if you're only using the Google Calendar feature.

### 3. Start the Frontend App

```bash
cd frontend/app
npm run dev
```

The frontend will run on `http://localhost:3000`

### 3. Connect Your Google Calendar

1. Open the calendar page in your app
2. Click the **"Connect Google Calendar"** button (red button in the header)
3. You'll be redirected to Google's login page
4. Sign in with your Google account
5. Grant permission to access your calendar
6. You'll be redirected back to your app automatically

### 4. Sync Your Events

Once connected:
- Click the **"Sync Google Calendar"** button to fetch your events
- Google Calendar events will appear with a red border and a 📅 icon
- Your local events will appear with a purple/pink border

## 🎨 Visual Indicators

- **Google Calendar Events**: Red border, light red background, 📅 icon
- **Local Events**: Purple/pink border, white background
- **Tasks**: Colorful pastel backgrounds (as before)

## 🔄 How It Works

1. **Authentication**: Uses OAuth 2.0 to securely connect to your Google account
2. **Read-Only Access**: The app can only READ your calendar events (cannot create, modify, or delete)
3. **Manual Sync**: Click "Sync Google Calendar" whenever you want to update events from Google
4. **Event Merging**: Google Calendar events are displayed alongside your local events

## 📝 Technical Details

### Backend (Port 3001)
- **GET** `/api/google-calendar/auth/url` - Get OAuth URL
- **GET** `/api/google-calendar/auth/callback` - OAuth callback handler
- **GET** `/api/google-calendar/events` - Fetch calendar events
- **GET** `/api/google-calendar/auth/status` - Check auth status
- **POST** `/api/google-calendar/auth/disconnect` - Disconnect calendar

### Configuration

The `.env` file in the backend contains your Google OAuth credentials:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

## 🔒 Security Notes

- Tokens are currently stored in memory (not persistent)
- When you restart the backend, you'll need to reconnect
- **For production**: Store tokens in a database with user authentication

## 🛠️ Troubleshooting

### "Failed to connect to Google Calendar"
- Make sure the backend server is running on port 3001
- Check that your Google Cloud credentials are correct in `.env`
- Verify the redirect URI in Google Cloud Console matches: `http://localhost:3000/auth/google/callback`

### Events not appearing
- Click the "Sync Google Calendar" button to fetch latest events
- Check the browser console for any error messages
- Make sure you've granted calendar access permissions

### "Token expired or invalid"
- Click "Sync Google Calendar" again - it will auto-refresh the token
- If that doesn't work, reconnect your Google Calendar

## 📅 Next Steps (Optional Enhancements)

1. **Persistent Storage**: Save tokens to database instead of memory
2. **Auto-Sync**: Automatically sync events every few minutes
3. **Two-Way Sync**: Allow creating events in Google Calendar from your app
4. **Multiple Calendars**: Support syncing from multiple Google calendars
5. **Event Details**: Show full event details (location, attendees, etc.)

## 🎉 Enjoy Your Integrated Calendar!

Your Google Calendar events will now appear seamlessly in your schedu.ai calendar view!
