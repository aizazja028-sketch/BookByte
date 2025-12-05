# BookByte Code

A social media-style reading app that serves random paragraphs from books in an infinite scroll feed. Users can interact with paragraphs through likes, hearts, bookmarks, and dislikes.

## Project Structure

This project consists of two main parts:

- **`backend/`** - Django REST API server
- **`frontend/`** - React + TypeScript frontend application

## Getting Started

Each directory contains its own README with detailed setup instructions:

- **Backend Setup:** See [`backend/README.md`](backend/README.md) for instructions on setting up the Django server with virtual environment and running migrations.

- **Frontend Setup:** See [`frontend/README.md`](frontend/README.md) for instructions on installing dependencies and running the React development server.

## Running the Full Application

1. **Start the Backend** (in one terminal):
   ```bash
   cd backend
   # Follow instructions in backend/README.md
   ```

2. **Start the Frontend** (in another terminal):
   ```bash
   cd frontend/app
   # Follow instructions in frontend/README.md
   ```

The backend will run on `http://127.0.0.1:8000` and the frontend on `http://localhost:5173`.

## Tech Stack

- **Backend:** Django, Django REST Framework, SQLite
- **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui
