import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Upload, BookOpen, Sparkles } from "lucide-react";
import OpenAI from "openai";
import { getAllBooks, type BookResponse } from "@/lib/eventsApi";

// Helper function to split text into chunks of a maximum size
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

// Function to extract metadata from the fetched book text
const extractBookMetadata = (bookText: string, sourceUrl: string) => {
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
  const [bookMetadata, setBookMetadata] = useState<any | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processedBook, setProcessedBook] = useState<any | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const [existingBooks, setExistingBooks] = useState<BookResponse[]>([]);

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

  // Process the book data into chunks and generate paragraphs using OpenAI
  const processBookWithGemini = async () => {
    if (!bookData || !bookMetadata) {
      toast.error("Please fetch a book first");
      return;
    }

    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      toast.error("Please set your OpenAI API key in the .env file");
      return;
    }

    setProcessing(true);
    setProcessingStatus("Initializing...");

    const chunks = splitTextIntoChunks(bookData, 200000);
    const totalChunks = chunks.length;
    const allParagraphs: string[] = [];

    try {
      const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true
      });

      // Loop through each chunk and process with OpenAI
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const chunk = chunks[chunkIndex];
        setProcessingStatus(`Processing chunk ${chunkIndex + 1}/${totalChunks}...`);
        toast.info(`Processing chunk ${chunkIndex + 1}/${totalChunks} (${Math.round(chunk.length / 1000)}K characters)...`);

        const prompt = `
          You are a text processing assistant. Analyze the following book text and extract all paragraphs.
          CRITICAL REQUIREMENTS:
          1. Each paragraph must be between 3-7 sentences (NO MORE, NO LESS).
          2. Paragraphs must not exceed 7 sentences.
          3. Skip any page numbers, headers, footers, or extra information.
          4. Return only valid paragraphs, no extra text.
        
          Book text (Chunk ${chunkIndex + 1}/${totalChunks}):
          ${chunk}
        `;

        // Call OpenAI API to process the chunk
        const completion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo", // Choose a model like GPT-3.5
          messages: [{ role: "user", content: prompt }],
          max_tokens: 100000
        });

        const text = completion.choices[0].message.content || "";

        let parsedResponse;
        try {
          parsedResponse = JSON.parse(text);
        } catch (parseError) {
          console.error(`Failed to parse JSON for chunk ${chunkIndex + 1}:`, parseError);
          throw new Error(`Failed to parse response for chunk ${chunkIndex + 1}`);
        }

        if (!parsedResponse.paragraphs || !Array.isArray(parsedResponse.paragraphs)) {
          throw new Error(`Invalid response format for chunk ${chunkIndex + 1}`);
        }

        allParagraphs.push(...parsedResponse.paragraphs);
      }

      // Save the book to the backend
      const bookResponse = await fetch("/api/backend/books/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

      // Save paragraphs to the backend
      let savedCount = 0;
      for (let i = 0; i < allParagraphs.length; i++) {
        const paragraph = allParagraphs[i];
        const response = await fetch("/api/backend/paragraphs/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ book_id: bookId, content: paragraph })
        });

        if (!response.ok) {
          console.error(`Failed to save paragraph: ${response.status}`);
        }

        savedCount++;
        setProcessingStatus(`Saving paragraphs to database (${savedCount}/${allParagraphs.length})...`);
      }

      toast.success(`Book processed and saved! ${allParagraphs.length} paragraphs saved to the database.`);
      setProcessedBook({
        metadata: bookMetadata,
        paragraphs: allParagraphs,
        processedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error processing book:", error);
      toast.error("Failed to process the book.");
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

    const textUrl = `https://www.gutenberg.org/cache/epub/${urlObj.pathname.split("/")[2]}/pg${urlObj.pathname.split("/")[2]}.txt`;

    setLoading(true);

    try {
      const response = await fetch(textUrl, { method: "GET", headers: { Accept: "text/plain" } });

      if (!response.ok) {
        throw new Error(`Failed to fetch book: ${response.status}`);
      }

      const bookText = await response.text();
      const metadata = extractBookMetadata(bookText, textUrl);
      setBookMetadata(metadata);
      setBookData(bookText);
      toast.success(`Book "${metadata.title}" by ${metadata.author} fetched successfully!`);
    } catch (error) {
      console.error("Error fetching book:", error);
      toast.error("Failed to fetch the book.");
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
        <p className="text-muted-foreground text-lg">Upload books to the database</p>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 pb-16 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-6 w-6" />
              Upload Book URL
            </CardTitle>
            <CardDescription>Enter the URL of a book to add it to the database</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bookUrl">Book URL</Label>
                <Input
                  id="bookUrl"
                  type="url"
                  placeholder="https://www.gutenberg.org/ebooks/52206"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={loading}
                  className="w-full"
                />
                <p className="text-sm text-muted-foreground">Enter the complete URL to the book file</p>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
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

        {/* Book Metadata */}
        {bookMetadata && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Book Information</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Title: {bookMetadata.title}</p>
              <p>Author: {bookMetadata.author}</p>
              <p>Release Date: {bookMetadata.releaseDate}</p>
              <p>Language: {bookMetadata.language}</p>
              <p>Source URL: {bookMetadata.sourceUrl}</p>
              <p>Size: {Math.round(bookData?.length / 1024)} KB</p>
            </CardContent>
          </Card>
        )}

        {/* Process Book Button */}
        {bookMetadata && bookData && (
          <Button onClick={processBookWithGemini} disabled={processing} className="w-full mt-6">
            {processing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {processingStatus || `Processing...`}
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Process Book & Save to Database
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

export default Admin;
