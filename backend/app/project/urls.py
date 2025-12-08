"""
URL configuration for project project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path
from core import views

urlpatterns = [
    path('admin/', admin.site.urls),


    # Crud for books
    path('books/',views.book_list,name='book-list'),
    path('books/<uuid:book_id>/',views.book_detail,name='book-detail'),
    

    # Crud for paragraphs 
    path('paragraphs/',views.paragraph_list,name='paragraph-list'),
    path('paragraphs/<uuid:paragraph_id>/',views.paragraph_detail,name='paragraph-detail'),
    
    # Get random paragraphs
    path('paragraphs/random/',views.get_random_paragraphs,name='random-paragraphs'),

    # user identifier endpoints
    path('users/',views.useridentifier_list,name='useridentifier-list'),
    path('users/<uuid:user_id>/',views.useridentifier_detail,name='useridentifier-detail'),
    

    # events endpoints
    path('events/',views.event_list,name='event-list'),
    path('events/<uuid:event_id>/',views.event_detail,name='event-detail'),
    path('events/user/<uuid:user_id>/paragraph/<uuid:paragraph_id>/',views.get_user_paragraph_event,name='user-paragraph-event'),
    path('events/user/<str:user_identifier>/bookmarked-paragraphs/', views.get_user_bookmarked_paragraphs, name='user-bookmarked-paragraphs'),
    path('proxy/gutenberg/', views.proxy_gutenberg, name='proxy-gutenberg'),

]

