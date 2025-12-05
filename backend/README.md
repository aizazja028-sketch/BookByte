# Events API Documentation

## Getting Started

### Prerequisites
- Python 3.8+
- Django 4.0+

### Setup and Starting the Server

1. **Create a virtual environment:**
   ```bash
   python -m venv venv
   ```

2. **Activate the virtual environment:**
   - **Windows (PowerShell):**
     ```powershell
     .\venv\Scripts\Activate.ps1
     ```
   - **Windows (Command Prompt):**
     ```cmd
     venv\Scripts\activate.bat
     ```
   - **macOS/Linux:**
     ```bash
     source venv/bin/activate
     ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Navigate to the app directory:**
   ```bash
   cd app
   ```

5. **Run migrations (first time only):**
   ```bash
   python manage.py migrate
   ```

6. **Start the development server:**
   ```bash
   python manage.py runserver
   ```

The server will start at `http://127.0.0.1:8000`

---


=========================================ENDPOINTS DOCUMENTAION=====================================
## Overview
The Events API allows tracking user interactions with paragraphs. Each user can have multiple interaction types (like, dislike, heart, bookmark) on a single paragraph, all stored in one record.

## Base URL
```
http://127.0.0.1:8000
```

---

## Endpoints

### 1. Create or Update User Interaction

**Endpoint:** `POST /events/`

**Description:** Creates a new event or updates an existing one for a specific user-paragraph pair. Only the flags you send will be updated; other flags remain unchanged.

**Request Body:**
```json
{
  "user_id": "uuid-of-user",
  "paragraph_id": "uuid-of-paragraph",
  "is_liked": true,
  "is_hearted": true,
  "is_bookmarked": false,
  "is_disliked": false
}
```

**Notes:**
- You can send only the flags you want to update (e.g., just `is_liked`)
- If this is the first interaction for this user-paragraph pair, it creates a new record
- If an interaction already exists, it updates only the provided flags
- One user can only have ONE event record per paragraph (enforced by database constraint)

**Response (201 Created or 200 OK):**
```json
{
  "id": "event-uuid",
  "message": "Event created successfully",
  "is_liked": true,
  "is_disliked": false,
  "is_hearted": true,
  "is_bookmarked": false
}
```

**Error Response (404):**
```json
{
  "error": "UserIdentifier or Paragraph not found"
}
```

---

### 2. Get User's Interactions with a Paragraph

**Endpoint:** `GET /events/user/{user_id}/paragraph/{paragraph_id}/`

**Description:** Retrieves all interaction flags for a specific user on a specific paragraph. Use this when the page reloads to restore the user's previous interactions.

**Example Request:**
```
GET http://127.0.0.1:8000/events/user/123e4567-e89b-12d3-a456-426614174000/paragraph/987fcdeb-51a2-43d7-8c9f-123456789abc/
```

**Response (200 OK) - If interaction exists:**
```json
{
  "id": "event-uuid",
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "paragraph_id": "987fcdeb-51a2-43d7-8c9f-123456789abc",
  "is_liked": true,
  "is_disliked": false,
  "is_hearted": true,
  "is_bookmarked": false,
  "created_at": "2024-11-18T10:30:00Z",
  "updated_at": "2024-11-18T15:45:00Z"
}
```

**Response (200 OK) - If no interaction exists yet:**
```json
{
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "paragraph_id": "987fcdeb-51a2-43d7-8c9f-123456789abc",
  "is_liked": false,
  "is_disliked": false,
  "is_hearted": false,
  "is_bookmarked": false
}
```

**Error Response (404):**
```json
{
  "error": "UserIdentifier or Paragraph not found"
}
```

---

### 3. List All Events

**Endpoint:** `GET /events/`

**Description:** Returns all event records in the system.

**Response (200 OK):**
```json
[
  {
    "id": "event-uuid-1",
    "user_id": "user-uuid",
    "paragraph_id": "paragraph-uuid",
    "is_liked": true,
    "is_disliked": false,
    "is_hearted": false,
    "is_bookmarked": true,
    "created_at": "2024-11-18T10:30:00Z",
    "updated_at": "2024-11-18T15:45:00Z"
  },
  ...
]
```

---

### 4. Get Single Event by ID

**Endpoint:** `GET /events/{event_id}/`

**Description:** Retrieves a specific event by its UUID.

**Response (200 OK):**
```json
{
  "id": "event-uuid",
  "user_id": "user-uuid",
  "paragraph_id": "paragraph-uuid",
  "is_liked": true,
  "is_disliked": false,
  "is_hearted": true,
  "is_bookmarked": false,
  "created_at": "2024-11-18T10:30:00Z",
  "updated_at": "2024-11-18T15:45:00Z"
}
```

**Error Response (404):**
```json
{
  "error": "Event not found"
}
```

---

### 5. Update Event by ID

**Endpoint:** `PUT /events/{event_id}/`

**Description:** Updates an existing event by its UUID. Only send the flags you want to change.

**Request Body:**
```json
{
  "is_liked": false,
  "is_hearted": true
}
```

**Response (200 OK):**
```json
{
  "message": "Event updated successfully"
}
```

---

### 6. Delete Event

**Endpoint:** `DELETE /events/{event_id}/`

**Description:** Deletes a specific event record.

**Response (200 OK):**
```json
{
  "message": "Event deleted successfully"
}
```

---

## Common Frontend Workflow

### On Page Load (Retrieve User's Interactions)

1. Get the `user_id` (from session/localStorage)
2. For each paragraph displayed, call:
   ```
   GET /events/user/{user_id}/paragraph/{paragraph_id}/
   ```
3. Use the response to set the UI state (highlight liked/hearted/bookmarked buttons)

**Example JavaScript:**
```javascript
async function loadUserInteractions(userId, paragraphId) {
  const response = await fetch(
    `http://127.0.0.1:8000/events/user/${userId}/paragraph/${paragraphId}/`
  );
  const data = await response.json();
  
  // Update UI based on data
  updateLikeButton(data.is_liked);
  updateHeartButton(data.is_hearted);
  updateBookmarkButton(data.is_bookmarked);
  updateDislikeButton(data.is_disliked);
}
```

---

### When User Interacts (Like/Heart/Bookmark)

1. Call `POST /events/` with only the flag you want to update
2. Update the UI based on the response

**Example JavaScript - User clicks "Like":**
```javascript
async function toggleLike(userId, paragraphId, isLiked) {
  const response = await fetch('http://127.0.0.1:8000/events/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_id: userId,
      paragraph_id: paragraphId,
      is_liked: isLiked
    })
  });
  
  const data = await response.json();
  console.log(data.message); // "Event created successfully" or "Event updated successfully"
  
  // Update UI
  updateLikeButton(data.is_liked);
}
```

---

## Important Notes

1. **Unique Constraint:** Each user can only have ONE event record per paragraph. The system automatically handles creating or updating.

2. **Partial Updates:** You don't need to send all four flags every time. Send only what you want to change:
   ```json
   // Just update like status
   {
     "user_id": "uuid",
     "paragraph_id": "uuid",
     "is_liked": true
   }
   ```

3. **User Management:** Make sure to create a user first using `POST /users/` before tracking events.

4. **Status Codes:**
   - `200 OK` - Successfully retrieved or updated
   - `201 Created` - New event record created
   - `404 Not Found` - User or paragraph doesn't exist
   - `405 Method Not Allowed` - Wrong HTTP method

---

## Related Endpoints

### Create User
```
POST /users/
{
  "identifier": "device-id-or-session-id"
}
```

### Get Paragraphs with Stats
```
GET /paragraphs/random/
```
Returns paragraphs with aggregated interaction counts (total likes, hearts, bookmarks, dislikes).
