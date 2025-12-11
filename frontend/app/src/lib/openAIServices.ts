interface ProcessBookRequest {
  bookText: string;
  chunkIndex: number;
  totalChunks: number;
  metadata?: {
    title?: string;
    author?: string;
  };
}

interface ProcessBookResponse {
  status: 'success' | 'error';
  paragraphs?: string[];
  total_paragraphs?: number;
  error?: string;
}

class OpenAIService {
  private backendUrl: string;

  constructor(backendUrl: string) {
    this.backendUrl = backendUrl;
  }

  /**
   * Process book text via backend proxy
   * NO API KEY HERE - all processing happens on backend
   */
  async processBook(request: ProcessBookRequest): Promise<ProcessBookResponse> {
    try {
      const response = await fetch(`${this.backendUrl}/api/process-book/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to process book');
      }

      return await response.json();
    } catch (error) {
      console.error('Book processing error:', error);
      throw error;
    }
  }
}

export default OpenAIService;