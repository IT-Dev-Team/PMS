# EIH AI Assistant - Setup Guide

Ethiopian Investment Holding AI Chat Platform powered by DeepSeek

## Features

- 🤖 **AI Chat** - Powered by DeepSeek's free API
- 📄 **Document Upload** - Support for PDF, Word, Excel, CSV, Images, and Text files
- 🎙️ **Voice Input & Output** - Web Speech API integration
- 💬 **Chat History** - Persistent session storage
- 🏢 **Enterprise Branding** - Ethiopian Investment Holding color theme (Gold & Green)
- 🔐 **Microsoft Authentication** - OAuth integration ready

## Getting Started

### 1. Clone and Install

```bash
git clone <repository>
cd <project-folder>
pnpm install
```

### 2. Set Up Environment Variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_DEEPSEEK_API_KEY=sk_live_your_api_key_here
```

### 3. Get DeepSeek API Key (Free)

1. Visit [DeepSeek Platform](https://platform.deepseek.com/)
2. Create a free account
3. Generate an API key
4. Add it to your `.env.local` file

### 4. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Architecture

### Authentication Flow
- **Current**: Demo-based (email login for testing)
- **Production**: Integrate NextAuth.js with Microsoft OAuth

### Components Structure

```
components/
├── chat-interface.tsx    # Main chat UI
├── sidebar.tsx          # Chat history & quick access
├── message.tsx          # Message display component
├── file-upload.tsx      # Document upload handler
├── voice-input.tsx      # Voice recognition & speech
└── login-page.tsx       # Authentication UI

lib/
├── chat-context.tsx     # State management
├── deepseek.ts         # AI API integration
├── voice.ts            # Web Speech API utilities
├── files.ts            # File processing
├── types.ts            # TypeScript interfaces
└── utils.ts            # Helper functions
```

## Features in Detail

### Chat Interface
- Real-time message streaming from DeepSeek
- Conversation history within session
- Copy message to clipboard
- Responsive layout

### Document Upload
- Multi-file upload support
- Supported formats: PDF, DOCX, XLSX, CSV, TXT, PNG, JPG
- File size limit: 10MB per file
- Preview of uploaded files

### Voice Features
- **Input**: Speech-to-text using Web Speech API
- **Output**: Text-to-speech for AI responses
- Works in Chrome, Edge, Safari (with limitations)

### Color Theme (Ethiopian Investment Holding)
- **Primary**: Dark Green (#1d5a3d)
- **Accent**: Gold (#ffd700)
- **Background**: Dark Navy (#0a0e27)
- **Text**: Light Gray (#f5f5f5)

## DeepSeek API Integration

### Model Configuration
- **Model**: `deepseek-chat`
- **Max Tokens**: 2048
- **Temperature**: 0.7
- **Top P**: 0.95

### Free Tier Limits
- Check DeepSeek documentation for rate limits
- Free tier typically includes:
  - Limited API calls per day
  - Lower priority queue
  - Community support

### Production Considerations
- Implement rate limiting
- Add error handling for API failures
- Cache responses for repeated queries
- Monitor API usage

## Microsoft Authentication Setup (Optional)

For production, replace demo auth with NextAuth.js:

### 1. Install NextAuth

```bash
pnpm add next-auth
```

### 2. Create `auth.ts`

```typescript
import NextAuth from "next-auth"
import AzureAD from "next-auth/providers/azure-ad"

export const { auth, handlers } = NextAuth({
  providers: [
    AzureAD({
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      tenantId: process.env.MICROSOFT_TENANT_ID!,
    }),
  ],
})
```

### 3. Configure Environment Variables

```env
NEXTAUTH_SECRET=your-secret-key
MICROSOFT_CLIENT_ID=your-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret
MICROSOFT_TENANT_ID=your-tenant-id
```

## Deployment

### Deploy to Vercel

```bash
vercel deploy
```

### Environment Variables in Vercel

1. Go to Project Settings → Environment Variables
2. Add:
   - `NEXT_PUBLIC_DEEPSEEK_API_KEY`
   - `NEXTAUTH_SECRET`
   - `MICROSOFT_CLIENT_ID`
   - `MICROSOFT_CLIENT_SECRET`

## Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ⚠️ Voice features may have limitations in some browsers

## Troubleshooting

### Voice Input Not Working
- Check browser permissions for microphone
- Verify browser supports Web Speech API
- Try in a different browser (Chrome recommended)

### DeepSeek API Errors
- Verify API key is valid
- Check rate limits haven't been exceeded
- Ensure environment variable is set correctly
- Check network connectivity

### File Upload Issues
- Verify file size is under 10MB
- Check file format is supported
- Clear browser cache and try again

## Development Notes

### State Management
- Uses React Context for chat state
- In-memory storage (data lost on refresh)
- For persistence, integrate with database (Supabase, etc.)

### Styling
- Tailwind CSS for styling
- Custom color theme using CSS variables
- Dark mode by default

### Type Safety
- Full TypeScript support
- Interfaces for Chat, Message, User types
- Type-safe API integration

## Future Enhancements

- [ ] Database persistence (Supabase/Neon)
- [ ] User profiles and settings
- [ ] Chat sharing and collaboration
- [ ] Advanced document analysis
- [ ] Custom AI model fine-tuning
- [ ] Analytics and usage tracking
- [ ] Mobile app (React Native)
- [ ] Real-time collaboration

## License

This project is part of Ethiopian Investment Holding's AI initiative.

## Support

For questions or issues:
1. Check the troubleshooting section
2. Review DeepSeek API documentation
3. Check browser console for errors
4. Contact the development team
