import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Heart, ThumbsUp, ThumbsDown, Bookmark, Copy } from "lucide-react";
import { toast } from "sonner";
import { createOrUpdateEvent, getUserParagraphInteraction } from "@/lib/eventsApi";

interface ActionButtonsProps {
  paragraphId: string;
  paragraphText: string;
  userId: string;
  initialInteractions?: {
    is_liked: boolean;
    is_disliked: boolean;
    is_hearted: boolean;
    is_bookmarked: boolean;
  };
}

export const ActionButtons = ({ 
  paragraphId, 
  paragraphText,
  userId,
  initialInteractions
}: ActionButtonsProps) => {
  const [isLiked, setIsLiked] = useState(initialInteractions?.is_liked || false);
  const [isDisliked, setIsDisliked] = useState(initialInteractions?.is_disliked || false);
  const [isHearted, setIsHearted] = useState(initialInteractions?.is_hearted || false);
  const [isBookmarked, setIsBookmarked] = useState(initialInteractions?.is_bookmarked || false);
  const [loading, setLoading] = useState(false);

  // Load existing interactions when component mounts (only if not provided initially)
  useEffect(() => {
    if (initialInteractions) {
      // Already have interactions from Django, no need to fetch
      console.log('Using initial interactions from Django:', initialInteractions);
      return;
    }
    
    const loadInteractions = async () => {
      try {
        console.log('ActionButtons loading interactions for:', { userId, paragraphId });
        const data = await getUserParagraphInteraction(userId, paragraphId);
        console.log('ActionButtons received data:', data);
        setIsLiked(data.is_liked);
        setIsDisliked(data.is_disliked);
        setIsHearted(data.is_hearted);
        setIsBookmarked(data.is_bookmarked);
        console.log('ActionButtons state updated:', {
          isLiked: data.is_liked,
          isDisliked: data.is_disliked,
          isHearted: data.is_hearted,
          isBookmarked: data.is_bookmarked
        });
      } catch (error) {
        // Silently fail - user can still interact with the paragraph
        console.error('ActionButtons error loading interactions:', error);
      }
    };

    loadInteractions();
  }, [userId, paragraphId, initialInteractions]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(paragraphText);
      toast.success("Paragraph copied to clipboard");
    } catch (error) {
      toast.error("Failed to copy paragraph");
    }
  };

  const handleLike = async () => {
    if (loading) return;
    
    const newLikedState = !isLiked;
    setLoading(true);
    
    try {
      await createOrUpdateEvent({
        user_id: userId,
        paragraph_id: paragraphId,
        is_liked: newLikedState,
        is_disliked: false // Clear dislike when liking
      });
      
      setIsLiked(newLikedState);
      setIsDisliked(false);
      toast.success(newLikedState ? "Liked!" : "Like removed");
    } catch (error) {
      console.error('Error updating like:', error);
      toast.error("Failed to update like");
    } finally {
      setLoading(false);
    }
  };

  const handleDislike = async () => {
    if (loading) return;
    
    const newDislikedState = !isDisliked;
    setLoading(true);
    
    try {
      await createOrUpdateEvent({
        user_id: userId,
        paragraph_id: paragraphId,
        is_disliked: newDislikedState,
        is_liked: false // Clear like when disliking
      });
      
      setIsDisliked(newDislikedState);
      setIsLiked(false);
      toast.success(newDislikedState ? "Disliked!" : "Dislike removed");
    } catch (error) {
      console.error('Error updating dislike:', error);
      toast.error("Failed to update dislike");
    } finally {
      setLoading(false);
    }
  };

  const handleHeart = async () => {
    if (loading) return;
    
    const newHeartedState = !isHearted;
    setLoading(true);
    
    try {
      await createOrUpdateEvent({
        user_id: userId,
        paragraph_id: paragraphId,
        is_hearted: newHeartedState
      });
      
      setIsHearted(newHeartedState);
      toast.success(newHeartedState ? "Hearted!" : "Heart removed");
    } catch (error) {
      console.error('Error updating heart:', error);
      toast.error("Failed to update heart");
    } finally {
      setLoading(false);
    }
  };

  const handleBookmark = async () => {
    if (loading) return;
    
    const newBookmarkedState = !isBookmarked;
    setLoading(true);
    
    try {
      await createOrUpdateEvent({
        user_id: userId,
        paragraph_id: paragraphId,
        is_bookmarked: newBookmarkedState
      });
      
      setIsBookmarked(newBookmarkedState);
      toast.success(newBookmarkedState ? "Bookmarked!" : "Bookmark removed");
    } catch (error) {
      console.error('Error updating bookmark:', error);
      toast.error("Failed to update bookmark");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-around gap-2 w-full">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleHeart}
        disabled={loading}
        className={`flex-1 gap-2 px-3 py-2 h-9 rounded-full hover:bg-red-50 dark:hover:bg-red-950/30 transition-all group ${
          isHearted ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/50 dark:text-red-400' : 'text-muted-foreground hover:text-red-600'
        }`}
      >
        <Heart className={`h-4 w-4 transition-transform group-hover:scale-110 ${isHearted ? 'fill-current' : ''}`} />
        <span className="text-xs font-medium">Heart</span>
      </Button>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={handleLike}
        disabled={loading}
        className={`flex-1 gap-2 px-3 py-2 h-9 rounded-full hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all group ${
          isLiked ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-400' : 'text-muted-foreground hover:text-blue-600'
        }`}
      >
        <ThumbsUp className={`h-4 w-4 transition-transform group-hover:scale-110 ${isLiked ? 'fill-current' : ''}`} />
        <span className="text-xs font-medium">Like</span>
      </Button>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDislike}
        disabled={loading}
        className={`flex-1 gap-2 px-3 py-2 h-9 rounded-full hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-all group ${
          isDisliked ? 'bg-orange-50 text-orange-600 hover:bg-orange-100 dark:bg-orange-950/50 dark:text-orange-400' : 'text-muted-foreground hover:text-orange-600'
        }`}
      >
        <ThumbsDown className={`h-4 w-4 transition-transform group-hover:scale-110 ${isDisliked ? 'fill-current' : ''}`} />
        <span className="text-xs font-medium">Dislike</span>
      </Button>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={handleBookmark}
        disabled={loading}
        className={`flex-1 gap-2 px-3 py-2 h-9 rounded-full hover:bg-green-50 dark:hover:bg-green-950/30 transition-all group ${
          isBookmarked ? 'bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-950/50 dark:text-green-400' : 'text-muted-foreground hover:text-green-600'
        }`}
      >
        <Bookmark className={`h-4 w-4 transition-transform group-hover:scale-110 ${isBookmarked ? 'fill-current' : ''}`} />
        <span className="text-xs font-medium">Save</span>
      </Button>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        className="flex-1 gap-2 px-3 py-2 h-9 rounded-full hover:bg-muted transition-all group text-muted-foreground hover:text-foreground"
      >
        <Copy className="h-4 w-4 transition-transform group-hover:scale-110" />
        <span className="text-xs font-medium">Copy</span>
      </Button>
    </div>
  );
};
