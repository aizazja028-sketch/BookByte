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

    const { user_id, paragraph_id, event_type } = await req.json();

    console.log('Tracking event:', { user_id, paragraph_id, event_type });

    // Validate required fields
    if (!user_id || !paragraph_id || !event_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: user_id, paragraph_id, event_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate event type
    const validEventTypes = ['heart', 'like', 'dislike', 'bookmark', 'copy'];
    if (!validEventTypes.includes(event_type)) {
      return new Response(
        JSON.stringify({ error: `Invalid event_type. Must be one of: ${validEventTypes.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ensure user identifier exists
    const { data: existingUser } = await supabase
      .from('user_identifiers')
      .select('id')
      .eq('id', user_id)
      .single();

    if (!existingUser) {
      // Create user identifier if it doesn't exist
      const { error: userError } = await supabase
        .from('user_identifiers')
        .insert({ id: user_id });

      if (userError) {
        console.error('Error creating user identifier:', userError);
        throw userError;
      }
    }

    // Insert event
    const { data, error } = await supabase
      .from('events')
      .insert({
        user_identifier_id: user_id,
        paragraph_id,
        event_type
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting event:', error);
      throw error;
    }

    console.log('Event tracked successfully:', data);

    return new Response(
      JSON.stringify({ success: true, event: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in track-event function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
