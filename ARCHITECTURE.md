# EIH AI Assistant - Architecture & Data Flow

## System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    EIH AI Assistant                           │
│                    (Next.js Application)                      │
└──────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
   ┌─────────────┐   ┌─────────────────┐   ┌─────────────────┐
   │   Browser   │   │   Web Speech    │   │   File System   │
   │    APIs     │   │      API        │   │   (localStorage)│
   └─────────────┘   └─────────────────┘   └─────────────────┘
        │                     │                     │
        ├─────────────────────┼─────────────────────┤
        │                     │                     │
        ▼                     ▼                     ▼
   ┌──────────────────────────────────────────────────────────┐
   │              Next.js Application Layer                    │
   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
   │  │   Frontend   │  │    Pages     │  │  API Routes  │   │
   │  │  Components  │  │              │  │              │   │
   │  └──────────────┘  └──────────────┘  └──────────────┘   │
   └──────────────────────────────────────────────────────────┘
              │                    │                  │
              ▼                    ▼                  ▼
        ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
        │  Chat UI     │  │  Auth Layer  │  │  API Proxy   │
        │  Components  │  │              │  │              │
        └──────────────┘  └──────────────┘  └──────────────┘
              │                    │                  │
              └────────────────────┼──────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
            ┌──────────────────┐         ┌──────────────────┐
            │  DeepSeek API    │         │ External Auth    │
            │                  │         │ (Azure OAuth)    │
            │  deepseek.com/v1 │         │                  │
            └──────────────────┘         └──────────────────┘
```

## Component Hierarchy

```
RootLayout
├── ChatProvider (Context)
└── Page (Main Component)
    ├── LoginPage (if !authenticated)
    │   ├── Header/Logo
    │   ├── LoginForm
    │   │   ├── EmailInput
    │   │   └── SubmitButton
    │   └── Features Display
    │
    └── MainLayout (if authenticated)
        ├── Sidebar
        │   ├── Logo Header
        │   ├── NewChatButton
        │   ├── ChatHistory
        │   │   └── ChatItem[] (with delete button)
        │   └── QuickStart UseCases
        │
        ├── TopBar
        │   ├── UserInfo
        │   └── SignOutButton
        │
        └── ChatInterface
            ├── MessageContainer
            │   └── MessageComponent[]
            │       ├── Avatar
            │       ├── Content
            │       ├── Attachments
            │       └── CopyButton
            │
            ├── FileUpload
            │   ├── DropZone
            │   ├── FileInput
            │   └── UploadedFilesList
            │       └── FileItem[]
            │
            ├── VoiceInput
            │   ├── MicrophoneButton
            │   ├── TranscriptDisplay
            │   └── SpeakerButton
            │
            └── ChatInput
                ├── Textarea
                ├── SendButton
                └── LoadingIndicator
```

## Data Flow Diagrams

### 1. Message Flow

```
User Types Message
        │
        ▼
┌────────────────────┐
│ Input Validation   │
└────────────────────┘
        │
        ▼
┌────────────────────┐
│ Add User Message   │ ◄── Messages Array
│ to Chat Context    │     (in memory)
└────────────────────┘
        │
        ▼
┌────────────────────┐
│ Build Chat History │ ◄── Previous Messages
│ for API Call       │
└────────────────────┘
        │
        ▼
┌────────────────────┐
│ Call DeepSeek API  │ ──► DeepSeek Server
│ (with streaming)   │
└────────────────────┘
        │
        ▼
┌────────────────────┐
│ Stream Response    │ ──► Display in UI
│ Chunks to UI       │     (real-time)
└────────────────────┘
        │
        ▼
┌────────────────────┐
│ Store Full AI      │ ◄── Chat Context
│ Response           │     (in memory)
└────────────────────┘
```

### 2. File Upload Flow

```
User Selects Files
        │
        ▼
┌────────────────────────┐
│ Validate File Format   │
│ (PDF, DOCX, etc.)      │
└────────────────────────┘
        │
        ▼ (if invalid)
    [Show Error]
        │
        ▼ (if valid)
┌────────────────────────┐
│ Validate File Size     │
│ (Max 10MB)             │
└────────────────────────┘
        │
        ▼ (if too large)
    [Show Error]
        │
        ▼ (if valid)
┌────────────────────────┐
│ Read File Content      │
│ (for text files)       │
└────────────────────────┘
        │
        ▼
┌────────────────────────┐
│ Create FileInfo Object │
│ with metadata          │
└────────────────────────┘
        │
        ▼
┌────────────────────────┐
│ Add to Attached Files  │
│ State                  │
└────────────────────────┘
        │
        ▼
┌────────────────────────┐
│ Display in UI Preview  │
└────────────────────────┘
        │
        ▼
┌────────────────────────┐
│ Send with Next Message │
│ (attached to message)  │
└────────────────────────┘
```

### 3. Voice Input Flow

```
User Clicks Microphone
        │
        ▼
┌──────────────────────┐
│ Request Microphone   │
│ Permission           │
└──────────────────────┘
        │
        ▼ (if denied)
    [Show Error]
        │
        ▼ (if granted)
┌──────────────────────┐
│ Start Recording      │
│ (Web Audio API)      │
└──────────────────────┘
        │
        ▼
┌──────────────────────┐
│ Show "Listening"     │
│ Indicator            │
└──────────────────────┘
        │
    (User Speaks)
        │
        ▼
┌──────────────────────┐
│ User Stops or        │
│ Auto-Stop Timer      │
└──────────────────────┘
        │
        ▼
┌──────────────────────┐
│ Run Speech           │
│ Recognition API      │
└──────────────────────┘
        │
        ▼
┌──────────────────────┐
│ Get Transcript Text  │
└──────────────────────┘
        │
        ▼
┌──────────────────────┐
│ Insert into Input    │
│ Field                │
└──────────────────────┘
        │
        ▼
┌──────────────────────┐
│ User Reviews &       │
│ Sends Message       │
└──────────────────────┘
```

### 4. Authentication Flow

```
User Visits App
        │
        ▼
┌──────────────────────┐
│ Check localStorage   │
│ for auth token       │
└──────────────────────┘
        │
        ├─ Found ──► Load User ──► Show App
        │
        └─ Not Found ──► Show Login Page
                           │
                           ▼
                    ┌──────────────────┐
                    │ User Enters Email│
                    └──────────────────┘
                           │
                           ▼
                    ┌──────────────────┐
                    │ Validate Email   │
                    │ Format           │
                    └──────────────────┘
                           │
                    ┌──────┴──────┐
                    │ (invalid)   │(valid)
                    ▼             ▼
                  Error      ┌──────────────┐
                             │ Store in     │
                             │ localStorage │
                             └──────────────┘
                                     │
                                     ▼
                              Redirect to App
```

## State Management

```
ChatContext
├── chats: Chat[]
│   └── Chat
│       ├── id: string
│       ├── title: string
│       ├── messages: Message[]
│       │   └── Message
│       │       ├── id: string
│       │       ├── role: 'user' | 'assistant'
│       │       ├── content: string
│       │       ├── timestamp: Date
│       │       └── attachments?: Attachment[]
│       ├── documents?: Attachment[]
│       ├── createdAt: Date
│       └── updatedAt: Date
│
├── currentChat: Chat | null
│
└── Methods
    ├── createChat(title?: string)
    ├── selectChat(chatId: string)
    ├── deleteChat(chatId: string)
    ├── addMessage(message: Message)
    ├── addAttachment(attachment: Attachment)
    └── updateChatTitle(chatId: string, title: string)
```

## API Integration Flow

```
Client Side
    │
    ├─► lib/deepseek.ts (Direct API Call)
    │   │
    │   ▼
    │   DeepSeek API (HTTPS)
    │   │
    │   ▼
    │   Stream Response
    │   │
    │   ▼
    │   Update UI in Real-time
    │
    └─► Optional: app/api/chat/route.ts (Proxy)
        │
        ▼
        Next.js Backend
        │
        ▼
        DeepSeek API (HTTPS)
        │
        ▼
        Stream Response
        │
        ▼
        Send to Client
```

## File Structure

```
project/
├── app/
│   ├── layout.tsx           (Root layout with metadata)
│   ├── page.tsx             (Main chat page)
│   ├── globals.css          (Global styles + theme colors)
│   └── api/
│       └── chat/
│           └── route.ts     (Optional chat API proxy)
│
├── components/
│   ├── login-page.tsx       (Login component)
│   ├── sidebar.tsx          (Chat history sidebar)
│   ├── chat-interface.tsx   (Main chat area)
│   ├── message.tsx          (Message display)
│   ├── file-upload.tsx      (File upload handler)
│   ├── voice-input.tsx      (Voice features)
│   └── ui/                  (shadcn/ui components)
│
├── lib/
│   ├── types.ts             (TypeScript interfaces)
│   ├── chat-context.tsx     (React Context)
│   ├── deepseek.ts          (AI API integration)
│   ├── voice.ts             (Voice utilities)
│   ├── files.ts             (File handling)
│   ├── utils.ts             (Helper functions)
│   └── auth-config.example.ts (NextAuth template)
│
├── public/
│   ├── eih-logo.jpg         (Company logo)
│   └── (other static assets)
│
├── Documentation
│   ├── README.md            (Main overview)
│   ├── SETUP.md             (Setup guide)
│   ├── USER_GUIDE.md        (User documentation)
│   ├── MICROSOFT_AUTH_SETUP.md (OAuth guide)
│   ├── DEPLOYMENT_CHECKLIST.md (Deployment)
│   ├── ARCHITECTURE.md      (This file)
│   └── IMPLEMENTATION_SUMMARY.md (Build summary)
│
└── Configuration Files
    ├── package.json
    ├── tsconfig.json
    ├── tailwind.config.ts
    ├── next.config.mjs
    ├── .env.example
    └── .gitignore
```

## Technology Stack

```
Frontend
├── React 19.2.4
├── Next.js 16.2.0
├── TypeScript 5.7.3
├── Tailwind CSS 4.2.0
└── shadcn/ui components

State Management
├── React Context API
├── localStorage (demo)
└── (ready for: Supabase, Neon, etc.)

APIs
├── DeepSeek API (AI)
├── Web Speech API (Voice)
├── File API (Upload)
└── Web Audio API (Recording)

Authentication
├── Demo (localStorage)
└── NextAuth.js + Azure OAuth (ready)

Deployment
├── Vercel (recommended)
├── Node.js compatible servers
└── Docker (containerized)
```

## Security Architecture

```
User Input
    │
    ▼
┌──────────────────┐
│ Client-side      │
│ Validation       │
└──────────────────┘
    │
    ▼
┌──────────────────┐
│ HTTPS Transport  │
└──────────────────┘
    │
    ▼
┌──────────────────┐
│ Server-side      │
│ Validation       │
└──────────────────┘
    │
    ▼
┌──────────────────┐
│ API Keys from    │
│ Env Variables    │
└──────────────────┘
    │
    ▼
┌──────────────────┐
│ Rate Limiting    │
│ (ready to add)   │
└──────────────────┘
    │
    ▼
┌──────────────────┐
│ Database         │
│ (if added)       │
└──────────────────┘
```

## Performance Optimization

```
Frontend
├── Code Splitting (Next.js)
├── Image Optimization
├── CSS-in-JS
└── Lazy Loading

Backend
├── API Response Streaming
├── Caching (ready to add)
├── Database Optimization (when added)
└── CDN Ready (Vercel)

User Experience
├── Real-time Chat Streaming
├── Optimistic Updates
├── Error Boundaries
└── Loading States
```

---

**For more details, see the individual documentation files listed above.**
