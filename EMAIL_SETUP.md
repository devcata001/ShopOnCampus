# Email Service Setup Guide

## Overview

ShopOnCampus supports two email delivery methods:

1. **SMTP** - For development (localhost)
2. **OAuth2** - For production on Render (SMTP ports blocked)

---

## ✅ Method 1: Gmail SMTP (Recommended for Development)

### Setup Steps:

#### Step 1: Enable 2-Factor Authentication

1. Go to [Google Account Settings](https://myaccount.google.com/security)
2. Enable "2-Step Verification"

#### Step 2: Generate App Password

1. Go to [App Passwords](https://myaccount.google.com/apppasswords)
2. Select "Mail" and "Windows Computer" (or your device)
3. Google will generate a 16-character password
4. Copy the password (format: `xxxx xxxx xxxx xxxx`)

#### Step 3: Update .env

```env
EMAIL_USER=your-email@gmail.com
EMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
```

#### Step 4: Test

```bash
npm start
# Should see: "[SUCCESS] Email service is ready and operational (SMTP)"
```

---

## 🚀 Method 2: Gmail OAuth2 (For Render Deployment)

### Why OAuth2?

- Render blocks SMTP (ports 587/465) on free tier
- OAuth2 uses standard HTTP ports (no blocking)
- More secure than app passwords

### Setup Steps:

#### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project: "ShopOnCampus"
3. Enable Gmail API:
   - Search "Gmail API"
   - Click "Enable"

#### Step 2: Create OAuth2 Credentials

1. Go to "Credentials" in left sidebar
2. Click "Create Credentials" → "OAuth 2.0 Client ID"
3. Choose "Desktop application"
4. Download the JSON file
5. Save credentials:
   - `GOOGLE_CLIENT_ID` = client_id from JSON
   - `GOOGLE_CLIENT_SECRET` = client_secret from JSON

#### Step 3: Generate Refresh Token

Use this Node.js script:

```javascript
const { google } = require("googleapis");
const readline = require("readline");

const oauth2Client = new google.auth.OAuth2(
  "YOUR_CLIENT_ID",
  "YOUR_CLIENT_SECRET",
  "http://localhost:3000", // Redirect URI
);

const scopes = ["https://www.googleapis.com/auth/gmail.send"];
const url = oauth2Client.generateAuthUrl({
  access_type: "offline",
  scope: scopes,
});

console.log("Visit this URL:", url);
// After authorizing, you'll get a code, then:
// oauth2Client.getToken(code, (err, token) => { console.log(token); });
```

#### Step 4: Update .env on Render

In Render dashboard → Environment:

```env
EMAIL_USER=your-email@gmail.com
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REFRESH_TOKEN=your_refresh_token
GOOGLE_ACCESS_TOKEN=your_access_token (optional, auto-generated)
```

#### Step 5: Test

```bash
# Backend logs should show:
# "[SUCCESS] Email service ready via OAuth2 (Render compatible)"
```

---

## 🔄 Automatic Fallback

The code automatically:

1. ✅ Tries SMTP first (for localhost)
2. 🔄 Falls back to OAuth2 if SMTP fails (for Render)
3. 📊 Logs which method is being used

---

## 🐛 Troubleshooting

### "SMTP service verification failed"

- **On Render**: This is normal! OAuth2 fallback activates automatically
- **On Localhost**: Check EMAIL_USER and EMAIL_APP_PASSWORD

### "OAuth2 Email service also failed"

- Check Google credentials in .env
- Verify refresh token is still valid
- Regenerate if necessary

### "Running on Render but OAuth2 credentials missing"

- Add Google OAuth2 variables to Render Environment
- Restart the service

---

## ✨ Features Working with Both Methods

- ✅ Email verification on signup
- ✅ Resend verification email
- ✅ Forgot password reset
- ✅ Password reset email
- ✅ All emails include links that expire in 24h

---

## 📝 Summary Table

| Feature         | SMTP (Dev)           | OAuth2 (Render) |
| --------------- | -------------------- | --------------- |
| Setup Time      | 5 min                | 20-30 min       |
| Cost            | Free                 | Free            |
| Security        | Good                 | Excellent       |
| Works on Render | ❌ No (port blocked) | ✅ Yes          |
| Works Locally   | ✅ Yes               | ✅ Yes          |
| Auto-Fallback   | N/A                  | ✅ Yes          |

---

## 🎯 Recommended Setup

1. **Development**: Use SMTP (App Passwords)
2. **Production (Render)**: Use OAuth2
3. Both can coexist - code auto-detects which to use
