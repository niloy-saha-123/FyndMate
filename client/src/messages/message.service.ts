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

export async function getMatchStatus(
  matchId: string
): Promise<{ status: string; blockedBy: string | null; otherUserId: string }> {
  return apiClient.get(`/api/matches/${matchId}`);
}

export async function unblockMatch(matchId: string) {
  return apiClient.post(`/api/matches/${matchId}/unblock`);
}

export async function getMessages(matchId: string) {
  return apiClient.get<any[]>(`/api/matches/${matchId}/messages`);
}

export async function sendMessage(matchId: string, content: string) {
  const message = await apiClient.post<{
    id: string;
    matchId: string;
    senderId: string;
    content: string;
    createdAt: string;
    readAt: null;
    editedAt: null;
  }>(`/api/matches/${matchId}/messages`, { content });
  return message;
}

export async function editMessage(messageId: string, content: string, matchId: string) {
  const message = await apiClient.patch(
    `/api/matches/${matchId}/messages/${messageId}`,
    { content }
  );
  return message;
}

export async function hideMatch(matchId: string) {
  return apiClient.post(`/api/matches/${matchId}/hide`);
}

export async function blockMatch(matchId: string) {
  return apiClient.post(`/api/matches/${matchId}/block`);
}

export async function unmatchMatch(matchId: string) {
  return apiClient.post(`/api/matches/${matchId}/unmatch`);
}

export async function reportUser(userId: string, reason: string) {
  return apiClient.post('/api/users/report', { userId, reason });
}
