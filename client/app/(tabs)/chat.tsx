import { useEffect, useState } from "react";
import {Stack} from "expo-router"
import { View, Text, FlatList, Pressable, Image } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../src/auth/AuthProvider";
import { getMyMatches } from "../../src/chat/chat.service";

export default function ChatTab() {
  const { user, loading } = useAuth();
  const [matches, setMatches] = useState<any[]>([]);

  useEffect(() => {
    if (!user || loading) return;

    getMyMatches().then(setMatches).catch(console.error);
  }, [user, loading]);

  if (loading) {
    return <Text>Loading...</Text>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <FlatList
        data={matches}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const isUser1 = item.user1Id === user?.id;
          const otherUser = isUser1 ? item.User2 : item.User1;

          return (
            <Pressable
              onPress={() => router.push(`/chat/${item.id}`)}
              style={{
                flexDirection: "row",
                padding: 16,
                borderBottomWidth: 1,
                borderColor: "#eee"
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
              <View>
                <Text style={{ fontWeight: "600", fontSize: 16 }}>
                  {otherUser.name}
                </Text>
                <Text style={{ color: "#666" }}>
                  Tap to chat
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
