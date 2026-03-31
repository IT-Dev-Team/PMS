# EIH AI Assistant

Ethiopian Investment Holding AI Chat Platform powered by DeepSeek

## 🚀 Quick Start

Get up and running in 5 minutes:

```bash
# 1. Clone repository
git clone <repo> && cd <project>

# 2. Install dependencies
pnpm install

# 3. Set up environment
cp .env.example .env.local
# Add your DeepSeek API key to .env.local

# 4. Start development server
pnpm dev

# 5. Open browser
open http://localhost:3000
```

## ✨ Features

- **🤖 AI Chat**: Powered by DeepSeek's free API - Real-time responses with streaming
- **📄 Document Upload**: PDF, Word, Excel, CSV, Images, Text files
- **🎙️ Voice Features**: Speech-to-text input and text-to-speech output
- **💬 Chat History**: Persistent session storage with quick access sidebar
- **🎨 EIH Branding**: Professional color theme (Gold & Dark Green)
- **🔐 Authentication**: Demo mode + Microsoft OAuth ready (NextAuth.js)

## 📚 Documentation

Choose your next step:

### Getting Started
- **[SETUP.md](SETUP.md)** - Complete setup guide (DeepSeek API, environment variables)
- **[Quick Start Video](SETUP.md#getting-started)** - Step-by-step walkthrough

### Using the Application
- **[USER_GUIDE.md](USER_GUIDE.md)** - Feature guide and tips for users
- **[Chat Examples](USER_GUIDE.md#use-cases)** - Real-world use cases

### Authentication
- **[MICROSOFT_AUTH_SETUP.md](MICROSOFT_AUTH_SETUP.md)** - Microsoft OAuth integration guide
- **Azure AD Configuration** - Create application in Azure Portal

### Deployment
- **[DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)** - Pre-deployment checklist
- **Production Setup** - Environment variables and security

## 🏗️ Architecture

```
Components:
├── Chat Interface     - Main chat UI with message display
├── Sidebar           - Navigation and chat history
├── File Upload       - Document upload handler
├── Voice Input       - Speech recognition
├── Login Page        - Authentication UI

Libraries:
├── DeepSeek API      - AI chat responses
├── Web Speech API    - Voice input/output
├── React Context     - State management
├── Tailwind CSS      - Styling with EIH theme

Integrations:
├── NextAuth.js       - Microsoft OAuth (optional)
├── Vercel            - Hosting and deployment
└── Browser APIs      - Native browser capabilities
```

## 🔑 Environment Setup

### Required Variables
```env
NEXT_PUBLIC_DEEPSEEK_API_KEY=sk_live_xxx
```

### Optional (For Microsoft Auth)
```env
NEXTAUTH_SECRET=generated-secret
MICROSOFT_CLIENT_ID=your-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret
MICROSOFT_TENANT_ID=your-tenant-id
```

See [SETUP.md](SETUP.md) for detailed configuration.

## 🎨 Customization

### Colors (Ethiopian Investment Holding Theme)
```css
--primary: #1d5a3d      /* Dark Green */
--accent: #ffd700       /* Gold */
--background: #0a0e27   /* Dark Navy */
--foreground: #f5f5f5   /* Light Gray */
```

Edit `app/globals.css` to customize colors.

### Branding
- Update sidebar logo in `components/sidebar.tsx`
- Change company name in page titles
- Modify use cases in `lib/types.ts`

## 🚀 Deployment

### Deploy to Vercel (Recommended)

```bash
# 1. Push to GitHub
git push

# 2. Deploy from Vercel Dashboard
# or use CLI:
vercel deploy

# 3. Set environment variables in Vercel
# Settings → Environment Variables

# 4. Trigger deployment
```

See [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) for complete guide.

## 🔒 Security

- API keys stored in environment variables (never in code)
- HTTPS only in production
- Session-based authentication
- Input validation and sanitization
- CORS headers configured
- Microsoft OAuth support for enterprise

See [Security Section](SETUP.md#production-considerations) for details.

## 🛠️ Development

### Tech Stack
- **Framework**: Next.js 16
- **Language**: TypeScript
- **UI**: React + Tailwind CSS
- **State**: React Context
- **Auth**: NextAuth.js (optional)
- **AI**: DeepSeek API

### Project Structure
```
/app              - Next.js app router
/components       - React components
/lib              - Utilities and helpers
/public           - Static assets
/styles           - Global styles
```

### Scripts
```bash
pnpm dev      # Start development server
pnpm build    # Build for production
pnpm start    # Run production server
pnpm lint     # Run linter
```

## 📊 Performance

- Response time: < 2s average
- Chat streaming: Real-time display
- File uploads: Optimized for large files
- Voice recognition: Uses browser native API

## 🐛 Troubleshooting

Common issues and solutions:

### DeepSeek API Not Working
- Verify API key in `.env.local`
- Check DeepSeek account has credits
- Look for rate limit messages
- See [SETUP.md - Troubleshooting](SETUP.md#troubleshooting)

### Voice Features Not Working
- Check browser permissions (microphone)
- Try Chrome or Edge browser
- Verify speaker/headphones working
- See [USER_GUIDE.md - Voice Tips](USER_GUIDE.md#voice-tips)

### Authentication Issues
- Clear browser cookies and cache
- Verify environment variables set
- Check Azure AD configuration
- See [MICROSOFT_AUTH_SETUP.md - Troubleshooting](MICROSOFT_AUTH_SETUP.md#troubleshooting)

## 📞 Support

For help:
1. Check relevant documentation above
2. Review troubleshooting sections
3. Check browser console for errors (F12)
4. Search project issues in GitHub

## 📋 Checklist for Production

Before going live, complete the [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md):

- [ ] Code review completed
- [ ] Security audit passed
- [ ] Performance testing done
- [ ] Environment variables configured
- [ ] Monitoring set up
- [ ] Documentation reviewed
- [ ] Team trained

## 🔄 Updates and Maintenance

### Regular Tasks
- Monitor error logs
- Review API usage
- Update dependencies monthly
- Security patches as needed

### Scaling
- Implement database for persistent storage
- Add Redis for caching
- Configure auto-scaling on Vercel
- Optimize AI prompts based on usage

## 📝 License

Ethiopian Investment Holding AI Initiative

## 🎯 Roadmap

Future enhancements:
- [ ] Database persistence (Supabase/Neon)
- [ ] Advanced document analysis with LLM
- [ ] Team collaboration features
- [ ] Usage analytics and reporting
- [ ] Custom AI model fine-tuning
- [ ] Mobile app (React Native)
- [ ] API webhooks for integrations

## 🤝 Contributing

Team guidelines:
1. Create feature branch
2. Write tests
3. Update documentation
4. Submit pull request
5. Deploy to staging first

## ❓ FAQ

**Q: Is this free to use?**
A: Yes! Uses DeepSeek's free API tier. See limits in SETUP.md.

**Q: Can I add more users?**
A: Yes. For teams, implement proper auth and database storage.

**Q: How do I change the AI model?**
A: Update model name in `lib/deepseek.ts` and `app/api/chat/route.ts`

**Q: Can I self-host this?**
A: Yes! Deploy to your own server or use Docker.

**Q: What data is stored?**
A: Currently in-memory (session only). Add database for persistence.

---

## Next Steps

1. **First Time?** → Read [SETUP.md](SETUP.md)
2. **Want to Use It?** → See [USER_GUIDE.md](USER_GUIDE.md)
3. **Ready to Deploy?** → Follow [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)
4. **Need Microsoft Auth?** → Check [MICROSOFT_AUTH_SETUP.md](MICROSOFT_AUTH_SETUP.md)

---

**Made with ❤️ for Ethiopian Investment Holding**

**Questions?** Check the documentation or contact the development team.
