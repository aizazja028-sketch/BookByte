import { useState, useEffect, useRef, useCallback } from "react";
import { ParagraphCard } from "@/components/ParagraphCard";
import { IdentifierManager } from "@/components/IdentifierManager";
import { getUserId } from "@/lib/userIdentifier";
import { getRandomParagraph, createUser } from "@/lib/eventsApi";
import { toast } from "sonner";
import { Loader2, Bookmark } from "lucide-react";
import { Link } from "react-router-dom";

interface Paragraph {
  id: string;
  text: string;
  book: {
    title: string;
    author: string;
  };
  user_interactions?: {
    is_liked: boolean;
    is_disliked: boolean;
    is_hearted: boolean;
    is_bookmarked: boolean;
  };
}

const Index = () => {
  const [paragraphs, setParagraphs] = useState<Paragraph[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [userCreated, setUserCreated] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);
  const userId = getUserId();

  // Create user in Django backend on mount
  useEffect(() => {
    const initUser = async () => {
      await createUser(userId);
      setUserCreated(true);
    };
    initUser();
  }, [userId]);

  const loadParagraph = async () => {
    if (loading || !userCreated) return;
    
    setLoading(true);
    try {
      const data = await getRandomParagraph(userId);
      
      if (data) {
        setParagraphs(prev => [...prev, data]);
      }
    } catch (error) {
      console.error('Error loading paragraph:', error);
      if (error instanceof Error && error.message.includes('No paragraphs available')) {
        toast.error('No books available yet. Please add some books to get started!');
        setHasMore(false);
      } else {
        toast.error('Failed to load paragraph. Make sure Django backend is running.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const target = entries[0];
    if (target.isIntersecting && hasMore && !loading && userCreated) {
      loadParagraph();
    }
  }, [hasMore, loading, userCreated]);

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: '200px',
      threshold: 0.1
    });

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [handleObserver]);

  // Load initial paragraphs
  useEffect(() => {
    loadParagraph();
    loadParagraph();
    loadParagraph();
  }, []);

  return (
    <div className="min-h-screen bg-background relative">
      {/* Sticky Header - Social Media Style */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border shadow-sm">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-primary to-accent rounded-xl p-2 shadow-md">
                <svg className="h-6 w-6 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                  BookByte
                </h1>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  Discover literature
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/bookmarked"
                className="p-2 hover:bg-muted rounded-lg transition-colors"
                title="View bookmarks"
              >
                <Bookmark className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
              </Link>
              <IdentifierManager />
            </div>
          </div>
        </div>
      </header>

      {/* Feed - Social Media Layout */}
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        <div className="space-y-4">
          {paragraphs.map((paragraph, index) => (
            <ParagraphCard
              key={`${paragraph.id}-${index}`}
              id={paragraph.id}
              text={paragraph.text}
              bookTitle={paragraph.book.title}
              bookAuthor={paragraph.book.author}
              userId={userId}
              userInteractions={paragraph.user_interactions}
            />
          ))}
        </div>
        
        {/* Infinite scroll trigger */}
        <div ref={observerTarget} className="flex justify-center py-8">
            {loading && hasMore && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>Loading more paragraphs...</span>
              </div>
            )}
            {!hasMore && paragraphs.length > 0 && (
              <p className="text-muted-foreground">No more books available</p>
            )}
            {!hasMore && paragraphs.length === 0 && (
              <div className="text-center">
                <p className="text-foreground text-lg mb-4">Welcome to BookByte!</p>
                <p className="text-muted-foreground">
                  To get started, you'll need to add some books to the database.
                </p>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Index;
