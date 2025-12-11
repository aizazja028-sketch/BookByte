import json
from decouple import config
from openai import OpenAI

class OpenAIService:
    """Secure OpenAI API service (backend only) - using OpenAI SDK"""

    def __init__(self):
        self.api_key = config('OPENAI_API_KEY')
        # Try to get model from env, fallback to gpt-4o
        self.model = config('OPENAI_MODEL', default='gpt-4o')
        self.client = OpenAI(api_key=self.api_key)
        print(f"OpenAI Service initialized with model: {self.model}")

    def process_book_text(self, book_text: str, chunk_index: int = 1, total_chunks: int = 1) -> dict:
        """
        Process book text and extract paragraphs
        Uses same chunking logic as frontend: simple 200KB character chunks
        Returns: {'paragraphs': [...], 'status': 'success'}
        """
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY not configured")

        # Reduce chunk size to fit within gpt-4o's 128k INPUT token limit
        # 200KB = ~50k tokens, but with prompt overhead it exceeds 128k
        # Using 100KB chunks (~25k tokens) to stay safely under the limit
        chunk_size = 100000
        text_chunks = self._chunk_book_text(book_text, chunk_size)
        all_paragraphs = []

        print(f"Book text split into {len(text_chunks)} chunks of ~{chunk_size / 1000}KB each")

        for sub_chunk_index, text_chunk in enumerate(text_chunks, 1):
            print(f"Processing chunk {sub_chunk_index}/{len(text_chunks)}, size: {round(len(text_chunk) / 1000)}KB")

            paragraphs = self._process_single_chunk(
                text_chunk,
                chunk_index,
                total_chunks,
                sub_chunk_index,
                len(text_chunks)
            )

            all_paragraphs.extend(paragraphs)
            print(f"Chunk {sub_chunk_index}: Extracted {len(paragraphs)} paragraphs (Total so far: {len(all_paragraphs)})")

        return {
            'status': 'success',
            'paragraphs': all_paragraphs,
            'total_paragraphs': len(all_paragraphs),
        }

    def _chunk_book_text(self, text: str, chunk_size: int = 200000) -> list:
        """
        EXACT SAME LOGIC AS FRONTEND:
        const chunks: string[] = [];
        let currentIndex = 0;
        while (currentIndex < text.length) {
            const chunk = text.substring(currentIndex, currentIndex + chunkSize);
            chunks.push(chunk);
            currentIndex += chunkSize;
        }
        """
        chunks = []
        current_index = 0

        while current_index < len(text):
            chunk = text[current_index:current_index + chunk_size]
            chunks.append(chunk)
            current_index += chunk_size

        return chunks

    def _process_single_chunk(self, book_text: str, chunk_index: int, total_chunks: int, sub_index: int, sub_total: int) -> list:
        """Process a single chunk using OpenAI SDK - EXACT SAME AS FRONTEND"""

        # EXACT same prompt as frontend
        prompt = f"""You are a text processing assistant. Analyze the following book text and extract all paragraphs.

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
{{
  "paragraphs": [
    "First paragraph text here...",
    "Second paragraph text here..."
  ]
}}

Book text (Chunk {sub_index}/{sub_total}):
{book_text}"""

        try:
            # OpenAI call with timeout
            print(f"Calling OpenAI API with model: {self.model}")

            try:
                completion = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    max_completion_tokens=16000,  # Maximum supported by most models
                    timeout=180  # 3 minute timeout for API call
                )
            except Exception as api_error:
                print(f"OpenAI API Error: {str(api_error)}")
                raise Exception(f"OpenAI API call failed: {str(api_error)}")

            text_content = completion.choices[0].message.content or ""
            finish_reason = completion.choices[0].finish_reason

            print(f"Chunk {sub_index} response length: {len(text_content)}")
            print(f"Chunk {sub_index} finish reason: {finish_reason}")

            # If response is empty, this is a critical error
            if not text_content or len(text_content) == 0:
                error_msg = f"OpenAI returned empty response. Model: {self.model}, Finish reason: {finish_reason}"
                print(f"ERROR: {error_msg}")
                raise Exception(error_msg)

            # Check if response is just plain text (no JSON) - this means the chunk had no extractable paragraphs
            if '{' not in text_content or 'paragraphs' not in text_content:
                print(f"WARNING: Chunk {sub_index} contains no extractable paragraphs (metadata/dedication/etc). Skipping.")
                return []  # Return empty list for chunks with no paragraphs

            if finish_reason == "length":
                print(f"WARNING: Chunk {sub_index}/{sub_total} response was truncated, but continuing with partial results...")

            # EXACT same JSON parsing logic as frontend
            parsed_response = None
            try:
                parsed_response = json.loads(text_content)
            except json.JSONDecodeError as parse_error:
                print(f"Failed to parse JSON for chunk {sub_index}/{sub_total}: {parse_error}")
                print(f"Response preview (first 500 chars): {text_content[:500]}")

                json_text = text_content

                # Try markdown code blocks
                if '```json' in text_content:
                    import re
                    json_match = re.search(r'```json\s*([\s\S]*?)\s*```', text_content)
                    if json_match:
                        json_text = json_match.group(1)
                        print("Extracted JSON from ```json block")
                elif '```' in text_content:
                    import re
                    json_match = re.search(r'```\s*([\s\S]*?)\s*```', text_content)
                    if json_match:
                        json_text = json_match.group(1)
                        print("Extracted JSON from ``` block")

                # Extract JSON object - try to find the most complete JSON
                import re

                # First, try to find JSON with proper structure
                json_object_match = re.search(r'\{\s*"paragraphs"\s*:\s*\[[\s\S]*?\]\s*\}', json_text)

                if not json_object_match:
                    # Fallback: try any JSON object
                    json_object_match = re.search(r'\{[\s\S]*\}', json_text)

                if not json_object_match:
                    print("Full response text:", text_content)
                    print("Could not find any JSON object in response")
                    # If no JSON found but response has content, treat as no extractable paragraphs
                    if text_content and len(text_content) > 0:
                        print(f"WARNING: Chunk {sub_index} - treating as non-narrative content")
                        return []
                    raise Exception(f"Could not extract JSON from OpenAI response for chunk {sub_index}")

                try:
                    json_str = json_object_match.group(0)
                    # Try to fix common JSON issues - incomplete arrays
                    if json_str.count('[') > json_str.count(']'):
                        json_str = json_str + ']' * (json_str.count('[') - json_str.count(']'))
                    if json_str.count('{') > json_str.count('}'):
                        json_str = json_str + '}' * (json_str.count('{') - json_str.count('}'))

                    parsed_response = json.loads(json_str)
                    print("Successfully parsed JSON after extraction")
                except json.JSONDecodeError as e2:
                    print(f"Failed to parse extracted JSON: {e2}")
                    print(f"Extracted JSON preview: {json_object_match.group(0)[:500]}")
                    print(f"Full response for debugging: {text_content}")
                    # Treat as non-narrative content instead of crashing
                    return []

            if not parsed_response or not parsed_response.get('paragraphs') or not isinstance(parsed_response['paragraphs'], list):
                raise Exception(f"Invalid response format for chunk {sub_index} - missing paragraphs array")

            return parsed_response['paragraphs']

        except Exception as e:
            print(f"EXCEPTION in _process_single_chunk: {str(e)}")
            print(f"Exception type: {type(e).__name__}")
            import traceback
            traceback.print_exc()
            raise Exception(f"Failed to process chunk {sub_index}/{sub_total}: {str(e)}")
