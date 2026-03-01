import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// NOTE: Push delivery is now handled in the Fastify API.
// This edge function is kept as a stub so existing references won't break,
// but it returns a 410 to signal deprecation.
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({ error: "push moved to API" }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
