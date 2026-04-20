# DeepSeek Chat - AI Document Analysis Platform

A powerful AI-driven chat application with document analysis, real-time data warehouse integration, and secure sharing capabilities. Built with Next.js 16, Supabase, Vercel Blob, and Google Gemini API.

## Features

### 🤖 Chat & AI
- **Real-time Chat**: Multi-turn conversations with Gemini AI
- **Document Upload**: Support for PDF, Word, Excel, and text files
- **AI Context**: AI responses consider uploaded documents
- **Chat History**: Full conversation history with metadata
- **Message Streaming**: Real-time response generation

### 📄 Document Management
- **Multi-Document Upload**: Drag-and-drop interface with progress tracking
- **Document Storage**: Secure storage via Vercel Blob
- **Document Analysis**: AI-powered analysis with configurable rules
- **Document Comparison**: Compare multiple documents side-by-side
- **Smart Extraction**: Extract entities, data, and insights

### 🔍 Document Analysis
- **Financial Data Extraction**: Identifies monetary values and figures
- **Entity Recognition**: Recognizes people, organizations, locations
- **Key Points Summary**: Automatically extracts main ideas
- **Compliance Check**: Identifies regulatory mentions
- **Customizable Rules**: Define company-specific analysis rules

### 📊 Data Warehouse Integration
- **Snowflake Integration**: Execute SQL queries against your warehouse
- **Real-time Data**: Fetch live data and embed in conversations
- **Query Builder**: User-friendly SQL interface
- **Result Visualization**: Display query results in tables
- **Audit Trail**: Track all warehouse queries

### 🔗 Sharing & Collaboration
- **Shareable Links**: Generate unique shareable URLs
- **Access Control**: Password-protected shares
- **Expiration Dates**: Set link expiration periods (default 7 days)
- **Access Logs**: Track who accesses shared chats
- **Read-only View**: Recipients can view but not modify

### 📥 Export & Generation
- **Multi-format Export**: Download as Markdown, JSON, or HTML
- **Chat Transcripts**: Generate complete conversation exports
- **Document Reports**: Compile analysis results into documents
- **Clean Formatting**: Professional, readable output formats

### 👤 Authentication
- **Microsoft OAuth**: Sign in with Microsoft Account via Azure
- **Secure Sessions**: HTTP-only cookies with secure session management
- **User Isolation**: Row-Level Security (RLS) ensures data isolation
- **Multi-device**: Access from any device

## Tech Stack

### Frontend
- **Next.js 16**: React framework with App Router
- **React 19.2**: Latest React with concurrent features
- **TypeScript**: Type-safe development
- **Tailwind CSS v4**: Modern utility-first CSS
- **shadcn/ui**: Accessible component library
- **SWR**: Client-side data fetching and caching

### Backend
- **Next.js API Routes**: Serverless backend functions
- **Supabase**: PostgreSQL database + Auth
- **Vercel Blob**: File storage solution
- **Google Gemini API**: AI/LLM capabilities

### Infrastructure
- **Vercel**: Deployment platform
- **Supabase**: Database hosting
- **Snowflake**: Data warehouse (demo integration)

## Project Structure

```
├── app/
│   ├── auth/              # Authentication pages
│   │   ├── login/
│   │   ├── callback/
│   │   └── signup/
│   ├── chat/              # Chat interface
│   │   ├── [id]/          # Chat detail page
│   │   ├── layout.tsx     # Chat layout with sidebar
│   │   └── page.tsx       # Chat index
│   ├── api/               # API routes
│   │   ├── chats/         # Chat management
│   │   ├── documents/     # Document operations
│   │   ├── export/        # Export functionality
│   │   ├── warehouse/     # Data warehouse
│   │   └── share/         # Sharing & access
│   ├── share/             # Public share pages
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home redirect
│   └── globals.css        # Global styles
├── components/
│   ├── chat/              # Chat-related components
│   │   ├── sidebar.tsx
│   │   ├── top-bar.tsx
│   │   ├── chat-messages.tsx
│   │   ├── chat-input.tsx
│   │   ├── document-comparison.tsx
│   │   └── warehouse-query.tsx
│   └── ui/                # shadcn/ui components
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities and helpers
├── scripts/               # Database migrations
└── middleware.ts          # Auth middleware
```

## Database Schema

### Core Tables
- **users**: User profiles (managed by Supabase Auth)
- **chats**: Chat conversations
- **messages**: Chat messages
- **attachments**: File attachments with metadata

### Documents & Analysis
- **documents**: Document metadata
- **document_analysis**: Analysis results
- **document_comparisons**: Comparison results
- **analysis_rules**: Company-defined analysis rules

### Sharing & Access
- **shared_chats**: Shareable chat links
- **share_access_logs**: Access tracking
- **warehouse_queries**: Query audit trail

## Getting Started

### Prerequisites
- Node.js 18+
- npm or pnpm package manager
- Supabase account
- Google API key (Gemini)
- Vercel account (optional, for deployment)

### Environment Setup

1. **Clone and install dependencies:**
```bash
npm install
# or
pnpm install
```

2. **Create `.env.local` file:**
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Google Gemini API
GOOGLE_API_KEY=your_gemini_api_key

# Optional: Vercel Blob
BLOB_READ_WRITE_TOKEN=your_blob_token
```

3. **Get your API keys:**
   - [Supabase](https://supabase.com)
   - [Google AI Studio](https://aistudio.google.com)
   - [Vercel Blob](https://vercel.com/docs/storage/vercel-blob)

### Running Locally

```bash
npm run dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Database Setup

The database schema is automatically created via the migration script:

```bash
npm run db:migrate
```

Or manually execute `/scripts/01-init-schema.sql` in your Supabase editor.

## API Documentation

### Chat Endpoints
- `GET /api/chats` - List user's chats
- `POST /api/chats` - Create new chat
- `GET /api/chats/recent` - Get recent chats
- `GET /api/chats/[id]/messages` - Get chat messages
- `POST /api/chats/messages` - Send message

### Document Endpoints
- `POST /api/documents/analyze` - Analyze document
- `POST /api/documents/compare` - Compare documents

### Sharing Endpoints
- `POST /api/chats/share` - Create share link
- `GET /api/share/[token]` - Access shared chat
- `POST /api/share/[token]/verify` - Verify password

### Warehouse Endpoints
- `POST /api/warehouse/query` - Execute warehouse query
- `GET /api/warehouse/query` - Get warehouse status

### Export Endpoints
- `POST /api/export/chat` - Export chat conversation

## Configuration

### Document Analysis Rules

Edit default rules in `/app/api/documents/analyze/route.ts`:

```typescript
const DEFAULT_RULES: AnalysisRule[] = [
  {
    name: 'Your Rule Name',
    pattern: 'Description of what to extract',
    description: 'User-friendly description',
  },
]
```

### Warehouse Connection

Currently uses mock Snowflake data. To connect a real warehouse:

1. Update `/app/api/warehouse/query/route.ts`
2. Add your Snowflake credentials to environment
3. Replace mock data with real queries

### Microsoft OAuth Setup

1. Register app in [Azure Portal](https://portal.azure.com)
2. Configure OAuth consent screen
3. Add redirect URI: `https://your-domain/auth/callback`
4. Set credentials in Supabase Auth → Providers

## Deployment

### Deploy to Vercel

```bash
vercel deploy
```

Or connect your GitHub repository and enable auto-deployment.

### Environment Variables
Set these in your Vercel project settings:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GOOGLE_API_KEY`
- `BLOB_READ_WRITE_TOKEN` (if using Vercel Blob)

## Security Features

- **Row-Level Security (RLS)**: Database-level access control
- **Authentication**: Microsoft OAuth via Supabase Auth
- **HTTPS Only**: Secure cookie transmission
- **Password Hashing**: SHA-256 for share passwords
- **Access Logging**: Track all share access
- **File Validation**: Type and size restrictions
- **SQL Injection Prevention**: Parameterized queries
- **CORS Protection**: API security headers

## Performance Optimizations

- **Image Optimization**: Next.js Image component
- **Code Splitting**: Automatic route-based splitting
- **Caching**: SWR with smart invalidation
- **Lazy Loading**: Component-level code splitting
- **Database Indexing**: Optimized query performance
- **CDN**: Vercel's global edge network

## Monitoring & Logging

- **Error Tracking**: Console errors with context
- **Audit Trails**: All warehouse queries logged
- **Access Logs**: Share link access tracking
- **Performance**: Built-in Next.js analytics

## Troubleshooting

### Authentication Issues
- Check Supabase credentials in env
- Verify Microsoft OAuth configuration
- Clear browser cookies and retry

### Document Upload Fails
- Verify file size < 50MB
- Check file format (PDF, Word, Excel, Text)
- Ensure Vercel Blob credentials are set

### AI Responses Not Working
- Verify Google API key is valid
- Check API quotas and rate limits
- Review error logs in console

### Warehouse Query Errors
- Verify table names match available tables
- Check SQL syntax
- Review warehouse connection settings

## Contributing

1. Create a feature branch: `git checkout -b feature/amazing-feature`
2. Commit changes: `git commit -m 'Add amazing feature'`
3. Push to branch: `git push origin feature/amazing-feature`
4. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Check existing documentation
- Review API logs and error messages

## Roadmap

- [ ] Real Snowflake warehouse integration
- [ ] Advanced document processing (OCR)
- [ ] Custom model fine-tuning
- [ ] Team collaboration features
- [ ] Advanced analytics dashboard
- [ ] API webhooks
- [ ] Mobile app
- [ ] Voice chat support

---

**Built with ❤️ using Next.js, Supabase, and Google Gemini**
#   c h a t b o t A I  
 