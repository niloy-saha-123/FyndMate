import { supabase } from "../auth/supabaseClient";

export function subscribeToMessages(
  matchId: string,
  onUpsert: (msg: any) => void
) {
  console.log("🎧 Setting up realtime subscription for match:", matchId);

  const channel = supabase
    .channel(`match:${matchId}`)

    // 🔹 NEW MESSAGE
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "Message",
        filter: `matchId=eq.${matchId}`,
      },
      payload => {
        console.log("📨 INSERT event");
        console.log("New message:", payload.new);
        onUpsert(payload.new);
      }
    )

    // ✏️ EDIT MESSAGE
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "Message",
        filter: `matchId=eq.${matchId}`,
      },
      payload => {
        console.log("✏️ UPDATE event");
        console.log("Updated message:", payload.new);
        onUpsert(payload.new);
      }
    )

    .subscribe(status => {
      console.log("Subscription status:", status);
    });

  // ✅ Correct unsubscribe pattern (NO `.unsubscribe()`)
  return () => {
    console.log("🔌 Unsubscribing from match:", matchId);
    supabase.removeChannel(channel);
  };
}
