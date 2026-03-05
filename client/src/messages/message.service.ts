import { apiClient } from "../lib/apiClient";

export async function getMyMatches() {
  const response = await apiClient.get<{ data: any[] }>("/api/matches");
  return response.data;
}

export async function getMatchStatus(
  matchId: string
): Promise<{ status: string; blockedBy: string | null; otherUserId: string }> {
  return apiClient.get(`/api/matches/${matchId}`);
}

export async function unblockMatch(matchId: string) {
  return apiClient.post(`/api/matches/${matchId}/unblock`);
}

// Fetch messages with cursor-based pagination. Returns { data, nextCursor }.
export async function getMessagesPage(matchId: string, cursor?: string, limit = 50) {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  if (limit) params.set('limit', String(limit));
  const query = params.toString();
  const path = query
    ? `/api/matches/${matchId}/messages?${query}`
    : `/api/matches/${matchId}/messages`;

  return apiClient.get<{ data: any[]; nextCursor: string | null }>(path);
}

// Backwards compatibility helper for legacy callers that expect an array.
export async function getMessages(matchId: string) {
  const res = await getMessagesPage(matchId, undefined, 100);
  return res.data;
}

export async function markMessagesRead(matchId: string) {
  return apiClient.patch(`/api/matches/${matchId}/messages/read`);
}

export async function sendMessage(matchId: string, content: string) {
  const message = await apiClient.post<{
    id: string;
    matchId: string;
    senderId: string;
    content: string;
    createdAt: string;
    readAt: string | null;
    editedAt: string | null;
    isDeleted: boolean;
    deletedBy: string | null;
    deletedAt: string | null;
    sender: {
      id: string;
      name: string;
      profilePicture: string | null;
    };
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

export async function deleteMessage(matchId: string, messageId: string) {
  return apiClient.patch(
    `/api/matches/${matchId}/messages/${messageId}/delete`
  );
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
