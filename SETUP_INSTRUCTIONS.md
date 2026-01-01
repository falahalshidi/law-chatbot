# Setup Instructions

## Project Setup Complete! ✅

The project has been set up with:
- ✅ React + TypeScript + Vite
- ✅ Tailwind CSS 4
- ✅ shadcn/ui structure (`/src/components/ui/`)
- ✅ All required Radix UI dependencies
- ✅ Component integrated at `/src/components/ui/chatgpt-prompt-input.tsx`

## Next Steps

### 1. Install Dependencies

Run the following command to install all required packages:

```bash
npm install
```

This will install:
- React and React DOM
- TypeScript
- Vite
- Tailwind CSS 4
- Radix UI primitives (@radix-ui/react-dialog, @radix-ui/react-popover, @radix-ui/react-tooltip)

### 2. Start Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### 3. Build for Production

```bash
npm run build
```

## Project Structure

```
law chatbot/
├── src/
│   ├── components/
│   │   ├── ui/
│   │   │   └── chatgpt-prompt-input.tsx  ← Your component
│   │   └── demo.tsx                      ← Demo usage
│   ├── App.tsx                           ← Main app component
│   ├── main.tsx                          ← Entry point
│   └── index.css                         ← Tailwind styles
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── postcss.config.js
```

## Why `/components/ui`?

The `/src/components/ui` directory is the standard location for shadcn/ui components. This structure:

1. **Organization**: Keeps UI primitives separate from feature components
2. **Convention**: Follows shadcn CLI standards for easy component management
3. **Scalability**: Makes it easy to add more shadcn components later
4. **Maintainability**: Clear separation between reusable UI and app-specific code

## Component Usage

The `PromptBox` component is ready to use:

```tsx
import { PromptBox } from "@/components/ui/chatgpt-prompt-input";

function MyComponent() {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Handle form submission
  };

  return (
    <form onSubmit={handleSubmit}>
      <PromptBox name="message" />
    </form>
  );
}
```

## Features Included

- ✅ Auto-resizing textarea
- ✅ Image attachment with preview
- ✅ Tool selection dropdown
- ✅ Voice recording button
- ✅ Send button with validation
- ✅ Dark mode support
- ✅ Responsive design
- ✅ Accessible (Radix UI primitives)

## Tailwind Configuration

The project uses Tailwind CSS 4 with:
- Custom CSS variables for theming
- Dark mode support
- Custom scrollbar styles
- Responsive utilities

## TypeScript Configuration

- Path aliases configured (`@/*` → `./src/*`)
- Strict mode enabled
- React JSX support

## Notes

- The component is self-contained and includes all necessary Radix UI primitives
- All icons are inline SVG components (no external dependencies)
- Dark mode is handled via Tailwind's `dark:` prefix
- The component accepts standard textarea props via spread operator

