import { Card } from "@/components/ui/card";
import { ActionButtons } from "./ActionButtons";

interface ParagraphCardProps {
  id: string;
  text: string;
  bookTitle: string;
  bookAuthor: string;
  userId: string;
  userInteractions?: {
    is_liked: boolean;
    is_disliked: boolean;
    is_hearted: boolean;
    is_bookmarked: boolean;
  };
}

export const ParagraphCard = ({ 
  id, 
  text, 
  bookTitle, 
  bookAuthor,
  userId,
  userInteractions
}: ParagraphCardProps) => {
  // Safety check for undefined text
  if (!text) {
    console.error('ParagraphCard received undefined text');
    return null;
  }
  
  // Determine if text is long enough to need scrolling (more than 200 characters)
  const isLongText = text.length > 200;
  
  // Get author initials for avatar
  const authorInitials = bookAuthor
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  
  return (
    <Card className="w-full bg-card shadow-sm hover:shadow-md transition-all duration-300 border border-border overflow-hidden animate-fadeIn">
      {/* Post Header - Social Media Style */}
      <div className="p-4 flex items-start gap-3 border-b border-border bg-card">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-bold text-sm shadow-md">
            {authorInitials}
          </div>
        </div>
        
        {/* Book/Author Info */}
        <div className="flex-1 min-w-0">
          <h2 className="text-sm sm:text-base font-semibold text-foreground truncate">
            {bookTitle}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            by {bookAuthor}
          </p>
        </div>
        
        {/* Optional: More menu icon */}
        <div className="flex-shrink-0">
          <div className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted cursor-pointer transition-colors">
            <svg className="w-5 h-5 text-muted-foreground" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Post Content */}
      <div className="p-4">
        <div 
          className={`text-foreground leading-relaxed text-sm sm:text-base ${
            isLongText ? 'max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent pr-2' : ''
          }`}
        >
          <p className="whitespace-pre-wrap">
            {text}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-4 pb-4 pt-2 border-t border-border bg-card/50">
        <ActionButtons 
          paragraphId={id} 
          paragraphText={text}
          userId={userId}
          initialInteractions={userInteractions}
        />
      </div>
    </Card>
  );
};
