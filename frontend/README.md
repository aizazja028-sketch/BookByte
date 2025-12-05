# BookByte Stream

A social media-style reading app that serves random paragraphs from books in an infinite scroll feed. Users can interact with paragraphs through likes, hearts, bookmarks, and dislikes.

## Quick Start

```sh
# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will run on `http://localhost:5173` (or the next available port).

**Note:** This frontend requires a Django backend running on `http://127.0.0.1:8000`. Make sure the backend is running before using the app.

## Important Files

### Core Pages
- **`src/pages/Index.tsx`** - Main feed page with infinite scroll that displays random paragraphs from books
- **`src/pages/Admin.tsx`** - Admin interface for fetching books from Project Gutenberg and processing them with OpenAI

### Key Libraries
- **`src/lib/eventsApi.ts`** - API client for all Django backend interactions (users, paragraphs, events/interactions)
- **`src/lib/userIdentifier.ts`** - Manages user ID generation and storage in localStorage using UUID

### Main Components
- **`src/components/ParagraphCard.tsx`** - Displays a single paragraph with book info and action buttons
- **`src/components/ActionButtons.tsx`** - Like, dislike, heart, bookmark, and copy buttons with state management
- **`src/components/IdentifierManager.tsx`** - UI for importing/exporting user IDs

## Tech Stack

- **Vite** - Build tool and dev server
- **React + TypeScript** - UI framework
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components
- **Django Backend** - Required for data storage (not included in this repo)

## Environment Variables

Create a `.env` file for the Admin page to work:

```
VITE_OPENAI_API_KEY=your_openai_api_key_here
```

This is only needed if you want to use the Admin page to process books.
