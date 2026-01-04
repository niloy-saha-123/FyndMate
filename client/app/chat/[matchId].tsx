import { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useAuth } from "../../src/auth/AuthProvider";
import {
  getMessages,
  sendMessage,
  editMessage
} from "../../src/chat/chat.service";
import { subscribeToMessages } from "../../src/chat/chat.realtime";

export default function ChatScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { user } = useAuth();

  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [editingMessage, setEditingMessage] = useState<any | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<any | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!matchId || !user) return;

    getMessages(matchId).then(setMessages);

    const unsubscribe = subscribeToMessages(matchId, msg => {
      setMessages(prev => {
        const exists = prev.some(m => m.id === msg.id);
        if (exists) {
          return prev.map(m => (m.id === msg.id ? msg : m));
        }
        return [...prev, msg];
      });
    });

    return unsubscribe;
  }, [matchId, user]);

  function canEditMessage(message: any) {
    const FIVE_MIN = 5 * 60 * 1000;
    return (
      message.senderId === user?.id &&
      Date.now() - new Date(message.createdAt).getTime() < FIVE_MIN
    );
  }

  async function handleSend() {
    if (!text.trim() || !user) return;

    const content = text.trim();
    setText("");

    try {
      if (editingMessage) {
        setSavingEdit(true);
        await editMessage(editingMessage.id, content);
        setEditingMessage(null);
        setSavingEdit(false);
      } else {
        await sendMessage(matchId!, content);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to send");
      setText(content);
      setSavingEdit(false);
    }
  }

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 50);
    }
  }, [messages.length]);

  if (!user) return <Text>Loading...</Text>;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={80}
    >
      <View style={styles.container}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={styles.messageList}
          renderItem={({ item }) => {
            const isMyMessage = item.senderId === user.id;

            return (
              <Pressable
                onLongPress={() => {
                  if (!canEditMessage(item)) return;
                  setSelectedMessage(item);
                  setModalVisible(true);
                }}
                style={[
                  styles.messageBubble,
                  isMyMessage ? styles.myMessage : styles.theirMessage
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

                <View style={{ flexDirection: "row", gap: 6 }}>
                  <Text style={styles.timestamp}>
                    {new Date(item.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </Text>

                  {item.editedAt && (
                    <Text style={styles.edited}>edited</Text>
                  )}
                </View>
              </Pressable>
            );
          }}
        />

        <View style={styles.inputContainer}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={editingMessage ? "Edit message…" : "Type a message…"}
            style={styles.input}
            multiline
          />
          <Pressable
            onPress={handleSend}
            disabled={!text.trim() || savingEdit}
            style={[
              styles.sendButton,
              (!text.trim() || savingEdit) && styles.sendButtonDisabled
            ]}
          >
            <Text style={styles.sendButtonText}>
              {editingMessage ? "Save" : "Send"}
            </Text>
          </Pressable>
        </View>

        <Modal
          transparent
          animationType="fade"
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setModalVisible(false)}
          >
            <View style={styles.modalBox}>
              <Pressable
                onPress={() => {
                  setEditingMessage(selectedMessage);
                  setText(selectedMessage.content);
                  setModalVisible(false);
                }}
              >
                <Text style={styles.modalAction}>Edit</Text>
              </Pressable>

              <Pressable onPress={() => setModalVisible(false)}>
                <Text style={[styles.modalAction, { color: "red" }]}>
                  Cancel
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  messageList: { padding: 16 },
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
  messageText: { fontSize: 16 },
  myMessageText: { color: "#fff" },
  theirMessageText: { color: "#000" },
  timestamp: { fontSize: 11, color: "#ccc" },
  edited: { fontSize: 11, color: "#ccc", fontStyle: "italic" },

  inputContainer: {
    flexDirection: "row",
    padding: 8,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0"
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 16,
    backgroundColor: "#f9f9f9"
  },
  sendButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    justifyContent: "center",
    borderRadius: 20,
    marginLeft: 8
  },
  sendButtonDisabled: { backgroundColor: "#ccc" },
  sendButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center"
  },
  modalBox: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    width: 200
  },
  modalAction: {
    fontSize: 16,
    paddingVertical: 12,
    textAlign: "center"
  }
});
