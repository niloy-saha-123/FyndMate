import { supabase } from "../auth/supabaseClient";

type MessageEvent = "upsert" | "delete" | "match_inactive";

export function subscribeToMessages(
  matchId: string,
  onEvent: (event: MessageEvent, payload: any) => void
) {
  console.log("Realtime for match:", matchId);

  const channel = supabase
    .channel(`match:${matchId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "Message",
        filter: `matchId=eq.${matchId}`,
      },
      payload => {
        onEvent("upsert", payload.new);
      }
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "Message",
        filter: `matchId=eq.${matchId}`,
      },
      payload => {
        onEvent("upsert", payload.new);
      }
    )
    .on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "Message",
        filter: `matchId=eq.${matchId}`,
      },
      payload => {
        onEvent("delete", payload.old);
      }
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "Match",
        filter: `id=eq.${matchId}`,
      },
      payload => {
        const updated = payload.new;

        if (updated.status !== "active") {
          console.log("🚫 Match became inactive:", updated.status);
          onEvent("match_inactive", updated);
        }
      }
    )

    .subscribe();

  return () => {
    console.log("🔌 Unsubscribing from match:", matchId);
    supabase.removeChannel(channel);
  };
}
