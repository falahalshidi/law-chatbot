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

2. Start the development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

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

