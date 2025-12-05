from django.test import TestCase

# Create your tests here.
# from django.test import TestCase, Client
# from .models import UserIdentifier, Book, Paragraph, Event
# import uuid

# class BookmarkedParagraphsAPITest(TestCase):
#     def setUp(self):
#         self.client = Client()
#         # create user + book + paragraph + bookmark
#         self.user = UserIdentifier.objects.create(identifier=str(uuid.uuid4()))
#         self.book = Book.objects.create(title='T', author='A', published_date='2020-01-01', language='en', source='src')
#         self.par = Paragraph.objects.create(book=self.book, content='hello world')
#         Event.objects.create(user=self.user, paragraph=self.par, is_bookmarked=True)

#     def test_get_bookmarked_paragraphs(self):
#         url = f'/events/user/{self.user.id}/bookmarked-paragraphs/'
#         resp = self.client.get(url)
#         self.assertEqual(resp.status_code, 200)
#         data = resp.json()
#         self.assertTrue(isinstance(data, list))
#         self.assertEqual(len(data), 1)
#         self.assertEqual(data[0]['paragraph_id'], str(self.par.id).replace('-', ''))