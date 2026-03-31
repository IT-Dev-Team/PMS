# EIH AI Assistant - Quick Reference Guide

## 🚀 Quick Commands

```bash
# Development
pnpm install              # Install dependencies
pnpm dev                  # Start dev server (http://localhost:3000)
pnpm build                # Build for production
pnpm start                # Run production build
pnpm lint                 # Run linter

# Deployment
vercel deploy             # Deploy to Vercel
vercel rollback           # Rollback to previous version
```

## 📁 Key Files to Know

| File | Purpose | Edit For |
|------|---------|----------|
| `app/page.tsx` | Main app component | Layout/flow changes |
| `app/globals.css` | Theme & colors | Color scheme changes |
| `components/chat-interface.tsx` | Chat UI | Message display, input area |
| `lib/deepseek.ts` | AI integration | AI behavior, model config |
| `lib/chat-context.tsx` | State management | Data flow |
| `components/sidebar.tsx` | Navigation | Chat history, menu items |
| `.env.local` | Configuration | API keys, secrets |

## 🎨 Customization Cheat Sheet

### Change Colors
Edit `app/globals.css` (`:root` section):
```css
--primary: #1d5a3d;         /* Dark Green */
--accent: #ffd700;           /* Gold */
--background: #0a0e27;       /* Dark Navy */
```

### Change Company Name
1. `components/sidebar.tsx` - "EIH AI"
2. `components/login-page.tsx` - Title text
3. `app/page.tsx` - Welcome message
4. Documentation files

### Add More Use Cases
Edit `lib/types.ts`:
```typescript
export const PREDEFINED_USE_CASES = [
  {
    id: '7',
    title: 'Your New Case',
    description: 'Description here',
    icon: '🎯',
  },
  // ... more
];
```

### Change AI Model
Edit `lib/deepseek.ts`:
```typescript
// Line ~30: Change model name
model: 'deepseek-chat',  // ← Change this
```

### Modify API Settings
Edit `lib/deepseek.ts`:
```typescript
// Around line 35-40:
temperature: 0.7,        // ← Lower = more focused, Higher = more creative
top_p: 0.95,            // ← Nucleus sampling threshold
max_tokens: 2048,       // ← Max response length
```

## 🔗 API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/` | GET | Main chat page |
| `/api/chat` | POST | Chat API (optional proxy) |

## 📦 Environment Variables

```env
# Required
NEXT_PUBLIC_DEEPSEEK_API_KEY=sk_live_xxx

# Optional (for OAuth)
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=http://localhost:3000
MICROSOFT_CLIENT_ID=xxx
MICROSOFT_CLIENT_SECRET=xxx
MICROSOFT_TENANT_ID=xxx
```

## 🧩 Component Props

### ChatInterface
```typescript
// No props - uses ChatContext
<ChatInterface />
```

### FileUpload
```typescript
interface FileUploadProps {
  onFilesSelected: (files: FileInfo[]) => void;
  disabled?: boolean;
}
```

### VoiceInput
```typescript
interface VoiceInputProps {
  onTranscript: (text: string) => void;
  onSpeakText?: (text: string) => void;
  disabled?: boolean;
}
```

### LoginPage
```typescript
interface LoginPageProps {
  onLogin: (email: string) => void;
}
```

## 🎯 Common Tasks

### Add Console Logging (Debug)
```typescript
console.log("[v0] Variable name:", value);
```

### Get Current Chat
```typescript
const { currentChat } = useChat();
```

### Add Message to Chat
```typescript
const { addMessage } = useChat();
addMessage({
  id: `msg_${Date.now()}`,
  role: 'user',
  content: 'Your message',
  timestamp: new Date(),
});
```

### Handle File Upload
```typescript
const handleFilesSelected = (files: FileInfo[]) => {
  setAttachedFiles(files);
  // Use files here
};
```

### Make API Call
```typescript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages }),
});
const data = await response.json();
```

## 🎨 CSS Classes Reference

### Tailwind Tokens (Color)
```
bg-background      - Main background
bg-foreground      - Main text color
bg-card            - Card backgrounds
bg-accent          - Gold accent color
bg-primary         - Dark green
bg-destructive     - Red/error color
text-foreground    - Main text
text-muted         - Subtle text
```

### Layout Classes
```
flex               - Flexbox
grid               - CSS Grid
gap-4              - Spacing between items
p-4                - Padding
m-4                - Margin
rounded-lg         - Border radius
border             - Border
```

### Responsive Classes
```
md:grid-cols-2     - 2 columns on tablet
lg:text-xl         - Larger text on desktop
hidden md:block     - Hidden on mobile, visible on tablet
```

## 🔐 Security Quick Tips

✅ **DO:**
- Store secrets in `.env.local`
- Use environment variables for API keys
- Validate user input
- Use HTTPS in production
- Keep dependencies updated

❌ **DON'T:**
- Commit `.env.local`
- Hardcode API keys
- Store passwords in plain text
- Trust client-side validation alone
- Expose sensitive info in console logs

## 📊 File Size Limits

- **File Upload**: 10MB max
- **Message Content**: No strict limit
- **Bundle Size**: Monitor with `next/bundle-analyzer`

## 🌐 Browser Support

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Chat | ✅ | ✅ | ✅ | ✅ |
| Voice Input | ✅ | ✅ | ⚠️ | ✅ |
| Voice Output | ✅ | ✅ | ✅ | ✅ |
| File Upload | ✅ | ✅ | ✅ | ✅ |

## 🐛 Debugging

### Enable Debug Logging
Add to `lib/deepseek.ts`:
```typescript
console.log("[v0] API Call:", { messages, response });
```

### Check Browser Console
Press `F12` in browser to open developer tools

### Check Network Tab
See API requests/responses in Network tab

### React DevTools
Install React DevTools browser extension to inspect components

## 📱 Responsive Breakpoints

```
Mobile:   < 640px
Tablet:   640px - 1024px
Desktop:  > 1024px
```

## 🎯 TypeScript Tips

### Define New Interface
```typescript
export interface MyInterface {
  id: string;
  name: string;
  createdAt: Date;
}
```

### Use Type from Import
```typescript
import { Chat } from '@/lib/types';

const myChat: Chat = { /* ... */ };
```

### Optional Properties
```typescript
interface MyType {
  required: string;
  optional?: string;  // ← Optional
}
```

## 🚀 Performance Tips

1. **Use React.memo** for complex components
2. **Lazy load components** with `next/dynamic`
3. **Optimize images** with `next/image`
4. **Code split** - Next.js does this automatically
5. **Avoid inline functions** in props
6. **Cache API responses** where appropriate

## 📚 Documentation Map

- **User Guide**: USER_GUIDE.md
- **Setup Guide**: SETUP.md
- **Architecture**: ARCHITECTURE.md
- **Authentication**: MICROSOFT_AUTH_SETUP.md
- **Deployment**: DEPLOYMENT_CHECKLIST.md
- **This Reference**: QUICK_REFERENCE.md

## 🔄 Git Workflow

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes
git add .
git commit -m "Add my feature"

# Push to GitHub
git push origin feature/my-feature

# Create Pull Request on GitHub
# → Merge to main
# → Deploy to Vercel
```

## 📞 Getting Help

1. **Error Messages** → Google the exact error
2. **Component Issue** → Check component props in code
3. **API Issue** → Check DeepSeek API docs
4. **Deployment Issue** → Check DEPLOYMENT_CHECKLIST.md
5. **Feature Request** → Check ARCHITECTURE.md for extensibility

## ⚡ Quick Deploy

```bash
# One-liner to deploy
git add . && git commit -m "Update" && git push

# Vercel auto-deploys from GitHub
# Check status at vercel.com/dashboard
```

---

**Keep this handy while developing!** 

Bookmark this page for quick reference while coding.
