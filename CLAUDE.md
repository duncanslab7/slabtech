# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Architecture Overview

**Slab Voice** is a Next.js 15 application for voice transcription with PII redaction, using AssemblyAI for transcription and Supabase for database/auth/storage.

### Tech Stack
- Next.js 15 (App Router) + TypeScript
- Tailwind CSS
- Supabase (PostgreSQL, Auth, Storage)
- AssemblyAI (transcription + PII redaction)

### Key Data Flow

1. **Customer uploads audio** → File goes to Supabase Storage (`call-recordings` bucket)
2. **API creates signed URL** → Passed to AssemblyAI for processing
3. **AssemblyAI transcribes** → Returns redacted transcript + optional redacted audio
4. **Results stored** → Transcript JSON saved to `transcripts` table, redacted audio to `redacted/` path in storage

### Route Structure

```
src/app/
├── (admin)/                    # Protected admin routes (auth required)
│   ├── admin/page.tsx          # Dashboard - transcript list
│   ├── transcripts/[id]/       # Individual transcript view
│   └── layout.tsx              # Auth check wrapper
├── api/
│   ├── process-audio/          # Main transcription endpoint
│   └── admin/                  # Config management endpoints
├── auth/signout/               # Sign out handler
├── login/page.tsx              # Login page
└── page.tsx                    # Public upload form (home)
```

### Database Tables (Supabase)

- **transcripts** - Stores transcription results with metadata
- **redaction_config** - Single-row table for PII redaction settings (id=1)

### Important Files

- `src/app/api/process-audio/Slab Code.ts` - Core transcription logic, AssemblyAI integration
- `src/utils/supabase/` - Supabase client utilities (client.ts, server.ts, middleware.ts)
- `src/middleware.ts` - Auth session management, excludes `/api/process-audio` from auth
- `supabase-schema.sql` - Database schema with RLS policies

### Path Alias

`@/*` maps to `./src/*` - use `@/utils/supabase/server` style imports.

### Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ASSEMBLYAI_API_KEY`
