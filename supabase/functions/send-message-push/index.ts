import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    console.log("🚀 Notification function triggered");
    const { record } = await req.json();

    if (!record) {
      console.log("❌ No record provided");
      return new Response("No record provided", { status: 400 });
    }

    const {
      matchId,
      senderId,
      content
    } = record;

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
      return new Response("Match not found", { status: 200 });
    }

    console.log("✅ Match found:", match);

    if (match.status !== "active") {
      console.log("❌ Match inactive");
      return new Response("Match inactive", { status: 200 });
    }

    if (match.blockedBy) {
      console.log("❌ Match blocked");
      return new Response("Match blocked", { status: 200 });
    }

    // 4️⃣ Determine receiver
    const receiverId =
      match.user1Id === senderId
        ? match.user2Id
        : match.user1Id;

    if (!receiverId || receiverId === senderId) {
      console.log("❌ Invalid receiver");
      return new Response("Invalid receiver", { status: 200 });
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
      return new Response("Notifications muted", { status: 200 });
    }

    if (match.blockedBy === receiverId) {
      console.log("❌ Receiver blocked sender");
      return new Response("Receiver blocked sender", { status: 200 });
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
      return new Response("No push token", { status: 200 });
    }

    const senderName = sender?.name ?? "New message";
    console.log(`📱 Sending to push token: ${receiver.pushToken}`);

    const response = await fetch(
      "https://exp.host/--/api/v2/push/send",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: receiver.pushToken,
          sound: "default",
          title: senderName,
          body: content,
          data: { matchId }
        })
      }
    );

    const result = await response.json();
    console.log("✅ Expo response:", result);

    return new Response("Push sent", { status: 200 });

  } catch (error) {
    console.error("❌ Push function error:", error);
    return new Response("Internal error", { status: 500 });
  }
});
