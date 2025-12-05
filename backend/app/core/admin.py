from django.contrib import admin

# Register your models here.
from django.contrib import admin
from .models import Book, Paragraph, UserIdentifier, Event

admin.site.register(Book)
admin.site.register(Paragraph)
admin.site.register(UserIdentifier)
admin.site.register(Event)
