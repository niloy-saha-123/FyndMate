import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("🚀 Notification function triggered");
    
    let record;
    try {
      const body = await req.json();
      record = body.record;
    } catch (parseError) {
      console.error("❌ Failed to parse request body:", parseError);
      return new Response("Invalid JSON body", { status: 400, headers: corsHeaders });
    }

    if (!record) {
      console.log("❌ No record provided");
      return new Response("No record provided", { status: 400, headers: corsHeaders });
    }

    const {
      matchId,
      senderId,
      content
    } = record;

    if (!matchId || !senderId) {
      console.log("❌ Missing required fields:", { matchId, senderId });
      return new Response("Missing matchId or senderId", { status: 400, headers: corsHeaders });
    }

    console.log(`📨 Processing message from ${senderId} in match ${matchId}`);

    // 2️⃣ Create Supabase client using service role
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: match, error: matchError } = await supabase
      .from("Match")
      .select("user1Id, user2Id, status, blockedBy")
      .eq("id", matchId)
      .single();

    if (matchError || !match) {
      console.log("❌ Match not found:", matchError);
      return new Response("Match not found", { status: 200, headers: corsHeaders });
    }

    console.log("✅ Match found:", match);

    if (match.status !== "active") {
      console.log("❌ Match inactive");
      return new Response("Match inactive", { status: 200, headers: corsHeaders });
    }

    if (match.blockedBy) {
      console.log("❌ Match blocked");
      return new Response("Match blocked", { status: 200, headers: corsHeaders });
    }

    // 4️⃣ Determine receiver
    const receiverId =
      match.user1Id === senderId
        ? match.user2Id
        : match.user1Id;

    if (!receiverId || receiverId === senderId) {
      console.log("❌ Invalid receiver");
      return new Response("Invalid receiver", { status: 200, headers: corsHeaders });
    }

    console.log(`👤 Receiver ID: ${receiverId}`);

    const { data: pref } = await supabase
      .from("MatchNotificationPreference")
      .select("enabled")
      .eq("matchId", matchId)
      .eq("userId", receiverId)
      .maybeSingle();

    if (pref && pref.enabled === false) {
      console.log("❌ Notifications muted for this user");
      return new Response("Notifications muted", { status: 200, headers: corsHeaders });
    }

    if (match.blockedBy === receiverId) {
      console.log("❌ Receiver blocked sender");
      return new Response("Receiver blocked sender", { status: 200, headers: corsHeaders });
    }

    // 6️⃣ Fetch sender name + receiver push token
    const [{ data: sender }, { data: receiver }] = await Promise.all([
      supabase
        .from("User")
        .select("name")
        .eq("id", senderId)
        .single(),
      supabase
        .from("User")
        .select("pushToken")
        .eq("id", receiverId)
        .single()
    ]);

    if (!receiver?.pushToken) {
      console.log("❌ No push token for receiver");
      return new Response("No push token", { status: 200, headers: corsHeaders });
    }

    const senderName = sender?.name ?? "New message";
    console.log(`📱 Sending to push token: ${receiver.pushToken}`);

    const response = await fetch(
      "https://exp.host/--/api/v2/push/send",
      {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Accept-Encoding": "gzip, deflate"
        },
        body: JSON.stringify({
          to: receiver.pushToken,
          sound: "default",
          title: senderName,
          body: (content && content.trim()) ? content.trim().slice(0, 200) : "New message",
          data: { type: "message", matchId, senderId },
          priority: "high",
          channelId: "default"
        })
      }
    );

    const result = await response.json();
    console.log("✅ Expo response:", JSON.stringify(result));

    // Check for Expo push errors
    if (result.data?.status === "error") {
      console.error("❌ Expo push error:", result.data.message);
      return new Response(`Push error: ${result.data.message}`, { status: 200, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true, result }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error) {
    console.error("❌ Push function error:", error);
    return new Response(JSON.stringify({ error: String(error) }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
