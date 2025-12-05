// const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const API_BASE_URL =import.meta.env.VITE_API_URL || 'https://bookbyte-production.up.railway.app'   ;

export interface EventData {
  user_id: string;
  paragraph_id: string;
  is_liked?: boolean;
  is_disliked?: boolean;
  is_hearted?: boolean;
  is_bookmarked?: boolean;
}

export interface EventResponse {
  id?: string;
  user_id: string;
  paragraph_id: string;
  is_liked: boolean;
  is_disliked: boolean;
  is_hearted: boolean;
  is_bookmarked: boolean;
  message?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ParagraphResponse {
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

/**
 * Creates a user in the Django backend if they don't exist
 */
export const createUser = async (userId: string): Promise<void> => {
  try {
    // Keep UUID with dashes for the identifier field (it's just a string in Django)
    console.log('Creating user with ID:', userId);
    
    const response = await fetch(`${API_BASE_URL}/users/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identifier: userId,  // Keep with dashes - this is stored as CharField
      }),
    });

    // 201 = created successfully
    if (response.status === 201) {
      const data = await response.json();
      console.log('User created successfully:', data);
      return;
    }
    
    // 400 might mean user already exists
    if (response.status === 400) {
      const error = await response.json().catch(() => ({}));
      console.log('User creation response (400):', error);
      // Check if error is about duplicate user (already exists)
      if (error.identifier || error.message?.includes('already exists') || error.message?.includes('unique')) {
        console.log('User already exists, continuing');
        return;
      }
      console.warn('User creation returned 400:', error);
      return;
    }

    const errorData = await response.json().catch(() => ({}));
    console.warn('Failed to create user, status:', response.status, errorData);
  } catch (error) {
    console.warn('Could not create user:', error);
  }
};

/**
 * Fetches a random paragraph from the Django backend
 */
export const getRandomParagraph = async (userId: string): Promise<ParagraphResponse> => {
  const response = await fetch(`${API_BASE_URL}/paragraphs/random/?user_id=${encodeURIComponent(userId)}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('No paragraphs available');
    }
    const errorText = await response.text();
    console.error('Error fetching paragraph:', errorText);
    throw new Error('Failed to fetch paragraph');
  }

  let data = await response.json();
  
  console.log('Received paragraph data from Django:', data);
  
  // If Django returns an array, pick a random paragraph from it
  if (Array.isArray(data)) {
    if (data.length === 0) {
      throw new Error('No paragraphs available');
    }
    // Select a random paragraph from the array
    data = data[Math.floor(Math.random() * data.length)];
    console.log('Selected random paragraph from array:', data);
  
  // Log all available ID-related fields to debug
  console.log('Available ID fields:', {
    id: data.id,
    paragraph_id: data.paragraph_id,
    pk: data.pk,
    uuid: data.uuid,
    allKeys: Object.keys(data)
  });
  }
  
  // Transform Django response to match frontend expectations
  // Django uses 'content' but frontend expects 'text'
  // Django might use 'paragraph_id' or 'id'
  const paragraphId = data.id || data.paragraph_id;
  
  console.log('Raw paragraph data from Django:', {
    id: data.id,
    paragraph_id: data.paragraph_id,
    selectedId: paragraphId
  });
  
  const transformedData: ParagraphResponse = {
    id: paragraphId,
    text: data.content || data.text || '', // Handle both field names
    book: {
      title: data.book?.title || 'Unknown Title',
      author: data.book?.author || 'Unknown Author',
    },
    user_interactions: data.user_interactions  // Include user interactions from Django
  };
  
  // Validate the transformed data
  if (!transformedData.id) {
    console.error('No ID in paragraph:', data);
    throw new Error('Paragraph has no ID');
  }
  
  if (!transformedData.text) {
    console.error('No text content in paragraph:', data);
    throw new Error('Paragraph has no content');
  }
  
  console.log('Transformed paragraph:', transformedData);
  
  return transformedData;
};

/**
 * Creates or updates a user's interaction with a paragraph
 */
export const createOrUpdateEvent = async (data: EventData): Promise<EventResponse> => {
  // Both IDs are already in the correct format:
  // - user_id has dashes (looked up by identifier field)
  // - paragraph_id has no dashes (from Django, already formatted)
  
  console.log('Creating/updating event with data:', data);
  
  const response = await fetch(`${API_BASE_URL}/events/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error('Event API error:', response.status, error);
    throw new Error(error.error || 'Failed to update event');
  }

  return response.json();
};

/**
 * Gets a user's interactions with a specific paragraph
 * Suppresses 404 errors by catching them and returning default values
 */
export const getUserParagraphInteraction = async (
  userId: string,
  paragraphId: string
): Promise<EventResponse> => {
  try {
    // user_id keeps dashes (it's looked up by identifier field)
    // paragraph_id is already without dashes from Django, use as-is
    
    console.log('Fetching interactions for:', {
      userId,
      paragraphId,
      url: `${API_BASE_URL}/events/user/${userId}/paragraph/${paragraphId}/`
    });
    
    const response = await fetch(
      `${API_BASE_URL}/events/user/${userId}/paragraph/${paragraphId}/`,
      {
        // Add cache control to prevent duplicate requests
        cache: 'no-cache',
      }
    );

    // If 404, it means no interaction exists yet or user/paragraph not found
    // Return default values instead of throwing an error
    if (response.status === 404) {
      console.log('No interaction found (404), returning defaults');
      return {
        user_id: userId,
        paragraph_id: paragraphId,
        is_liked: false,
        is_disliked: false,
        is_hearted: false,
        is_bookmarked: false,
      };
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to fetch event');
    }

    const data = await response.json();
    console.log('Loaded interaction data:', data);
    return data;
  } catch (error) {
    // If network error or CORS issue, return default values
    if (error instanceof TypeError) {
      return {
        user_id: userId,
        paragraph_id: paragraphId,
        is_liked: false,
        is_disliked: false,
        is_hearted: false,
        is_bookmarked: false,
      };
    }
    throw error;
  }
};

/**
 * Gets all books from the backend
 */
export interface BookResponse {
  id: string;
  title: string;
  author: string;
  published_date: string;
  language: string;
  source: string;
  created_at: string;
}

export const getAllBooks = async (): Promise<BookResponse[]> => {
  const response = await fetch(`${API_BASE_URL}/books/`);

  if (!response.ok) {
    throw new Error('Failed to fetch books');
  }

  return response.json();
};

/**
 * Gets all events
 */
export const getAllEvents = async (): Promise<EventResponse[]> => {
  const response = await fetch(`${API_BASE_URL}/events/`);

  if (!response.ok) {
    throw new Error('Failed to fetch events');
  }

  return response.json();
};

/**
 * Gets a single event by ID
 */
export const getEventById = async (eventId: string): Promise<EventResponse> => {
  const response = await fetch(`${API_BASE_URL}/events/${eventId}/`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch event');
  }

  return response.json();
};

/**
 * Updates an event by ID
 */
export const updateEventById = async (
  eventId: string,
  data: Partial<EventData>
): Promise<{ message: string }> => {
  const response = await fetch(`${API_BASE_URL}/events/${eventId}/`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to update event');
  }

  return response.json();
};

/**
 * Deletes an event by ID
 */
export const deleteEventById = async (eventId: string): Promise<{ message: string }> => {
  const response = await fetch(`${API_BASE_URL}/events/${eventId}/`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete event');
  }

  return response.json();
};

export interface PaginatedResponse {
  results: ParagraphResponse[];
  pagination: {
    current_page: number;
    total_pages: number;
    total_count: number;
    page_size: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

/**
 * Gets bookmarked paragraphs for a user with pagination
 */
export const getBookmarkedParagraphs = async (
  userId: string,
  page: number = 1
): Promise<PaginatedResponse> => {
  const response = await fetch(
    `${API_BASE_URL}/events/user/${encodeURIComponent(userId)}/bookmarked-paragraphs/?page=${page}`
  );

  if (!response.ok) {
    if (response.status === 404) {
      return {
        results: [],
        pagination: {
          current_page: 1,
          total_pages: 0,
          total_count: 0,
          page_size: 10,
          has_next: false,
          has_previous: false
        }
      };
    }
    throw new Error('Failed to fetch bookmarked paragraphs');
  }

  const data = await response.json();

  // Transform Django response to match frontend expectations
  return {
    results: data.results.map((item: any) => ({
      id: item.paragraph_id,
      text: item.content,
      book: {
        title: item.book?.title || 'Unknown Title',
        author: item.book?.author || 'Unknown Author',
      },
      user_interactions: item.user_interactions
    })),
    pagination: data.pagination
  };
};



