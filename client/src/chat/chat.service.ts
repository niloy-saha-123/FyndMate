import { supabase } from "../auth/supabaseClient";
import { apiClient } from "../lib/apiClient";

export async function getMyMatches(userId: string) {
  const response = await apiClient.get<{ data: any[] }>("/api/matches");

  return response.data.map(match => {
    const lastMessage = match.messages?.[0] ?? null;

    const unreadCount =
      match.messages?.filter(
        (m: any) => m.readAt === null && m.senderId !== userId
      ).length ?? 0;

    return {
      ...match,
      lastMessage,
      unreadCount
    };
  });
}

export async function unblockMatch(matchId: string) {
  const { data, error } = await supabase
    .from("Match")
    .update({
      status: "active",
      blockedBy: null
    })
    .eq("id", matchId)
    .select();

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

export async function sendMessage(
    matchId: string,
    content: string,
    senderId: string
  ){

  const { data: match, error: matchError } = await supabase
    .from("Match")
    .select("status, blockedBy")
    .eq("id", matchId)
    .single();

  if (matchError) throw matchError;
  
  if (match.status !== "active") {
    throw new Error("Cannot send message - match is not active");
  }

  const { data, error } = await supabase
    .from("Message")
    .insert({ matchId, content, senderId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function editMessage(messageId: string, content: string){
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

export async function hideMatch(matchId: string) {
  const { error } = await supabase
    .from("Match")
    .update({ status: "hidden" })
    .eq("id", matchId);

  if (error) throw error;
}

export async function blockMatch(matchId: string, userId: string) {
  console.log("Attempting to block match:", matchId, "by user:", userId);
  
  const { data, error } = await supabase
    .from("Match")
    .update({
      status: "blocked",
      blockedBy: userId
    })
    .eq("id", String(matchId)) 
    .select();

  if (error) {
    console.error("Block error:", error);
    throw error;
  }
  
  console.log("Block result:", data);
  
  if (!data || data.length === 0) {
    console.warn("No match was updated - check if match exists and RLS allows access");
  }
  
  return data;
}