-- Create books table
CREATE TABLE public.books (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  language TEXT DEFAULT 'en',
  source TEXT,
  format TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create paragraphs table
CREATE TABLE public.paragraphs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_identifiers table for anonymous users
CREATE TABLE public.user_identifiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create events table for tracking user actions
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_identifier_id UUID NOT NULL REFERENCES public.user_identifiers(id) ON DELETE CASCADE,
  paragraph_id UUID NOT NULL REFERENCES public.paragraphs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('heart', 'like', 'dislike', 'bookmark', 'copy')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paragraphs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_identifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Public read access for books and paragraphs (since it's anonymous)
CREATE POLICY "Anyone can view books"
  ON public.books FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view paragraphs"
  ON public.paragraphs FOR SELECT
  USING (true);

-- Users can create their own identifier
CREATE POLICY "Anyone can create user identifiers"
  ON public.user_identifiers FOR INSERT
  WITH CHECK (true);

-- Users can view their own identifier
CREATE POLICY "Anyone can view user identifiers"
  ON public.user_identifiers FOR SELECT
  USING (true);

-- Anyone can create events
CREATE POLICY "Anyone can create events"
  ON public.events FOR INSERT
  WITH CHECK (true);

-- Users can view all events (for analytics purposes)
CREATE POLICY "Anyone can view events"
  ON public.events FOR SELECT
  USING (true);

-- Create indexes for better performance
CREATE INDEX idx_paragraphs_book_id ON public.paragraphs(book_id);
CREATE INDEX idx_events_user_identifier ON public.events(user_identifier_id);
CREATE INDEX idx_events_paragraph ON public.events(paragraph_id);
CREATE INDEX idx_events_type ON public.events(event_type);
