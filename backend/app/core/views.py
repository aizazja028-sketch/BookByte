from django.shortcuts import render
from django.http import JsonResponse
from .models import Book, Paragraph,UserIdentifier, Event
from django.views.decorators.csrf import csrf_exempt

import json
import uuid
# Create your views here.
@csrf_exempt
def book_list(request):
    """List all books"""
    if request.method == "POST":
        data = json.loads(request.body)

        if Book.objects.filter(title=data.get('title'), author=data.get('author')).exists():
            return JsonResponse({'error': 'Book with same title and author already exists'}, status=400)

        book = Book.objects.create(
            title=data['title'],
            author=data['author'],
            published_date=data['published_date'],
            language=data['language'],
            source=data['source']
        )
        return JsonResponse({'id': str(book.id), 'message': 'Book created successfully'}, status=201)
    books = Book.objects.all().values()
    return JsonResponse(list(books), safe=False)
    
@csrf_exempt
def book_detail(request, book_id):
    """Retrieve, update or delete a book."""
    try:
        book = Book.objects.get(id=book_id)
    except Book.DoesNotExist:
        return JsonResponse({'error': 'Book not found'}, status=404)

    if request.method == "GET":
        return JsonResponse({
            'id': str(book.id),
            'title': book.title,
            'author': book.author,
            'published_date': book.published_date,
            'language': book.language,
            'source': book.source,
            'created_at': book.created_at
        })
    
    if request.method == "PUT":
        data = json.loads(request.body)

        new_title = data.get('title', book.title)
        new_author = data.get('author', book.author)

        # Check for duplicates excluding this book itself
        if Book.objects.filter(title=new_title, author=new_author).exclude(id=book.id).exists():
            return JsonResponse({'error': 'Another book with same title and author already exists'}, status=400)

        book.title = data.get('title', book.title)
        book.author = data.get('author', book.author)
        book.published_date = data.get('published_date', book.published_date)
        book.language = data.get('language', book.language)
        book.source = data.get('source', book.source)
        book.save()
        return JsonResponse({'message': 'Book updated successfully'})
    


    if request.method == "DELETE":
        book.delete()
        return JsonResponse({'message': 'Book deleted successfully'})
@csrf_exempt
def paragraph_list(request):
    """List all paragraphs"""
    if request.method == "POST":
        data = json.loads(request.body)
        try:
            book = Book.objects.get(id=data['book_id'])
        except Book.DoesNotExist:
            return JsonResponse({'error': 'Book not found'}, status=404)
        paragraph = Paragraph.objects.create(
            book=book,
            content=data['content']
        )
        return JsonResponse({'id': str(paragraph.id), 'message': 'Paragraph created successfully'}, status=201)
    paragraphs = Paragraph.objects.all().values()
    return JsonResponse(list(paragraphs), safe=False)

@csrf_exempt
def paragraph_detail(request, paragraph_id):
    """Retrieve, update or delete a paragraph."""
    try:
        paragraph = Paragraph.objects.get(id=paragraph_id)
    except Paragraph.DoesNotExist:
        return JsonResponse({'error': 'Paragraph not found'}, status=404)

    if request.method == "GET":
        return JsonResponse({
            'id': str(paragraph.id),
            'book_id': str(paragraph.book.id),
            'content': paragraph.content,
            'created_at': paragraph.created_at
        })
    
    if request.method == "PUT":
        data = json.loads(request.body)
        paragraph.content = data.get('content', paragraph.content)
        paragraph.save()
        return JsonResponse({'message': 'Paragraph updated successfully'})
    
    if request.method == "DELETE":
        paragraph.delete()
        return JsonResponse({'message': 'Paragraph deleted successfully'})

@csrf_exempt
def useridentifier_list(request):
    """List all user identifiers"""
    if request.method == "POST":
        data = json.loads(request.body)
        identifier_value = data.get('identifier')

        if UserIdentifier.objects.filter(identifier=identifier_value).exists():
            return JsonResponse({'error': 'UserIdentifier already exists'}, status=400)
        user = UserIdentifier.objects.create(
            identifier=data['identifier']
        )
        return JsonResponse({'id': str(user.id), 'message': 'UserIdentifier created successfully'}, status=201)
    users = UserIdentifier.objects.all().values()
    return JsonResponse(list(users), safe=False)

@csrf_exempt
def useridentifier_detail(request, user_id):
    """Retrieve, update or delete a user identifier."""
    try:
        user = UserIdentifier.objects.get(id=user_id)
    except UserIdentifier.DoesNotExist:
        return JsonResponse({'error': 'UserIdentifier not found'}, status=404)

    if request.method == "GET":
        return JsonResponse({
            'id': str(user.id),
            'identifier': user.identifier,
            'created_at': user.created_at
        })
    
    if request.method == "PUT":
        data = json.loads(request.body)

        new_identifier = data.get('identifier', user.identifier)

        # Check if the new identifier already exists for another user
        if UserIdentifier.objects.filter(identifier=new_identifier).exclude(id=user.id).exists():
            return JsonResponse({'error': 'Identifier already exists'}, status=400)
        user.identifier = data.get('identifier', user.identifier)
        user.save()
        return JsonResponse({'message': 'UserIdentifier updated successfully'})
    
    if request.method == "DELETE":
        user.delete()
        return JsonResponse({'message': 'UserIdentifier deleted successfully'})
    
@csrf_exempt
def event_list(request):
    """List all events or create/update an event"""
    if request.method == "POST":
        data = json.loads(request.body)
        try:
            # user_id is the identifier string (with dashes) - look up by identifier field
            user = UserIdentifier.objects.get(identifier=data['user_id'])
            
            # paragraph_id is UUID without dashes - convert to UUID object
            paragraph_uuid = uuid.UUID(data['paragraph_id'])
            paragraph = Paragraph.objects.get(id=paragraph_uuid)
            
        except UserIdentifier.DoesNotExist:
            return JsonResponse({'error': 'UserIdentifier not found'}, status=404)
        except Paragraph.DoesNotExist:
            return JsonResponse({'error': 'Paragraph not found'}, status=404)
        except (ValueError, KeyError) as e:
            return JsonResponse({'error': f'Invalid data: {str(e)}'}, status=400)
        
        # Get or create event for this user-paragraph pair
        event, created = Event.objects.get_or_create(
            user=user,
            paragraph=paragraph
        )
        
        # Update only the provided flags
        if 'is_liked' in data:
            event.is_liked = data['is_liked']
        if 'is_disliked' in data:
            event.is_disliked = data['is_disliked']
        if 'is_hearted' in data:
            event.is_hearted = data['is_hearted']
        if 'is_bookmarked' in data:
            event.is_bookmarked = data['is_bookmarked']
        
        event.save()
        
        return JsonResponse({
            'id': str(event.id),
            'message': 'Event created successfully' if created else 'Event updated successfully',
            'is_liked': event.is_liked,
            'is_disliked': event.is_disliked,
            'is_hearted': event.is_hearted,
            'is_bookmarked': event.is_bookmarked
        }, status=201 if created else 200)
    
    events = Event.objects.all().values()
    return JsonResponse(list(events), safe=False)


@csrf_exempt
def event_detail(request, event_id):
    """Retrieve, update or delete an event."""
    try:
        event = Event.objects.get(id=event_id)
    except Event.DoesNotExist:
        return JsonResponse({'error': 'Event not found'}, status=404)

    if request.method == "GET":
        return JsonResponse({
            'id': str(event.id),
            'user_id': str(event.user.id),
            'paragraph_id': str(event.paragraph.id),
            'is_liked': event.is_liked,
            'is_disliked': event.is_disliked,
            'is_hearted': event.is_hearted,
            'is_bookmarked': event.is_bookmarked,
            'created_at': event.created_at,
            'updated_at': event.updated_at
        })
    
    if request.method == "PUT":
        data = json.loads(request.body)
        if 'is_liked' in data:
            event.is_liked = data['is_liked']
        if 'is_disliked' in data:
            event.is_disliked = data['is_disliked']
        if 'is_hearted' in data:
            event.is_hearted = data['is_hearted']
        if 'is_bookmarked' in data:
            event.is_bookmarked = data['is_bookmarked']
        event.save()
        return JsonResponse({'message': 'Event updated successfully'})
    
    if request.method == "DELETE":
        event.delete()
        return JsonResponse({'message': 'Event deleted successfully'})


@csrf_exempt
def get_user_paragraph_event(request, user_id, paragraph_id):
    """Get a specific user's interactions with a paragraph"""
    if request.method == "GET":
        try:
            user = UserIdentifier.objects.get(identifier=user_id)
            paragraph_uuid = uuid.UUID(paragraph_id)
            paragraph = Paragraph.objects.get(id=paragraph_uuid)
            
        except UserIdentifier.DoesNotExist:
            return JsonResponse({'error': 'UserIdentifier not found'}, status=404)
        except Paragraph.DoesNotExist:
            return JsonResponse({'error': 'Paragraph not found'}, status=404)
        except (ValueError, KeyError) as e:
            return JsonResponse({'error': f'Invalid data: {str(e)}'}, status=400)
        
        try:
            event = Event.objects.get(user=user, paragraph=paragraph)
            return JsonResponse({
                'id': str(event.id),
                'user_id': user_id,  # Return the identifier, not the UUID
                'paragraph_id': paragraph_id,  # Return the paragraph UUID without dashes
                'is_liked': event.is_liked,
                'is_disliked': event.is_disliked,
                'is_hearted': event.is_hearted,
                'is_bookmarked': event.is_bookmarked,
                'created_at': event.created_at,
                'updated_at': event.updated_at
            })
        except Event.DoesNotExist:
            # No interaction yet - return default false values
            return JsonResponse({
                'user_id': user_id,
                'paragraph_id': paragraph_id,
                'is_liked': False,
                'is_disliked': False,
                'is_hearted': False,
                'is_bookmarked': False
            })
    return JsonResponse({'error': 'Invalid HTTP method'}, status=405)
    


@csrf_exempt
def get_random_paragraphs(request):
    """Retrieve 5 random paragraphs with user's interaction data"""
    if request.method == "GET":
        # Get user_id from query parameters
        user_identifier = request.GET.get('user_id')
        
        paragraphs = list(Paragraph.objects.all())
        if not paragraphs:
            return JsonResponse({'error': 'No paragraphs available'}, status=404)
        
        # Select up to 5 random paragraphs
        import random
        selected_paragraphs = random.sample(paragraphs, min(5, len(paragraphs)))
        
        # Get user object if user_id provided
        user = None
        if user_identifier:
            try:
                user = UserIdentifier.objects.get(identifier=user_identifier)
            except UserIdentifier.DoesNotExist:
                pass
        
        result = []
        for p in selected_paragraphs:
            # Count events for this paragraph
            likes = Event.objects.filter(paragraph=p, is_liked=True).count()
            dislikes = Event.objects.filter(paragraph=p, is_disliked=True).count()
            hearts = Event.objects.filter(paragraph=p, is_hearted=True).count()
            bookmarks = Event.objects.filter(paragraph=p, is_bookmarked=True).count()

            # Get user's specific interactions if user exists
            user_interactions = {
                'is_liked': False,
                'is_disliked': False,
                'is_hearted': False,
                'is_bookmarked': False
            }
            
            if user:
                try:
                    event = Event.objects.get(user=user, paragraph=p)
                    user_interactions = {
                        'is_liked': event.is_liked,
                        'is_disliked': event.is_disliked,
                        'is_hearted': event.is_hearted,
                        'is_bookmarked': event.is_bookmarked
                    }
                except Event.DoesNotExist:
                    pass

            result.append({
                "paragraph_id": str(p.id).replace('-', ''),
                "content": p.content,
                "created_at": p.created_at,

                # book details
                "book": {
                    "book_id": str(p.book.id).replace('-', ''),
                    "title": p.book.title,
                    "author": p.book.author
                },

                # event counts
                "stats": {
                    "likes": likes,
                    "dislikes": dislikes,
                    "hearts": hearts,
                    "bookmarks": bookmarks
                },
                
                # User's specific interactions
                "user_interactions": user_interactions
            })

        return JsonResponse(result, safe=False)
    return JsonResponse({'error': 'Invalid HTTP method'}, status=405)


# function to fetch the bookmarked paragraphs according to the user identifier id which comes from the frontend

@csrf_exempt
def get_user_bookmarked_paragraphs(request, user_identifier):
    """
    GET /events/user/<user_identifier>/bookmarked-paragraphs/?page=1
    Resolve the identifier to the internal user id and return bookmarked paragraphs
    for that user id with pagination.
    """
    if request.method != "GET":
        return JsonResponse({'error': 'Invalid HTTP method'}, status=405)

    try:
        # Resolve identifier to the internal user record and id
        user = UserIdentifier.objects.get(identifier=user_identifier)
    except UserIdentifier.DoesNotExist:
        return JsonResponse({'error': f' {user_identifier} hey i am here UserIdentifier not found'}, status=404)

    user_id = user.id

    # Pagination parameters
    try:
        page = int(request.GET.get('page', 1))
        if page < 1:
            page = 1
    except ValueError:
        page = 1

    page_size = 10  # Items per page

    # Query by user_id (internal primary key) for bookmarked events
    events_queryset = Event.objects.filter(user_id=user_id, is_bookmarked=True).select_related('paragraph__book').order_by('-created_at')

    # Calculate pagination
    total_count = events_queryset.count()
    total_pages = (total_count + page_size - 1) // page_size  # Ceiling division

    # Slice the queryset for the current page
    start_index = (page - 1) * page_size
    end_index = start_index + page_size
    events = events_queryset[start_index:end_index]

    result = []
    for ev in events:
        p = ev.paragraph
        likes = Event.objects.filter(paragraph=p, is_liked=True).count()
        dislikes = Event.objects.filter(paragraph=p, is_disliked=True).count()
        hearts = Event.objects.filter(paragraph=p, is_hearted=True).count()
        bookmarks = Event.objects.filter(paragraph=p, is_bookmarked=True).count()

        result.append({
            "paragraph_id": str(p.id).replace('-', ''),
            "content": p.content,
            "created_at": p.created_at.isoformat() if hasattr(p.created_at, 'isoformat') else str(p.created_at),
            "book": {
                "book_id": str(p.book.id).replace('-', ''),
                "title": p.book.title,
                "author": p.book.author
            },
            "stats": {
                "likes": likes,
                "dislikes": dislikes,
                "hearts": hearts,
                "bookmarks": bookmarks
            },
            "user_interactions": {
                "is_liked": ev.is_liked,
                "is_disliked": ev.is_disliked,
                "is_hearted": ev.is_hearted,
                "is_bookmarked": ev.is_bookmarked
            }
        })

    return JsonResponse({
        "results": result,
        "pagination": {
            "current_page": page,
            "total_pages": total_pages,
            "total_count": total_count,
            "page_size": page_size,
            "has_next": page < total_pages,
            "has_previous": page > 1
        }
    }, safe=False)

@require_http_methods(["GET"])
def proxy_gutenberg(request):
    """Proxy requests to Project Gutenberg to handle CORS"""
    url = request.GET.get('url')
    
    if not url:
        return JsonResponse({'error': 'Missing url parameter'}, status=400)
    
    # Validate it's a Gutenberg URL
    if not url.startswith('https://www.gutenberg.org/'):
        return JsonResponse({'error': 'Invalid URL'}, status=400)
    
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        return HttpResponse(response.content, content_type='text/plain')
    except requests.RequestException as e:
        return JsonResponse({'error': f'Failed to fetch: {str(e)}'}, status=500)


