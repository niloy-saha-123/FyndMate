import { supabase } from "../auth/supabaseClient";

export function subscribeToMessages(
  matchId: string,
  onEvent: (event: "upsert" | "delete", msg: any) => void
) {
  console.log("🎧 Realtime for match:", matchId);

  const channel = supabase
    .channel(`match:${matchId}`)

    // 📨 INSERT
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

    // ✏️ UPDATE
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

    // COMMENTED OUT THE DELETE FUNCTION
    // // 🗑️ DELETE
    // .on(
    //   "postgres_changes",
    //   {
    //     event: "DELETE",
    //     schema: "public",
    //     table: "Message",
    //     filter: `matchId=eq.${matchId}`,
    //   },
    //   payload => {
    //     onEvent("delete", payload.old);
    //   }
    // )

    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
