# EIH AI Assistant - Troubleshooting Guide

## 🔧 Common Issues & Solutions

### 1. DeepSeek API Issues

#### Error: "API_KEY not set"
**Problem**: Missing or invalid DeepSeek API key

**Solution**:
1. Check `.env.local` file exists
2. Verify `NEXT_PUBLIC_DEEPSEEK_API_KEY=sk_xxx` is set
3. Get API key from https://platform.deepseek.com/
4. Restart dev server (`pnpm dev`)
5. Clear browser cache (Ctrl+Shift+Delete)

#### Error: "DeepSeek API error: 401"
**Problem**: Invalid API key format or expired

**Solution**:
1. Go to https://platform.deepseek.com/
2. Check API key is still valid
3. Generate new key if needed
4. Update `.env.local`
5. Clear browser cache
6. Restart server

#### Error: "Rate limit exceeded"
**Problem**: Too many API calls in short time

**Solution**:
1. Wait a few minutes before trying again
2. Check free tier limits on DeepSeek website
3. Upgrade DeepSeek plan if needed
4. Implement rate limiting in your app

#### Chat Not Responding
**Problem**: AI not generating responses

**Solution**:
1. Check browser console (F12) for errors
2. Verify internet connection is stable
3. Check DeepSeek service status
4. Try a shorter, simpler message
5. Try in different browser
6. Check if API calls are reaching server (Network tab)

---

### 2. Voice Features Issues

#### Microphone Not Working
**Problem**: Voice input not capturing audio

**Solution**:
1. Check microphone is plugged in and working
2. Verify browser has microphone permission:
   - Chrome: Click lock icon → Microphone → Allow
   - Firefox: Settings → Privacy → Microphone permissions
3. Test microphone in browser settings
4. Try different microphone/headset
5. Restart browser
6. Check browser supports Web Speech API

#### Voice Recognition Not Accurate
**Problem**: Speech-to-text producing wrong text

**Solution**:
1. Speak clearly and at normal pace
2. Reduce background noise
3. Speak slightly closer to microphone
4. Use English language setting
5. Try Chrome or Edge (better support)
6. Clear browser cache

#### Text-to-Speech Not Working
**Problem**: AI responses not being read aloud

**Solution**:
1. Check speaker/headphones are connected
2. Check volume is not muted
3. Verify browser supports Web Audio API
4. Try Chrome or Firefox
5. Disable browser extensions (F12 → Disable all)
6. Check system audio settings

#### Browser Says "Voice Not Supported"
**Problem**: Web Speech API not available

**Solution**:
- This is normal - not all browsers support it
- Try in Chrome, Edge, or Safari
- Voice features are optional, chat still works

---

### 3. File Upload Issues

#### File Won't Upload
**Problem**: Files not uploading or showing error

**Solution**:
1. Check file size (max 10MB)
2. Verify file format is supported:
   - ✅ PDF, Word (.docx), Excel (.xlsx)
   - ✅ CSV, Text (.txt), Images (PNG, JPG)
   - ❌ Other formats not supported
3. Try a different file
4. Check file isn't corrupted
5. Try dragging file instead of clicking
6. Clear browser cache

#### Error: "File too large"
**Problem**: File exceeds 10MB limit

**Solution**:
1. Compress the file
2. Split into smaller files
3. Upload in multiple chunks
4. Check file actual size (Properties)
5. Contact support if need larger limit

#### Error: "Unsupported file type"
**Problem**: File format not in supported list

**Solution**:
1. Convert file to supported format
   - Word → Export as .docx
   - PDF → Keep as is
   - Excel → Save as .xlsx
   - Images → Save as PNG or JPG
2. Use correct file extension
3. Check file isn't disguised (e.g., .txt with wrong name)

#### File Uploaded But Not Sent
**Problem**: File shows as uploaded but not with message

**Solution**:
1. Click Send button to attach files
2. Check files appear in upload preview
3. Remove and re-upload if needed
4. Try uploading fewer files at once

---

### 4. Chat & Messages Issues

#### Chat History Disappeared
**Problem**: Previous messages lost

**Solution**:
1. Check if you changed chat in sidebar
2. This is normal - data is session-only
3. For permanent storage, add database
4. Don't close browser tab if want to keep chat
5. Upgrade to production setup with database

#### Messages Not Sending
**Problem**: Send button not working

**Solution**:
1. Check message is not empty
2. Try shorter message
3. Wait for previous response to complete
4. Check internet connection
5. Refresh page (F5)
6. Check browser console for errors
7. Try different message format

#### Long Messages Getting Cut Off
**Problem**: Message content truncated

**Solution**:
1. This shouldn't happen - report if it does
2. Try sending as multiple messages
3. Check browser console for errors
4. Try in different browser

#### Can't Copy Message
**Problem**: Copy button not working

**Solution**:
1. Right-click and use "Copy" from menu
2. Try keyboard shortcut (Ctrl+C)
3. Clear browser cache
4. Try different browser
5. Check clipboard isn't full

---

### 5. Authentication Issues

#### Can't Log In
**Problem**: Login button not working or shows error

**Solution**:
1. Check email format is valid
2. Clear browser cookies (Ctrl+Shift+Delete)
3. Try different browser
4. Check internet connection
5. Try demo user button
6. Check if service is down

#### Session Lost After Refresh
**Problem**: Need to log in again after page refresh

**Solution**:
1. This is normal for demo version
2. To keep sessions, implement database
3. Upgrade to production setup with proper auth
4. Use Microsoft OAuth for enterprise setup

#### Stuck on Login Page
**Problem**: Can't get past login

**Solution**:
1. Refresh page (F5)
2. Clear all cookies (Ctrl+Shift+Delete)
3. Try in private/incognito window
4. Try different browser
5. Check internet connection
6. Check browser has JavaScript enabled

#### Microsoft OAuth Not Working
**Problem**: "Sign in with Microsoft" button not working

**Solution**:
1. Make sure setup is complete (MICROSOFT_AUTH_SETUP.md)
2. Check Azure app is registered
3. Verify redirect URI matches exact URL
4. Check client ID and secret are correct
5. Clear browser cache and cookies
6. Try in different browser
7. Check browser supports OAuth (JavaScript enabled)

---

### 6. Performance Issues

#### Slow Response Time
**Problem**: Waiting long for AI responses

**Solution**:
1. Check internet speed (speedtest.net)
2. Reduce message complexity
3. DeepSeek might be busy - wait a moment
4. Try again during off-peak hours
5. Check browser isn't running other heavy tasks

#### High CPU/Memory Usage
**Problem**: Browser/computer getting slow

**Solution**:
1. Close other browser tabs
2. Close unnecessary applications
3. Clear browser cache (Ctrl+Shift+Delete)
4. Disable browser extensions (F12)
5. Restart browser
6. Try different browser

#### Chat Loading Forever
**Problem**: Messages/chat won't load

**Solution**:
1. Refresh page (F5)
2. Clear browser cache
3. Try in private window
4. Check internet connection
5. Check server status
6. Try different browser

---

### 7. Browser & Compatibility Issues

#### Page Blank or Not Loading
**Problem**: Site shows blank page or error

**Solution**:
1. Refresh page (F5 or Cmd+R)
2. Hard refresh (Ctrl+Shift+R)
3. Clear cache (Ctrl+Shift+Delete)
4. Check JavaScript is enabled:
   - Settings → Privacy → JavaScript (enable)
5. Try different browser
6. Check internet connection
7. Check browser console (F12) for errors

#### UI Elements Missing or Broken Layout
**Problem**: Components not displaying correctly

**Solution**:
1. Refresh page
2. Clear browser cache
3. Disable browser extensions
4. Try different browser
5. Check browser window isn't too narrow
6. Check browser zoom is 100% (Ctrl+0)
7. Update browser to latest version

#### Slow Interface/Lag
**Problem**: Clicking buttons feels slow

**Solution**:
1. Close other tabs/applications
2. Clear browser cache
3. Disable extensions
4. Reduce browser animations (Settings)
5. Try different browser
6. Restart computer

#### Doesn't Work on Mobile
**Problem**: App not responsive on phone

**Solution**:
1. App is designed for desktop first
2. For mobile, zoom out or rotate phone
3. Try mobile browser (Chrome, Safari)
4. Check screen isn't zoomed in
5. Check mobile browser supports required features

---

### 8. Deployment Issues

#### Deploy Fails on Vercel
**Problem**: Build or deployment error

**Solution**:
1. Check error message in deployment log
2. Run `pnpm build` locally to test
3. Check all environment variables are set
4. Verify `.env` variables aren't in code
5. Check package.json is valid
6. Clear Vercel cache and redeploy

#### Works Locally But Not on Vercel
**Problem**: Development works, production doesn't

**Solution**:
1. Check environment variables in Vercel dashboard
2. Compare local `.env.local` with Vercel vars
3. Ensure API keys are valid
4. Check URLs are using production domain
5. Check CORS headers configuration
6. Look for hardcoded localhost references

#### Can't Access Deployed Site
**Problem**: Getting 404 or connection error

**Solution**:
1. Check Vercel deployment completed (green checkmark)
2. Wait a few minutes for DNS to propagate
3. Try different browser/incognito window
4. Check custom domain DNS records
5. Check domain is correctly connected in Vercel
6. Check project settings in Vercel

---

## 🧹 General Maintenance

### When to Clear Cache
```bash
# Browser cache
Ctrl+Shift+Delete → "All time" → Clear

# Next.js cache (local)
rm -rf .next

# Node modules (if issues)
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Restart Dev Server
```bash
# Stop current server (Ctrl+C)
# Then:
pnpm dev
```

### Check Dependencies
```bash
# Show outdated packages
pnpm outdated

# Update packages
pnpm update
```

### Verify Setup
```bash
# Check environment
pnpm list

# Check Node version
node --version  # Should be 18+

# Check npm/pnpm
pnpm --version  # Should be 8+
```

---

## 📊 Error Reference

| Error | Cause | Solution |
|-------|-------|----------|
| `DEEPSEEK_API_KEY not set` | Missing env var | Add to `.env.local` |
| `401 Unauthorized` | Invalid API key | Get new key from DeepSeek |
| `429 Too Many Requests` | Rate limited | Wait and retry |
| `Microphone permission denied` | Browser permission | Allow in browser settings |
| `FileSize exceeds limit` | File > 10MB | Compress or split file |
| `Unsupported file type` | Wrong format | Convert to supported format |
| `Cannot find module` | Missing dependency | Run `pnpm install` |
| `Port 3000 already in use` | Dev server conflict | Use different port: `pnpm dev -- -p 3001` |

---

## 🆘 Getting More Help

### 1. Check Documentation
- **Setup**: SETUP.md
- **Usage**: USER_GUIDE.md
- **Architecture**: ARCHITECTURE.md
- **Deployment**: DEPLOYMENT_CHECKLIST.md

### 2. Check Browser Console
1. Press `F12`
2. Go to "Console" tab
3. Look for error messages
4. Red errors are critical, yellow are warnings

### 3. Check Network Tab
1. Press `F12`
2. Go to "Network" tab
3. Reload page
4. Look for failed requests (red)
5. Check response status codes

### 4. Try Debug Steps
1. Clear cache and cookies
2. Try in private/incognito window
3. Try different browser
4. Try different device
5. Restart dev server
6. Restart computer

### 5. Search for Answers
- Search error message in Google
- Check GitHub issues
- Check project documentation
- Check official docs (DeepSeek, Next.js, etc.)

### 6. Ask for Help
- Contact development team
- Provide error message and steps to reproduce
- Share screenshot of error
- Share browser console errors
- Mention what you've tried

---

## 🎯 Quick Diagnostic Checklist

- [ ] Check internet connection
- [ ] Check browser console (F12) for errors
- [ ] Check `.env.local` has all required variables
- [ ] Try refreshing page (F5)
- [ ] Try different browser
- [ ] Try private/incognito window
- [ ] Clear cache and cookies
- [ ] Check official documentation
- [ ] Restart dev server
- [ ] Check GitHub issues/discussions

---

**Remember**: Most issues have simple solutions! 

Try the steps above before reporting a bug. If you're stuck, check the documentation or contact the team with details about what you've tried.
