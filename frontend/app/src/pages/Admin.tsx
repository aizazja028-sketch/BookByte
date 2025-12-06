import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Upload, BookOpen, Sparkles } from "lucide-react";
import OpenAI from "openai";
import { getAllBooks, type BookResponse } from "@/lib/eventsApi";

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

const extractBookMetadata = (bookText: string, sourceUrl: string): BookMetadata | null => {
  try {
    // Find the metadata section (before "*** START OF")
    const metadataEndMarker = bookText.indexOf("*** START OF");
    if (metadataEndMarker === -1) {
      console.error("Could not find metadata section");
      return null;
    }
    
    const metadataSection = bookText.substring(0, metadataEndMarker);
    console.log("Metadata section:", metadataSection.substring(0, 1000));
    
    // Extract Title (capture everything until we hit a blank line followed by "Author:")
    const titleMatch = metadataSection.match(/Title:\s*([^\n]+(?:\n\s+[^\n]+)*?)(?=\n\s*\n|\nAuthor:)/i);
    const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : "Unknown Title";
    
    // Extract Author (single or multi-line until blank line)
    const authorMatch = metadataSection.match(/Author:\s*([^\n]+(?:\n\s+[^\n]+)*?)(?=\n\s*\n|\nRelease date:)/i);
    const author = authorMatch ? authorMatch[1].replace(/\s+/g, ' ').trim() : "Unknown Author";
    
    // Extract Release Date (capture date before the bracket)
    const releaseDateMatch = metadataSection.match(/Release date:\s*([^\[]+?)(?:\s*\[|$)/i);
    const releaseDate = releaseDateMatch ? releaseDateMatch[1].trim() : "Unknown Date";
    
    // Extract Language (single line value)
    const languageMatch = metadataSection.match(/Language:\s*([^\n]+)/i);
    const language = languageMatch ? languageMatch[1].trim() : "Unknown Language";
    
    console.log("Extracted values:", { title, author, releaseDate, language });
    
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
        // Don't show error toast on mount, just log it
      }
    };
    loadBooks();
  }, []);

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
    
    // Start timer
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

      // Remove Project Gutenberg header/footer
      const startMarker = "*** START OF THE PROJECT GUTENBERG EBOOK";
      const endMarker = "*** END OF THE PROJECT GUTENBERG EBOOK";
      
      let cleanedText = bookData;
      const startIndex = bookData.indexOf(startMarker);
      const endIndex = bookData.indexOf(endMarker);
      
      if (startIndex !== -1 && endIndex !== -1) {
        cleanedText = bookData.substring(startIndex, endIndex);
        // Remove the START marker line itself
        cleanedText = cleanedText.substring(cleanedText.indexOf('\n') + 1);
      }

      const prompt = `You are a text processing assistant. Analyze the following book text and extract all paragraphs.

CRITICAL REQUIREMENTS - FOLLOW EXACTLY:
1. Each paragraph MUST be between 3-7 sentences (NO MORE, NO LESS)
2. NEVER create single-word or single-sentence paragraphs
3. NEVER create paragraphs longer than 7 sentences
4. Count sentences carefully - a sentence ends with . ! or ?
5. If dialogue is short, combine multiple exchanges into one paragraph (up to 7 sentences)
6. Preserve the original text exactly (no summarization or modification)
7. Skip empty lines, page numbers, headers, footers, chapter titles
8. Do NOT include table of contents, index, or chapter listings
9. Skip prefaces and forewords if not part of main narrative
10. Split very long paragraphs into multiple smaller ones (3-7 sentences each)

PARAGRAPH SIZE RULES:
- Minimum: 3 sentences
- Maximum: 7 sentences
- Target: 4-6 sentences per paragraph
- If original paragraph is 15 sentences, split it into 3 paragraphs of 5 sentences each

Return ONLY a valid JSON object in this exact format with no additional text:
{
  "paragraphs": [
    "First paragraph text here...",
    "Second paragraph text here..."
  ]
}

Book text:
${cleanedText}`;

      console.log("Sending to OpenAI, text length:", cleanedText.length);
      const charCount = cleanedText.length;
      setProcessingStatus("Processing with OpenAI...");
      toast.info(`Processing book with OpenAI... (${Math.round(charCount / 1000)}K characters)`);

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
      const finishReason = completion.choices[0].finish_reason;
      
      console.log("OpenAI response length:", text.length);
      console.log("OpenAI finish reason:", finishReason);
      console.log("OpenAI response preview:", text.substring(0, 500));
      
      // Check if response was truncated
      if (finishReason === "length") {
        throw new Error("OpenAI response was truncated due to token limit. Try processing a shorter book or splitting it into sections.");
      }

      // Parse JSON response - the response should already be valid JSON due to response_format
      let parsedResponse;
      try {
        // Since we're using response_format: { type: "json_object" }, the content should be valid JSON
        parsedResponse = JSON.parse(text);
      } catch (parseError) {
        console.error("Failed to parse JSON directly, trying alternative extraction:", parseError);
        
        // Fallback: try to extract JSON from markdown code blocks
        let jsonText = text;
        
        if (text.includes('```json')) {
          const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
          if (jsonMatch) {
            jsonText = jsonMatch[1];
          }
        } else if (text.includes('```')) {
          const jsonMatch = text.match(/```\s*([\s\S]*?)\s*```/);
          if (jsonMatch) {
            jsonText = jsonMatch[1];
          }
        }
        
        // Try to extract JSON object
        const jsonObjectMatch = jsonText.match(/\{[\s\S]*\}/);
        if (!jsonObjectMatch) {
          console.error("Full response text:", text);
          throw new Error("Could not extract JSON from OpenAI response");
        }
        
        parsedResponse = JSON.parse(jsonObjectMatch[0]);
      }
      
      if (!parsedResponse.paragraphs || !Array.isArray(parsedResponse.paragraphs)) {
        throw new Error("Invalid response format from OpenAI - missing paragraphs array");
      }

      console.log(`Extracted ${parsedResponse.paragraphs.length} paragraphs`);
      
      // Step 1: Save the book to the backend
      setProcessingStatus("Saving book metadata to database...");
      toast.info("Saving book to database...");
      
      // Parse the release date to YYYY-MM-DD format
      let publishedDate = "2024-01-01"; // Default fallback
      try {
        const dateStr = bookMetadata.releaseDate;
        // Try to extract date from various formats like "January 1, 2024" or "2024-01-01"
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
      
      const bookResponse = await fetch("/api/backend/books/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: bookMetadata.title,
          author: bookMetadata.author,
          published_date: publishedDate,
          language: bookMetadata.language,
          source: bookMetadata.sourceUrl
        })
      });

      if (!bookResponse.ok) {
        const errorText = await bookResponse.text();
        let errorMessage = `Failed to save book: ${bookResponse.status}`;
        
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }

      const bookResponseData = await bookResponse.json();
      const bookId = bookResponseData.id;
      
      console.log("Book saved with ID:", bookId);
      toast.success(`Book saved! ID: ${bookId}`);
      
      // Step 2: Save all paragraphs
      setProcessingStatus(`Saving paragraphs to database (0/${parsedResponse.paragraphs.length})...`);
      toast.info(`Saving ${parsedResponse.paragraphs.length} paragraphs...`);
      
      let savedCount = 0;
      const batchSize = 10; // Save in batches to show progress
      
      for (let i = 0; i < parsedResponse.paragraphs.length; i += batchSize) {
        const batch = parsedResponse.paragraphs.slice(i, i + batchSize);
        
        // Save paragraphs in parallel batches
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
            setProcessingStatus(`Saving paragraphs to database (${savedCount}/${parsedResponse.paragraphs.length})...`);
          })
        );
      }

      const processedBookData: ProcessedBook = {
        metadata: bookMetadata,
        paragraphs: parsedResponse.paragraphs,
        processedAt: new Date().toISOString()
      };

      setProcessedBook(processedBookData);

      // Reload books list to include the newly added book
      try {
        const updatedBooks = await getAllBooks();
        setExistingBooks(updatedBooks);
      } catch (error) {
        console.error('Error reloading books:', error);
      }

      clearInterval(timerInterval);
      toast.success(`Book processed and saved! ${parsedResponse.paragraphs.length} paragraphs saved to database.`);
      console.log("Processed book:", processedBookData);
    } catch (error) {
      clearInterval(timerInterval);
      console.error("Error processing book:", error);
      toast.error(error instanceof Error ? error.message : "Failed to process book with Gemini");
    } finally {
      setProcessing(false);
      setProcessingStatus("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      toast.error("Please enter a URL");
      return;
    }

    // Validate URL format
    let urlObj: URL;
    try {
      urlObj = new URL(url);
    } catch {
      toast.error("Please enter a valid URL");
      return;
    }

    // Validate that it's a Project Gutenberg URL
    if (!url.startsWith("https://www.gutenberg.org/")) {
      toast.error("Please enter a valid Project Gutenberg URL");
      return;
    }

    let textUrl: string;
    
    // Check if it's a direct text file URL
    const directTextMatch = url.match(/\/cache\/epub\/(\d+)\/pg\d+\.txt$/);
    if (directTextMatch) {
      // URL is already in the correct format
      textUrl = url;
    } else {
      // Extract ebook number from /ebooks/ URL format
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
      // Use Vite's proxy in development
      // const proxyUrl = '/api/gutenberg';
      // const fetchUrl = textUrl.replace('https://www.gutenberg.org', proxyUrl);
      const fetchUrl='https://www.gutenberg.org/cache/epub/77400/pg77400.txt'
      console.log("Fetching from:", fetchUrl);
      
      const response = await fetch(fetchUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/plain',
        },
      });
      
      console.log("Response status:", response.status);
      console.log("Response ok:", response.ok);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch book: ${response.status} ${response.statusText}`);
      }

      const bookText = await response.text();
      
      console.log("Book text received, length:", bookText.length);
      console.log("First 200 characters:", bookText.substring(0, 700));
      
      // Validate that we actually got book content
      if (!bookText || bookText.length < 100) {
        throw new Error("Received invalid or empty book content");
      }
      
      // Extract metadata
      const metadata = extractBookMetadata(bookText, textUrl);
      if (metadata) {
        setBookMetadata(metadata);
        console.log("Extracted metadata:", metadata);
        
        // Check if book already exists in database
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
      } else {
        toast.warning("Book fetched but could not extract all metadata");
      }
      
      // Store the retrieved data
      setBookData(bookText);
      
      // Reset processed book state when new book is loaded
      setProcessedBook(null);
      
      console.log("Book data retrieved successfully. Total length:", bookText.length);
      console.log("Book URL submitted:", url);
      console.log("Text URL:", textUrl);
      
      setUrl("");
    } catch (error) {
      console.error("Error fetching book:", error);
      console.error("Error details:", {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
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
                Book has been processed and saved to database
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

        {/* Back to Home */}
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



