import { useEffect, useState, useRef } from "react";
import { View, Text, FlatList, TextInput, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useAuth } from "../../src/auth/AuthProvider";
import {
  getMessages,
  sendMessage
} from "../../src/chat/chat.service";
import { subscribeToMessages } from "../../src/chat/chat.realtime";

export default function ChatScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [pendingMessageIds, setPendingMessageIds] = useState<Set<string>>(new Set());
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!matchId || !user) return;

    console.log("🔵 Current user object:", JSON.stringify(user, null, 2));
    console.log("🔵 Current user ID:", user.id);

    // Load initial messages
    getMessages(matchId).then(msgs => {
      console.log("Loaded", msgs.length, "messages");
      setMessages(msgs);
    });

    // Subscribe to new messages
    const unsubscribe = subscribeToMessages(matchId, msg => {
      console.log("Real-time message received:", msg.id);
      
      setMessages(prev => {
        const withoutTemp = prev.filter(m => !m.id.toString().startsWith('temp-'));

        const exists = withoutTemp.some(m => m.id === msg.id);
        if (exists) {
          console.log("  Message already exists, skipping");
          return prev;
        }
        
        console.log("Adding message");
        return [...withoutTemp, msg];
      });

      setPendingMessageIds(prev => {
        const next = new Set(prev);
        next.delete(msg.id);
        return next;
      });
    });

    return unsubscribe;
  }, [matchId, user]);

  async function handleSend() {
    if (!text.trim() || !user) return;
    
    const content = text.trim();
    setText(""); 
    
    console.log("Sending message:", content);
    
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const tempMessage = {
      id: tempId,
      matchId,
      senderId: user.id,
      content,
      createdAt: new Date().toISOString(),
      readAt: null,
      isOptimistic: true
    };

    setMessages(prev => [...prev, tempMessage]);
    
    try {
      const result = await sendMessage(matchId, content);
      console.log("✅ Message sent, ID:", result?.id);
      
      if (result?.id) {
        setPendingMessageIds(prev => new Set(prev).add(result.id));
      }
      

    } catch (error) {
      console.error("Failed to send message:", error);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setText(content);
      alert("Failed to send message. Please try again.");
    }
  }

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  if (!user) {
    return <Text>Loading...</Text>;
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(m, index) => m.id || `msg-${index}`}
        contentContainerStyle={styles.messageList}
        renderItem={({ item }) => {
          const isMyMessage = item.senderId === user.id;
          const isSending = item.isOptimistic === true;
          
          console.log(`Message ${item.id}: senderId="${item.senderId}" vs userId="${user.id}" -> isMyMessage=${isMyMessage}`);
          
          return (
            <View
              style={[
                styles.messageBubble,
                isMyMessage ? styles.myMessage : styles.theirMessage,
                isSending && styles.sendingMessage
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  isMyMessage ? styles.myMessageText : styles.theirMessageText
                ]}
              >
                {item.content}
              </Text>
              <Text style={[
                styles.timestamp,
                isMyMessage && { color: '#cce5ff' }
              ]}>
                {isSending ? "Sending..." : new Date(item.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </Text>
            </View>
          );
        }}
      />

      <View style={styles.inputContainer}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Type a message..."
          style={styles.input}
          multiline
          maxLength={1000}
        />
        <Pressable
          onPress={handleSend}
          style={[
            styles.sendButton,
            !text.trim() && styles.sendButtonDisabled
          ]}
          disabled={!text.trim()}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5"
  },
  messageList: {
    padding: 16,
    paddingBottom: 8
  },
  messageBubble: {
    maxWidth: "75%",
    padding: 12,
    borderRadius: 16,
    marginBottom: 8
  },
  myMessage: {
    backgroundColor: "#007AFF",
    alignSelf: "flex-end",
    borderBottomRightRadius: 4
  },
  theirMessage: {
    backgroundColor: "#fff",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#e0e0e0"
  },
  sendingMessage: {
    opacity: 0.6
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20
  },
  myMessageText: {
    color: "#fff"
  },
  theirMessageText: {
    color: "#000"
  },
  timestamp: {
    fontSize: 11,
    color: "#999",
    marginTop: 4
  },
  inputContainer: {
    flexDirection: "row",
    padding: 8,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    alignItems: "flex-end"
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 16,
    maxHeight: 100,
    backgroundColor: "#f9f9f9"
  },
  sendButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginLeft: 8,
    justifyContent: "center"
  },
  sendButtonDisabled: {
    backgroundColor: "#ccc"
  },
  sendButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600"
  }
});