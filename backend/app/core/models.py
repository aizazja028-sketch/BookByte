from django.db import models
import uuid

class Book(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    author = models.CharField(max_length=100)
    published_date = models.DateField()
    language = models.CharField(max_length=50)
    source = models.URLField()
    created_at = models.DateTimeField(auto_now_add=True)    

    def __str__(self):
        return self.title
class Paragraph(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    book = models.ForeignKey(Book, related_name='paragraphs', on_delete=models.CASCADE)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)    

   
    def __str__(self):
        return f'Paragraph of {self.book.title}'


class UserIdentifier(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    identifier = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)    

    def __str__(self):
        return self.identifier

class Event(models.Model):
    id=models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(UserIdentifier, related_name='events', on_delete=models.CASCADE)
    paragraph = models.ForeignKey(Paragraph, related_name='events', on_delete=models.CASCADE)
    is_liked = models.BooleanField(default=False)
    is_disliked = models.BooleanField(default=False)
    is_hearted = models.BooleanField(default=False)
    is_bookmarked = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['user', 'paragraph']
    
    def __str__(self):
        return f'Event for User {self.user.identifier} on Paragraph {self.paragraph.id}'