# OAuth Setup Steps

## Create New OAuth 2.0 Client ID

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select project: **it-workload**
3. Go to **APIs & Services > Credentials**
4. Click **+ CREATE CREDENTIALS > OAuth client ID**
5. Choose **Web application**
6. Name it: **IT Workload Tracker - Local Dev**

## Configure Origins and Redirects

### Authorized JavaScript origins:
```
http://localhost:5173
http://127.0.0.1:5173
https://zakpestsos.github.io
```

### Authorized redirect URIs:
```
http://localhost:5173
http://127.0.0.1:5173
https://zakpestsos.github.io/it-workload-tracker/
```

## Update .env file

After creating the new client, update your `.env` file with the new Client ID:

```env
VITE_GOOGLE_CLIENT_ID=YOUR_NEW_CLIENT_ID_HERE.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=AIzaSyARpNQLLER7nub09yNmcn4ROZMYG2ZEo48
```

## Test Steps

1. Save the OAuth client settings
2. Update the .env file
3. Restart your dev server: `npm run dev`
4. Try the Google Sheets integration again

## Common Issues

- **400 Error**: OAuth client not configured for localhost
- **CORS Error**: Missing JavaScript origins
- **Redirect URI mismatch**: Missing redirect URIs
- **Invalid client**: Wrong Client ID in .env file