import { supabase } from "../auth/supabaseClient";

export function subscribeToMessages(
  matchId: string,
  onMessage: (msg: any) => void
) {
  console.log("🎧 Setting up realtime subscription for match:", matchId);
  
  const channel = supabase
    .channel(`match:${matchId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "Message",
        filter: `matchId=eq.${matchId}`
      },
      payload => {
        console.log("Realtime event received!");
        console.log("  - Event type:", payload.eventType);
        console.log("  - New message:", payload.new);
        onMessage(payload.new);
      }
    )
    .subscribe((status, err) => {
      console.log("Subscription status:", status);
      if (err) {
        console.error("Subscription error:", err);
      }
    });

  return () => {
    console.log("🔌 Unsubscribing from channel");
    supabase.removeChannel(channel);
  };
}