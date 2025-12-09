import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Upload, BookOpen, Sparkles } from "lucide-react";
import OpenAI from "openai";
import { getAllBooks, type BookResponse } from "@/lib/eventsApi";

const API = import.meta.env.VITE_BACKEND_URL;

interface BookMetadata {
  title: string;
  author: string;
  releaseDate: string;
  language: string;
  sourceUrl: string;
}

interface ProcessedBook {
  metadata: BookMetadata;
  paragraphs: string[];
  processedAt: string;
}

// Helper function to split text into chunks
const splitTextIntoChunks = (text: string, chunkSize: number = 200000): string[] => {
  const chunks: string[] = [];
  let currentIndex = 0;

  while (currentIndex < text.length) {
    const chunk = text.substring(currentIndex, currentIndex + chunkSize);
    chunks.push(chunk);
    currentIndex += chunkSize;
  }

  return chunks;
};

// Function to clean text by removing unnecessary headers and footers
const cleanText = (text: string) => {
  const startMarker = "*** START OF THE PROJECT GUTENBERG EBOOK";
  const endMarker = "*** END OF THE PROJECT GUTENBERG EBOOK";
  
  const startIndex = text.indexOf(startMarker);
  const endIndex = text.indexOf(endMarker);
  
  if (startIndex !== -1 && endIndex !== -1) {
    return text.substring(startIndex, endIndex).substring(text.indexOf('\n') + 1);
  }

  return text;
};

// Helper function to create OpenAI prompt
const createProcessingPrompt = (chunk: string, chunkIndex: number, totalChunks: number) => {
  return `
  You are a text processing assistant. Analyze the following book text and extract all paragraphs.
  CRITICAL REQUIREMENTS - FOLLOW EXACTLY:
  1. Each paragraph MUST be between 3-7 sentences (NO MORE, NO LESS).
  2. Each paragraph must be in separate quotes with commas between them.
  3. Never modify the text. Return the paragraphs as they are.
  4. Skip empty lines, page numbers, headers, footers, chapter titles.
  5. Return ONLY a JSON array containing the paragraphs, no extra text.
  Book text (Chunk ${chunkIndex + 1}/${totalChunks}):
  ${chunk}
  `;
};

// Function to extract metadata from book text
const extractBookMetadata = (bookText: string, sourceUrl: string): BookMetadata | null => {
  try {
    const metadataEndMarker = bookText.indexOf("*** START OF");
    if (metadataEndMarker !== -1) {
      bookText = bookText.substring(0, metadataEndMarker);
    }

    const titleMatch = bookText.match(/Title:\s*(.*)/);
    const authorMatch = bookText.match(/Author:\s*(.*)/);
    const releaseDateMatch = bookText.match(/Release date:\s*(.*)/);
    const languageMatch = bookText.match(/Language:\s*(.*)/);

    return {
      title: titleMatch ? titleMatch[1] : "Unknown Title",
      author: authorMatch ? authorMatch[1] : "Unknown Author",
      releaseDate: releaseDateMatch ? releaseDateMatch[1] : "Unknown Date",
      language: languageMatch ? languageMatch[1] : "Unknown Language",
      sourceUrl
    };
  } catch (error) {
    console.error("Error extracting metadata:", error);
    return null;
  }
};

const Admin = () => {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [bookData, setBookData] = useState<string | null>(null);
  const [bookMetadata, setBookMetadata] = useState<BookMetadata | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processedBook, setProcessedBook] = useState<ProcessedBook | null>(null);
  const [processingTime, setProcessingTime] = useState(0);
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const [existingBooks, setExistingBooks] = useState<BookResponse[]>([]);
  const [existingBook, setExistingBook] = useState<BookResponse | null>(null);

  // Load existing books on mount
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

  // Process book using Gemini (OpenAI)
  const processBookWithGemini = async () => {
    if (!bookData || !bookMetadata) {
      toast.error("Please fetch a book first");
      return;
    }

    if (existingBook) {
      toast.error(`This book already exists in the database (ID: ${existingBook.id}). Cannot add duplicate books.`);
      return;
    }

    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      toast.error("Please set your OpenAI API key in the .env file");
      return;
    }

    setProcessing(true);
    setProcessingTime(0);
    setProcessingStatus("Initializing...");

    const startTime = Date.now();
    const timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setProcessingTime(elapsed);
    }, 1000);

    try {
      const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true
      });

      // Clean the book content
      const cleanedText = cleanText(bookData);

      // Split text into chunks if larger than 200k
      const chunks = splitTextIntoChunks(cleanedText, 200000);
      const totalChunks = chunks.length;

      if (totalChunks > 1) {
        toast.info(`Processing large book in ${totalChunks} chunks...`);
      }

      const allParagraphs: string[] = [];

      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];
        setProcessingStatus(`Processing chunk ${chunkIndex + 1}/${totalChunks} with OpenAI...`);
        toast.info(`Processing chunk ${chunkIndex + 1}/${totalChunks} (${Math.round(chunk.length / 1000)}K characters)...`);

        const prompt = createProcessingPrompt(chunk, chunkIndex + 1, totalChunks);

        // Call OpenAI API
        const completion = await openai.chat.completions.create({
          model: "o1",
          messages: [
            {
              role: "user",
              content: prompt
            }
          ],
          max_completion_tokens: 100000
        });

        const text = completion.choices[0].message.content || "";

        let parsedResponse;
        try {
          parsedResponse = JSON.parse(text);
        } catch (parseError) {
          console.error(`Failed to parse JSON for chunk ${chunkIndex + 1}`, parseError);
          throw new Error(`Failed to parse response for chunk ${chunkIndex + 1}`);
        }

        if (!parsedResponse.paragraphs || !Array.isArray(parsedResponse.paragraphs)) {
          throw new Error(`Invalid response format for chunk ${chunkIndex + 1} - missing paragraphs`);
        }

        allParagraphs.push(...parsedResponse.paragraphs);
      }

      // Step 1: Save the book metadata to the backend
      const bookResponse = await fetch("/api/backend/books/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: bookMetadata.title,
          author: bookMetadata.author,
          published_date: bookMetadata.releaseDate,
          language: bookMetadata.language,
          source: bookMetadata.sourceUrl
        })
      });

      const bookResponseData = await bookResponse.json();
      const bookId = bookResponseData.id;

      toast.success(`Book saved! ID: ${bookId}`);

      // Step 2: Save paragraphs to the backend
      let savedCount = 0;
      const batchSize = 10;
      for (let i = 0; i < allParagraphs.length; i += batchSize) {
        const batch = allParagraphs.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (paragraph: string) => {
            const response = await fetch("/api/backend/paragraphs/", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                book_id: bookId,
                content: paragraph
              })
            });

            if (!response.ok) {
              console.error(`Failed to save paragraph: ${response.status}`);
            }

            savedCount++;
            setProcessingStatus(`Saving paragraphs to database (${savedCount}/${allParagraphs.length})...`);
          })
        );
      }

      toast.success(`Book processed and saved! ${allParagraphs.length} paragraphs saved to the database.`);
      clearInterval(timerInterval);
    } catch (error) {
      clearInterval(timerInterval);
      console.error("Error processing book:", error);
      toast.error(error instanceof Error ? error.message : "Failed to process book with OpenAI");
    } finally {
      setProcessing(false);
      setProcessingStatus("");
    }
  };

  // Handle book URL input and fetching
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!url.trim()) {
      toast.error("Please enter a URL");
      return;
    }

    let urlObj: URL;
    try {
      urlObj = new URL(url);
    } catch {
      toast.error("Please enter a valid URL");
      return;
    }

    if (!url.startsWith("https://www.gutenberg.org/")) {
      toast.error("Please enter a valid Project Gutenberg URL");
      return;
    }

    let textUrl: string;

    const directTextMatch = url.match(/\/cache\/epub\/(\d+)\/pg\d+\.txt$/);
    if (directTextMatch) {
      textUrl = url;
    } else {
      const ebookMatch = url.match(/\/ebooks\/(\d+)/);
      if (!ebookMatch) {
        toast.error("Please enter a valid URL format (e.g., https://www.gutenberg.org/ebooks/77254 or https://www.gutenberg.org/cache/epub/77251/pg77251.txt)");
        return;
      }

      const ebookNumber = ebookMatch[1];
      textUrl = `https://www.gutenberg.org/cache/epub/${ebookNumber}/pg${ebookNumber}.txt`;
    }

    setLoading(true);

    try {
      const proxyUrl = '/api/gutenberg';
      const fetchUrl = textUrl.replace('https://www.gutenberg.org', proxyUrl);

      const response = await fetch(fetchUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/plain',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch book: ${response.status} ${response.statusText}`);
      }

      const bookText = await response.text();

      if (!bookText || bookText.length < 100) {
        throw new Error("Received invalid or empty book content");
      }

      const metadata = extractBookMetadata(bookText, textUrl);
      setBookMetadata(metadata);

      const existingMatch = existingBooks.find(
        book => book.source === textUrl || 
               (book.title.toLowerCase() === metadata.title.toLowerCase() && 
                book.author.toLowerCase() === metadata.author.toLowerCase())
      );

      if (existingMatch) {
        setExistingBook(existingMatch);
        toast.warning(`Book \"${metadata.title}\" by ${metadata.author} already exists in the database!`, {
          duration: 5000
        });
      } else {
        setExistingBook(null);
        toast.success(`Book \"${metadata.title}\" by ${metadata.author} fetched successfully!`);
      }

      setBookData(bookText);
      setProcessedBook(null);

    } catch (error) {
      console.error("Error fetching book:", error);
      toast.error(error instanceof Error ? error.message : "Failed to fetch book");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--gradient-warm)]">
      {/* Header */}
      <header className="py-8 text-center">
        <h1 className="text-5xl font-bold text-foreground mb-2">
          Admin Panel
        </h1>
        <p className="text-muted-foreground text-lg">
          Upload books to the database
        </p>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 pb-16 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-6 w-6" />
              Upload Book URL
            </CardTitle>
            <CardDescription>
              Enter the URL of a book to add it to the database
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bookUrl">Book URL</Label>
                <Input
                  id="bookUrl"
                  type="url"
                  placeholder="https://example.com/book.txt"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={loading}
                  className="w-full"
                />
                <p className="text-sm text-muted-foreground">
                  Enter the complete URL to the book file
                </p>
              </div>

              <Button 
                type="submit" 
                className="w-full"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Book
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Display Book Metadata */}
        {bookMetadata && (
          <Card className={`mt-6 ${existingBook ? 'border-orange-500 border-2' : ''}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Book Information
                {existingBook && (
                  <span className="text-sm font-normal text-orange-600 bg-orange-100 px-2 py-1 rounded dark:bg-orange-950 dark:text-orange-400">
                    Already Exists
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                Extracted metadata from the fetched book
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="font-semibold">Title:</Label>
                <p className="text-sm mt-1">{bookMetadata.title}</p>
              </div>
              <div>
                <Label className="font-semibold">Author:</Label>
                <p className="text-sm mt-1">{bookMetadata.author}</p>
              </div>
              <div>
                <Label className="font-semibold">Release Date:</Label>
                <p className="text-sm mt-1">{bookMetadata.releaseDate}</p>
              </div>
              <div>
                <Label className="font-semibold">Language:</Label>
                <p className="text-sm mt-1">{bookMetadata.language}</p>
              </div>
              <div>
                <Label className="font-semibold">Source URL:</Label>
                <p className="text-sm mt-1 break-all">{bookMetadata.sourceUrl}</p>
              </div>
              {bookData && (
                <div>
                  <Label className="font-semibold">Size:</Label>
                  <p className="text-sm mt-1">{Math.round(bookData.length / 1024)} KB</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Process with Gemini Button */}
        {bookMetadata && bookData && !processedBook && (
          <Card className="mt-6">
            <CardContent className="pt-6">
              {existingBook && (
                <p className="text-sm text-orange-600 mb-3 dark:text-orange-400">
                  ⚠️ This book already exists in the database and cannot be processed again.
                </p>
              )}
              <Button 
                onClick={processBookWithGemini}
                disabled={processing || existingBook !== null}
                className="w-full"
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {processingStatus || `Processing... (${processingTime}s)`}
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Process Book & Save to Database
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Display Processed Results */}
        {processedBook && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Processing Complete!</CardTitle>
              <CardDescription>
                Book has been processed and saved to the database
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="font-semibold">Total Paragraphs:</Label>
                <p className="text-sm mt-1">{processedBook.paragraphs.length}</p>
              </div>
              <div>
                <Label className="font-semibold">Processed At:</Label>
                <p className="text-sm mt-1">{new Date(processedBook.processedAt).toLocaleString()}</p>
              </div>
              <div>
                <Label className="font-semibold">Sample Paragraph:</Label>
                <p className="text-sm mt-1 p-3 bg-muted rounded-md">
                  {processedBook.paragraphs[0]?.substring(0, 200)}...
                </p>
              </div>
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

