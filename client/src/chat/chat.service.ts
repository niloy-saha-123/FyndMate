import { supabase } from "../auth/supabaseClient";

export async function getMyMatches() {
  const { data, error } = await supabase
    .from("Match")
    .select(`
      id,
      createdAt,
      user1Id,
      user2Id,
      User1:User!Match_user1Id_fkey(id, name, profilePicture),
      User2:User!Match_user2Id_fkey(id, name, profilePicture)
    `)
    .order("createdAt", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getMessages(matchId: string) {
  const { data, error } = await supabase
    .from("Message")
    .select("*")
    .eq("matchId", matchId)
    .order("createdAt", { ascending: true });

  if (error) throw error;
  return data;
}

export async function editMessage(messageId: string, content: string) {
  const { data, error } = await supabase
    .from("Message")
    .update({
      content,
      editedAt: new Date().toISOString(),
    })
    .eq("id", messageId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteMessage(messageId: string) {
  const { error } = await supabase
    .from("Message")
    .delete()
    .eq("id", messageId);

  if (error) throw error;
}

export async function sendMessage(matchId: string, content: string) {
  const { data, error } = await supabase
    .from("Message")
    .insert({ matchId, content })
    .select()
    .single();

  if (error) throw error;
  return data;
}
