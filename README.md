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

2. Create `.env` file:
```bash
# Copy the example file
cp env.example .env

# Or create it manually with the following content:
# See ENV_SETUP.md for detailed instructions
```

3. Start the development server:
```bash
# For local development with Netlify Functions
netlify dev

# Or for frontend only
npm run dev
```

4. Build for production:
```bash
npm run build
```

## Environment Variables

This project uses environment variables for configuration. See `ENV_SETUP.md` for detailed instructions.

**Quick setup:**
1. Copy `env.example` to `.env`
2. Update the values with your actual credentials
3. For Netlify deployment, also set these in Netlify Dashboard → Settings → Environment Variables

## Dependencies

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS 4** - Styling
- **Radix UI** - Accessible component primitives:
  - `@radix-ui/react-dialog`
  - `@radix-ui/react-popover`
  - `@radix-ui/react-tooltip`

## Features

The `PromptBox` component includes:
- Text input with auto-resizing
- Image attachment with preview
- Tool selection (Image, Search, Write, Deep Search, Think)
- Voice recording button
- Send button with validation
- Dark mode support
- Responsive design

## Usage

```tsx
import { PromptBox } from "@/components/ui/chatgpt-prompt-input";

function MyComponent() {
  return (
    <form onSubmit={handleSubmit}>
      <PromptBox name="message" />
    </form>
  );
}
```

