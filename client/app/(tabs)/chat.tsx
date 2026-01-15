import { useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, Image } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../src/auth/AuthProvider";
import { getMyMatches, hideMatch, blockMatch, unblockMatch } from "../../src/chat/chat.service";
import { supabase } from "../../src/auth/supabaseClient";
import { Alert } from "react-native";

export default function ChatTab() {
  const { user, loading } = useAuth();
  const [matches, setMatches] = useState<any[]>([]);

  useEffect(() => {
    if (!user || loading) return;

    getMyMatches(user.id)
      .then(setMatches)
      .catch(console.error);
  }, [user, loading]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`chat-list-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "Match"
        },
        async payload => {
          const match = payload.new;

          if (match.user1Id !== user.id && match.user2Id !== user.id) return;

          const fresh = await getMyMatches(user.id);
          setMatches(fresh);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "Match"
        },
        payload => {
          setMatches(prev =>
            prev.filter(m => m.id !== payload.old.id)
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "Match"
        },
        async payload => {
          const updated = payload.new;    
          if (updated.status === "hidden") {
            setMatches(prev => prev.filter(m => m.id !== updated.id));
          } else {
            const fresh = await getMyMatches(user.id);
            setMatches(fresh);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "Message"
        },
        payload => {
          const msg = payload.new;

          setMatches(prev =>
            prev.map(match => {
              if (match.id !== msg.matchId) return match;

              if (match.status === "blocked") return match;

              const unreadIncrement =
                msg.senderId !== user.id ? 1 : 0;

              return {
                ...match,
                lastMessage: msg,
                unreadCount: match.unreadCount + unreadIncrement
              };
            })
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (loading) {
    return <Text>Loading...</Text>;
  }

  if (!user) {
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <FlatList
        data={matches}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const isUser1 = item.user1Id === user?.id;
          const otherUser = isUser1 ? item.User2 : item.User1;
          const isBlocked = item.status === "blocked";
          const iBlockedThem = isBlocked && item.blockedBy === user.id;
          const theyBlockedMe = isBlocked && item.blockedBy !== user.id;

          return (
            <Pressable
              onPress={() => router.push(`/chat/${item.id}`)}
              onLongPress={() => {
                if (iBlockedThem) {
                  Alert.alert(
                    "Chat options",
                    "What would you like to do?",
                    [
                      {
                        text: "Unblock user",
                        onPress: async () => {
                          await unblockMatch(item.id);
                          const fresh = await getMyMatches(user.id);
                          setMatches(fresh);
                        }
                      },
                      {
                        text: "Remove from my chats",
                        onPress: async () => {
                          await hideMatch(item.id);
                          setMatches(prev => prev.filter(m => m.id !== item.id));
                        }
                      },
                      { text: "Cancel", style: "cancel" }
                    ]
                  );
                } else if (!theyBlockedMe) {
                  Alert.alert(
                    "Chat options",
                    "What would you like to do?",
                    [
                      {
                        text: "Remove from my chats",
                        onPress: async () => {
                          await hideMatch(item.id);
                          setMatches(prev => prev.filter(m => m.id !== item.id));
                        }
                      },
                      {
                        text: "Block user",
                        style: "destructive",
                        onPress: async () => {
                          await blockMatch(item.id, user.id);
                          const fresh = await getMyMatches(user.id);
                          setMatches(fresh);
                        }
                      },
                      { text: "Cancel", style: "cancel" }
                    ]
                  );
                }
              }}
              style={{
                flexDirection: "row",
                padding: 16,
                borderBottomWidth: 1,
                borderColor: "#eee",
                alignItems: "center",
                opacity: isBlocked ? 0.6 : 1,
                backgroundColor: isBlocked ? "#f9f9f9" : "#fff"
              }}
            >
              <Image
                source={{ uri: otherUser.profilePicture }}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  marginRight: 12
                }}
              />

              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "600", fontSize: 16 }}>
                  {otherUser.name}
                </Text>

                <Text
                  numberOfLines={1}
                  style={{
                    color: isBlocked ? "#999" : (item.unreadCount > 0 ? "#000" : "#666"),
                    fontWeight: item.unreadCount > 0 ? "600" : "400",
                    fontStyle: isBlocked ? "italic" : "normal"
                  }}
                >
                  {theyBlockedMe
                    ? "You have been blocked"
                    : iBlockedThem
                    ? "You blocked this user"
                    : item.lastMessage
                    ? item.lastMessage.content
                    : "Start a conversation"}
                </Text>
              </View>

              {item.unreadCount > 0 && !isBlocked && (
                <View
                  style={{
                    backgroundColor: "#ff3b30",
                    minWidth: 22,
                    height: 22,
                    borderRadius: 11,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 6
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>
                    {item.unreadCount > 9 ? "9+" : item.unreadCount}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        }}
      />
    </View>
  );
}