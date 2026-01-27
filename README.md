# Law Chatbot

A React + TypeScript + Vite project with shadcn/ui components and Tailwind CSS.

## Project Structure

This project follows the shadcn/ui structure:
- Components are located in `/src/components/ui/`
- The main component is `chatgpt-prompt-input.tsx` in `/src/components/ui/`
- Demo component is in `/src/components/demo.tsx`

## Why `/components/ui`?

The `/components/ui` directory is the standard location for shadcn/ui components. This structure:
- Keeps UI primitives organized and separate from feature components
- Makes it easy to add more shadcn components in the future
- Follows the shadcn CLI convention for component installation
- Allows for easy component discovery and maintenance

## Setup Instructions

1. Install dependencies:
```bash
npm install
```

2. Install Netlify CLI (required for local development):
```bash
npm install -g netlify-cli
```

3. Create `.env` file:
```bash
# Copy the example file
cp env.example .env

# Or create it manually with the following content:
# See env.example for all required variables
```

4. Start the development server:
```bash
# IMPORTANT: Use Netlify Dev for local development (required for file uploads and chat)
npm run dev:netlify

# This will:
# - Start Vite dev server on http://localhost:8888
# - Start Netlify Functions locally
# - Enable file uploads and chat functionality

# For frontend only (Netlify Functions won't work - file uploads will fail):
npm run dev
```

5. Build for production:
```bash
npm run build
```

## Important Notes

- **File uploads and chat require Netlify Functions** - Use `npm run dev:netlify` for local development
- **Production deployment**: After deploying to Netlify, make sure to set all environment variables in Netlify Dashboard → Site settings → Environment variables
- **ChromaDB**: The project uses ChromaDB Cloud which automatically generates embeddings - no local model files needed
- **No localhost dependencies**: Everything works via APIs (ChromaDB Cloud, OpenRouter API, Netlify Functions)

## Environment Variables

This project uses environment variables for configuration. See `env.example` for all required variables.

**Quick setup:**
1. Copy `env.example` to `.env`
2. Update the values with your actual credentials
3. For Netlify deployment, also set these in Netlify Dashboard → Settings → Environment Variables

**Required Environment Variables:**
- `CHROMADB_API_KEY` - ChromaDB API key
- `CHROMADB_TENANT` - ChromaDB tenant ID
- `CHROMADB_DATABASE` - ChromaDB database name
- `OPENROUTER_API_KEY` - OpenRouter API key
- `OPENROUTER_MODEL` - OpenRouter model name (default: z-ai/glm-4.5-air:free)
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key

## Dependencies

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS 4** - Styling
- **Radix UI** - Accessible component primitives
- **ChromaDB** - Vector database for document storage
- **OpenRouter** - LLM API for chat responses
- **Supabase** - User authentication and management

## Features

- File upload (PDF, DOCX, TXT) to ChromaDB
- Document-based Q&A using OpenRouter API
- User authentication with Supabase
- Admin panel for user and file management
- Arabic language support with RTL text direction

## Usage

The application consists of:
- **Landing Page** - Public homepage
- **Login/Signup** - User authentication
- **Chat Page** - Q&A interface (requires approved account)
- **Admin Page** - User and file management (requires admin account)

## Deployment

1. Build the project: `npm run build`
2. Deploy to Netlify (connects to GitHub automatically)
3. Set environment variables in Netlify Dashboard
4. The site will be available at `https://your-site.netlify.app`
