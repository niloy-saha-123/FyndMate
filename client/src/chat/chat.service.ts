import { supabase } from "../auth/supabaseClient";

export async function getMyMatches(userId: string) {
  const { data, error } = await supabase
    .from("Match")
    .select(`
      id,
      createdAt,
      status,
      user1Id,
      user2Id,
      User1:User!Match_user1Id_fkey(id, name, profilePicture),
      User2:User!Match_user2Id_fkey(id, name, profilePicture),
      messages:Message(
        id,
        content,
        senderId,
        createdAt,
        readAt
      )
    `)
    .or(`user1Id.eq.${userId},user2Id.eq.${userId}`)
    .in("status", ["active", "blocked"])
    .order("createdAt", { ascending: false })
    .order("createdAt", { foreignTable: "messages", ascending: false });

  if (error) throw error;

  return data.map(match => {
    const lastMessage = match.messages?.[0] ?? null;

    const unreadCount =
      match.messages?.filter(
        m => m.readAt === null && m.senderId !== userId
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
      status: "active"
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
    .select("status")
    .eq("id", matchId)
    .single();

  if (matchError) throw matchError;
  
  if (match.status !== "active") {
    throw new Error("Cannot send message - match is not active");
  }

  const { data, error } = await supabase
    .from("Message")
    .insert({ 
      matchId, 
      content, 
      senderId
    })
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
    .update({ status: "unmatched" })
    .eq("id", matchId);

  if (error) throw error;
}

/**
 * Block a match by creating a Block record and updating match status.
 */
export async function blockMatch(matchId: string, userId: string) {
  console.log("Attempting to block match:", matchId, "by user:", userId);
  
  // First, get the match to find the other user
  const { data: match, error: matchError } = await supabase
    .from("Match")
    .select("user1Id, user2Id")
    .eq("id", matchId)
    .single();

  if (matchError) {
    console.error("Error fetching match:", matchError);
    throw matchError;
  }

  const blockedId = match.user1Id === userId ? match.user2Id : match.user1Id;

  // Create block record
  const { error: blockError } = await supabase
    .from("Block")
    .upsert({
      blockerId: userId,
      blockedId: blockedId,
    }, {
      onConflict: 'blockerId,blockedId'
    });

  if (blockError) {
    console.error("Error creating block:", blockError);
    throw blockError;
  }

  // Update match status
  const { data, error } = await supabase
    .from("Match")
    .update({
      status: "blocked"
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