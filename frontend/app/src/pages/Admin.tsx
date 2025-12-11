import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Upload, BookOpen, Sparkles, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { getAllBooks, type BookResponse } from "@/lib/eventsApi";

const API = import.meta.env.VITE_BACKEND_URL;

interface BookMetadata {
  title: string;
  author: string;
  releaseDate: string;
  language: string;
  sourceUrl: string;
}

interface FetchedBook {
  url: string;
  metadata: BookMetadata | null;
  bookText: string | null;
  exists: boolean;
  existingBook: BookResponse | null;
  error: string | null;
  status: 'pending' | 'fetching' | 'success' | 'error' | 'exists';
}

const extractBookMetadata = (bookText: string, sourceUrl: string): BookMetadata | null => {
  try {
    const metadataEndMarker = bookText.indexOf("*** START OF");
    if (metadataEndMarker === -1) {
      console.error("Could not find metadata section");
      return null;
    }

    const metadataSection = bookText.substring(0, metadataEndMarker);

    const titleMatch = metadataSection.match(/Title:\s*([^\n]+(?:\n\s+[^\n]+)*?)(?=\n\s*\n|\nAuthor:)/i);
    const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : "Unknown Title";

    const authorMatch = metadataSection.match(/Author:\s*([^\n]+(?:\n\s+[^\n]+)*?)(?=\n\s*\n|\nRelease date:)/i);
    const author = authorMatch ? authorMatch[1].replace(/\s+/g, ' ').trim() : "Unknown Author";

    const releaseDateMatch = metadataSection.match(/Release date:\s*([^\[]+?)(?:\s*\[|$)/i);
    const releaseDate = releaseDateMatch ? releaseDateMatch[1].trim() : "Unknown Date";

    const languageMatch = metadataSection.match(/Language:\s*([^\n]+)/i);
    const language = languageMatch ? languageMatch[1].trim() : "Unknown Language";

    return {
      title,
      author,
      releaseDate,
      language,
      sourceUrl
    };
  } catch (error) {
    console.error("Error extracting metadata:", error);
    return null;
  }
};

const chunkBookText = (text: string, chunkSize: number = 200000): string[] => {
  const chunks: string[] = [];
  let currentIndex = 0;

  while (currentIndex < text.length) {
    const chunk = text.substring(currentIndex, currentIndex + chunkSize);
    chunks.push(chunk);
    currentIndex += chunkSize;
  }

  console.log(`Book split into ${chunks.length} chunks of ~${chunkSize / 1000}KB each`);
  return chunks;
};

const Admin = () => {
  const [multiUrlInput, setMultiUrlInput] = useState("");
  const [fetchedBooks, setFetchedBooks] = useState<FetchedBook[]>([]);
  const [isFetchingMultiple, setIsFetchingMultiple] = useState(false);
  const [isProcessingMultiple, setIsProcessingMultiple] = useState(false);
  const [processedBooksCount, setProcessedBooksCount] = useState(0);
  const [existingBooks, setExistingBooks] = useState<BookResponse[]>([]);

  useEffect(() => {
    const loadBooks = async () => {
      try {
        const books = await getAllBooks();
        setExistingBooks(books);
        console.log(`Loaded ${books.length} existing books from database`);
      } catch (error) {
        console.error('Error loading books:', error);
      }
    };
    loadBooks();
  }, []);

  const convertToTextUrl = (url: string): string | null => {
    const directTextMatch = url.match(/\/cache\/epub\/(\d+)\/pg\d+\.txt$/);
    if (directTextMatch) {
      return url;
    }

    const ebookMatch = url.match(/\/ebooks\/(\d+)/);
    if (ebookMatch) {
      const ebookNumber = ebookMatch[1];
      return `https://www.gutenberg.org/cache/epub/${ebookNumber}/pg${ebookNumber}.txt`;
    }

    return null;
  };

  const handleMultiUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!multiUrlInput.trim()) {
      toast.error("Please enter at least one URL");
      return;
    }

    const urls = multiUrlInput
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.length > 0);

    if (urls.length === 0) {
      toast.error("Please enter at least one valid URL");
      return;
    }

    // Validate all URLs
    for (const url of urls) {
      if (!url.startsWith("https://www.gutenberg.org/")) {
        toast.error(`Invalid URL: ${url}. All URLs must be from Project Gutenberg.`);
        return;
      }
    }

    setIsFetchingMultiple(true);
    const tempFetchedBooks: FetchedBook[] = [];

    // Initialize fetched books array
    const initialBooks: FetchedBook[] = urls.map(url => ({
      url,
      metadata: null,
      bookText: null,
      exists: false,
      existingBook: null,
      error: null,
      status: 'pending'
    }));

    setFetchedBooks(initialBooks);

    // Fetch books sequentially
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];

      // Update status to fetching
      tempFetchedBooks[i] = { ...initialBooks[i], status: 'fetching' };
      setFetchedBooks([...tempFetchedBooks]);

      try {
        const textUrl = convertToTextUrl(url);

        if (!textUrl) {
          throw new Error("Invalid URL format");
        }

        const fetchUrl = `${API}/proxy/gutenberg/?url=${encodeURIComponent(textUrl)}`;

        const response = await fetch(fetchUrl, {
          method: 'GET',
          headers: {
            'Accept': 'text/plain',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch: ${response.status}`);
        }

        const bookText = await response.text();

        if (!bookText || bookText.length < 100) {
          throw new Error("Invalid or empty book content");
        }

        const metadata = extractBookMetadata(bookText, textUrl);

        if (!metadata) {
          throw new Error("Could not extract metadata");
        }

        // Check if book already exists
        const existingMatch = existingBooks.find(
          book => book.source === textUrl ||
                 (book.title.toLowerCase() === metadata.title.toLowerCase() &&
                  book.author.toLowerCase() === metadata.author.toLowerCase())
        );

        tempFetchedBooks[i] = {
          ...tempFetchedBooks[i],
          metadata,
          bookText,
          exists: !!existingMatch,
          existingBook: existingMatch || null,
          status: existingMatch ? 'exists' : 'success'
        };

      } catch (error) {
        tempFetchedBooks[i] = {
          ...tempFetchedBooks[i],
          error: error instanceof Error ? error.message : "Failed to fetch",
          status: 'error'
        };
      }

      setFetchedBooks([...tempFetchedBooks]);
    }

    setIsFetchingMultiple(false);
    toast.success(`Fetched ${urls.length} URLs. Ready to process new books.`);
  };

  const processAllNewBooks = async () => {
    const newBooks = fetchedBooks.filter(book => book.status === 'success' && !book.exists);

    if (newBooks.length === 0) {
      toast.error("No new books to process");
      return;
    }

    setIsProcessingMultiple(true);
    setProcessedBooksCount(0);

    for (let i = 0; i < newBooks.length; i++) {
      const book = newBooks[i];

      if (!book.bookText || !book.metadata) continue;

      try {
        toast.info(`Processing book ${i + 1}/${newBooks.length}: ${book.metadata.title}`);

        // Same processing logic as single book
        const startMarker = "*** START OF THE PROJECT GUTENBERG EBOOK";
        const endMarker = "*** END OF THE PROJECT GUTENBERG EBOOK";

        let cleanedText = book.bookText;
        const startIndex = book.bookText.indexOf(startMarker);
        const endIndex = book.bookText.indexOf(endMarker);

        if (startIndex !== -1 && endIndex !== -1) {
          cleanedText = book.bookText.substring(startIndex, endIndex);
          cleanedText = cleanedText.substring(cleanedText.indexOf('\n') + 1);
        }

        const chunks = chunkBookText(cleanedText, 200000);
        const totalChunks = chunks.length;

        let allParagraphs: string[] = [];

        for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
          const chunk = chunks[chunkIndex];

          console.log(`Sending chunk ${chunkIndex + 1}/${totalChunks} to backend for processing...`);

          // Create AbortController for timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout

          try {
            const response = await fetch(`${API}/api/process-book/`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                bookText: chunk,
                chunkIndex: chunkIndex + 1,
                totalChunks: totalChunks,
                metadata: {
                  title: book.metadata.title,
                  author: book.metadata.author,
                },
              }),
              signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || `Failed to process chunk ${chunkIndex + 1}`);
            }

            const result = await response.json();
            console.log(`Chunk ${chunkIndex + 1} processed: ${result.paragraphs?.length || 0} paragraphs extracted`);
            allParagraphs = allParagraphs.concat(result.paragraphs);
          } catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
              throw new Error(`Chunk ${chunkIndex + 1} timed out after 5 minutes. The book might be too large or the AI service is slow.`);
            }
            throw error;
          }
        }

        // Save book to database
        let publishedDate = "2024-01-01";
        try {
          const dateStr = book.metadata.releaseDate;
          const dateMatch = dateStr.match(/(\w+)\s+(\d+),\s+(\d{4})/);
          if (dateMatch) {
            const [, month, day, year] = dateMatch;
            const monthMap: { [key: string]: string } = {
              'January': '01', 'February': '02', 'March': '03', 'April': '04',
              'May': '05', 'June': '06', 'July': '07', 'August': '08',
              'September': '09', 'October': '10', 'November': '11', 'December': '12'
            };
            const monthNum = monthMap[month] || '01';
            publishedDate = `${year}-${monthNum}-${day.padStart(2, '0')}`;
          }
        } catch (error) {
          console.warn("Could not parse date, using default:", error);
        }

        const bookResponse = await fetch(`${API}/books/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: book.metadata.title,
            author: book.metadata.author,
            published_date: publishedDate,
            language: book.metadata.language,
            source: book.metadata.sourceUrl
          })
        });

        if (!bookResponse.ok) {
          const errorText = await bookResponse.text();
          throw new Error(`Failed to save book: ${errorText}`);
        }

        const bookResponseData = await bookResponse.json();
        const bookId = bookResponseData.id;

        // Save paragraphs in batches
        const batchSize = 10;
        for (let j = 0; j < allParagraphs.length; j += batchSize) {
          const batch = allParagraphs.slice(j, j + batchSize);

          await Promise.all(
            batch.map(async (paragraph: string) => {
              await fetch(`${API}/paragraphs/`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  book_id: bookId,
                  content: paragraph
                })
              });
            })
          );
        }

        setProcessedBooksCount(i + 1);
        toast.success(`Processed: ${book.metadata.title} (${allParagraphs.length} paragraphs)`);

      } catch (error) {
        console.error(`Error processing book ${book.metadata?.title}:`, error);
        toast.error(`Failed to process: ${book.metadata?.title}`);
      }
    }

    setIsProcessingMultiple(false);

    // Reload books list
    try {
      const updatedBooks = await getAllBooks();
      setExistingBooks(updatedBooks);
    } catch (error) {
      console.error('Error reloading books:', error);
    }

    toast.success(`Successfully processed ${processedBooksCount} books!`);
    setFetchedBooks([]);
    setMultiUrlInput("");
  };

  return (
    <div className="min-h-screen bg-[var(--gradient-warm)]">
      <header className="py-8 text-center">
        <h1 className="text-5xl font-bold text-foreground mb-2">
          Admin Panel
        </h1>
        <p className="text-muted-foreground text-lg">
          Upload books to the database
        </p>
      </header>

      <div className="container mx-auto px-4 pb-16 max-w-2xl">
        {/* Multi-URL Upload Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-6 w-6" />
              Upload Books
            </CardTitle>
            <CardDescription>
              Enter one or more Project Gutenberg URLs (one per line) to process books
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleMultiUrlSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="multiBookUrls">Book URLs (one per line)</Label>
                <Textarea
                  id="multiBookUrls"
                  placeholder="https://www.gutenberg.org/ebooks/77429&#10;https://www.gutenberg.org/ebooks/84&#10;https://www.gutenberg.org/cache/epub/1342/pg1342.txt"
                  value={multiUrlInput}
                  onChange={(e) => setMultiUrlInput(e.target.value)}
                  disabled={isFetchingMultiple}
                  className="w-full min-h-[120px] font-mono text-sm"
                />
                <p className="text-sm text-muted-foreground">
                  Paste Gutenberg URLs, one per line. You can add a single URL or multiple URLs.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isFetchingMultiple}
              >
                {isFetchingMultiple ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Fetching Books...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Fetch Books
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Fetched Books List */}
        {fetchedBooks.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Fetched Books ({fetchedBooks.length})</CardTitle>
              <CardDescription>
                Review the books below. Books that already exist are marked and will be skipped.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {fetchedBooks.map((book, index) => (
                <div
                  key={index}
                  className={`p-4 border rounded-lg ${
                    book.status === 'exists' ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/20' :
                    book.status === 'success' ? 'border-green-400 bg-green-50 dark:bg-green-950/20' :
                    book.status === 'error' ? 'border-red-400 bg-red-50 dark:bg-red-950/20' :
                    book.status === 'fetching' ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/20' :
                    'border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {book.metadata ? (
                        <>
                          <h3 className="font-semibold text-sm truncate">{book.metadata.title}</h3>
                          <p className="text-xs text-muted-foreground">by {book.metadata.author}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {book.metadata.language} | {book.metadata.releaseDate}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground truncate">{book.url}</p>
                      )}
                      {book.error && (
                        <p className="text-xs text-red-600 mt-2 dark:text-red-400">{book.error}</p>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      {book.status === 'fetching' && <Loader2 className="h-5 w-5 animate-spin text-blue-600" />}
                      {book.status === 'success' && <CheckCircle className="h-5 w-5 text-green-600" />}
                      {book.status === 'exists' && <AlertCircle className="h-5 w-5 text-orange-600" />}
                      {book.status === 'error' && <XCircle className="h-5 w-5 text-red-600" />}
                    </div>
                  </div>
                  {book.status === 'exists' && (
                    <p className="text-xs text-orange-600 mt-2 dark:text-orange-400">
                      Already exists in database - will be skipped
                    </p>
                  )}
                </div>
              ))}

              {fetchedBooks.filter(b => b.status === 'success' && !b.exists).length > 0 && (
                <div className="pt-4">
                  <Button
                    onClick={processAllNewBooks}
                    disabled={isProcessingMultiple}
                    className="w-full"
                  >
                    {isProcessingMultiple ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing {processedBooksCount}/{fetchedBooks.filter(b => b.status === 'success' && !b.exists).length} Books...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Process All New Books ({fetchedBooks.filter(b => b.status === 'success' && !b.exists).length})
                      </>
                    )}
                  </Button>
                </div>
              )}

              {fetchedBooks.filter(b => b.status === 'success' && !b.exists).length === 0 && !isFetchingMultiple && (
                <p className="text-sm text-center text-muted-foreground py-4">
                  No new books to process. All fetched books already exist in the database.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <div className="mt-6 text-center">
          <a
            href="/"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  );
};

export default Admin;
