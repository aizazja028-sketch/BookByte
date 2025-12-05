import { useState, useEffect } from "react";
import { ParagraphCard } from "@/components/ParagraphCard";
import { IdentifierManager } from "@/components/IdentifierManager";
import { getUserId } from "@/lib/userIdentifier";
import { getBookmarkedParagraphs } from "@/lib/eventsApi";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Bookmark, ChevronLeft, ChevronRight } from "lucide-react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";

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

interface PaginationInfo {
  current_page: number;
  total_pages: number;
  total_count: number;
  page_size: number;
  has_next: boolean;
  has_previous: boolean;
}

const Bookmarked = () => {
  const [paragraphs, setParagraphs] = useState<Paragraph[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const userId = getUserId();

  // Get page from URL, default to 1
  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  useEffect(() => {
    const loadBookmarkedParagraphs = async () => {
      try {
        setLoading(true);
        const data = await getBookmarkedParagraphs(userId, currentPage);
        setParagraphs(data.results);
        setPagination(data.pagination);
      } catch (error) {
        console.error('Error loading bookmarked paragraphs:', error);
        toast.error('Failed to load bookmarked paragraphs');
      } finally {
        setLoading(false);
      }
    };

    loadBookmarkedParagraphs();
  }, [userId, currentPage]);

  const handlePageChange = (newPage: number) => {
    navigate(`/bookmarked?page=${newPage}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background relative">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border shadow-sm">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Link
                to="/"
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-muted-foreground" />
              </Link>
              <div className="bg-gradient-to-br from-primary to-accent rounded-xl p-2 shadow-md">
                <Bookmark className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                  Bookmarked
                </h1>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  Your saved paragraphs
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <IdentifierManager />
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 py-6 max-w-3xl pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Loading bookmarked paragraphs...</span>
            </div>
          </div>
        ) : paragraphs.length === 0 ? (
          <div className="text-center py-12">
            <Bookmark className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              No bookmarks yet
            </h2>
            <p className="text-muted-foreground mb-6">
              Start bookmarking paragraphs to save them for later
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to feed
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {paragraphs.map((paragraph) => (
                <ParagraphCard
                  key={paragraph.id}
                  id={paragraph.id}
                  text={paragraph.text}
                  bookTitle={paragraph.book.title}
                  bookAuthor={paragraph.book.author}
                  userId={userId}
                  userInteractions={paragraph.user_interactions}
                />
              ))}
            </div>

            {/* Pagination info */}
            {pagination && pagination.total_pages > 0 && (
              <div className="text-center py-6 text-sm text-muted-foreground">
                Page {pagination.current_page} of {pagination.total_pages}
                ({pagination.total_count} total bookmarks)
              </div>
            )}
          </>
        )}
      </div>

      {/* Sticky Navigation Buttons */}
      {pagination && pagination.total_pages > 1 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-lg border-t border-border shadow-lg">
          <div className="container mx-auto px-4 py-3 max-w-3xl">
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={!pagination.has_previous}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Previous</span>
              </button>

              <div className="text-sm font-medium text-foreground">
                Page {pagination.current_page} of {pagination.total_pages}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={!pagination.has_next}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Bookmarked;
