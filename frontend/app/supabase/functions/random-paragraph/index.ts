import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    console.log('Fetching random paragraph...');

    // Get total count of paragraphs
    const { count, error: countError } = await supabase
      .from('paragraphs')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Error counting paragraphs:', countError);
      throw countError;
    }

    if (!count || count === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No paragraphs available. Please add some books to the database.' 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get a random offset
    const randomOffset = Math.floor(Math.random() * count);

    // Fetch one paragraph at random offset with book details
    const { data: paragraphs, error } = await supabase
      .from('paragraphs')
      .select(`
        id,
        text,
        books (
          id,
          title,
          author,
          language
        )
      `)
      .range(randomOffset, randomOffset)
      .limit(1);

    if (error) {
      console.error('Error fetching paragraph:', error);
      throw error;
    }

    if (!paragraphs || paragraphs.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No paragraph found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const paragraph = paragraphs[0];
    console.log('Successfully fetched random paragraph');

    return new Response(
      JSON.stringify({
        id: paragraph.id,
        text: paragraph.text,
        book: paragraph.books
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in random-paragraph function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
