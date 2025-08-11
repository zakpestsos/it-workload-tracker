# Google Sheets Integration Setup

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your Project ID

## Step 2: Enable APIs

1. Go to [API Library](https://console.cloud.google.com/apis/library)
2. Enable these APIs:
   - **Google Sheets API**
   - **Google Drive API**

## Step 3: Create Credentials

### API Key (for public data access)
1. Go to [Credentials](https://console.cloud.google.com/apis/credentials)
2. Click "Create Credentials" → "API key"
3. Copy the API key
4. (Optional) Restrict the key to your domain for security

### OAuth 2.0 Client ID (for user authentication)
1. Go to [Credentials](https://console.cloud.google.com/apis/credentials)
2. Click "Create Credentials" → "OAuth client ID"
3. Choose "Web application"
4. Add these Authorized JavaScript origins:
   - `http://localhost:5173` (for development)
   - `https://zakpestsos.github.io` (for production)
5. Copy the Client ID

## Step 4: Configure OAuth Consent Screen

1. Go to [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)
2. Choose "External" user type
3. Fill in required fields:
   - App name: "IT Workload Tracker"
   - User support email: Your email
   - Developer contact: Your email
4. Add scopes:
   - `https://www.googleapis.com/auth/spreadsheets`
   - `https://www.googleapis.com/auth/drive.file`
5. Add your email as a test user

## Step 5: Environment Configuration

Create a `.env` file in the project root:

```env
VITE_GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=your_api_key_here
```

## Features Included

✅ **Auto-create Google Sheets** with proper structure
✅ **Real-time sync** between app and sheets  
✅ **Share by URL** with automatic access
✅ **Multi-user collaboration**
✅ **Offline support** with sync when back online
✅ **Version history** through Google Sheets
✅ **Role-based access** (view/edit permissions)

## How It Works

1. **Connect**: Click "Connect to Google Sheets" 
2. **Authenticate**: Sign in with your Google account
3. **Auto-setup**: Creates structured sheets automatically
4. **Real-time sync**: Data syncs every 30 seconds
5. **Share**: Get shareable links for the app or Google Sheets
6. **Collaborate**: Add team members with different permission levels

## Sharing Options

- **App Link**: `https://zakpestsos.github.io/it-workload-tracker/?sheet=SPREADSHEET_ID`
- **Google Sheets**: Direct link to the spreadsheet
- **Email sharing**: Invite specific people with view/edit access

## Data Structure

The integration creates 5 sheets:
1. **Profiles** - User profile workload items
2. **Contracts** - Contract workload items  
3. **Main Projects** - Project workload items
4. **Tickets Summary** - Freshdesk ticket metrics
5. **App Metadata** - Configuration and sync info

## Security

- OAuth 2.0 authentication ensures secure access
- Users only access their own sheets
- Granular permissions (read/write/comment)
- Data stays in your Google account
