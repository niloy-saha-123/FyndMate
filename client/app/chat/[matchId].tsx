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
  Platform,
  Alert,
  Image
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useAuth } from "../../src/auth/AuthProvider";
import {
  getMessages,
  sendMessage,
  editMessage,
  getMatchStatus,
} from "../../src/chat/chat.service";
import { subscribeToMessages } from "../../src/chat/chat.realtime";
import { useChatNotificationGuard } from "../../src/notifications/useChatNotificationGuard";
import {
  CHAT_MESSAGE_MIN_LENGTH,
  CHAT_MESSAGE_MAX_LENGTH,
  isChatMessageValid,
  getChatMessageError,
} from "../../src/constants/validation";
import { 
  convertToLocalTime, 
  formatRelativeTime, 
  formatDateSection,
  formatMessageTime,
  isLastInBurst
} from "../../src/utils/timeFormatting";
import { COLORS, SHADOWS, BORDERS, RADIUS } from "../../src/theme/colors";
import { NeoCard } from "../../src/components/NeoCard";
import { Ionicons } from "@expo/vector-icons";


interface Message {
  id: string;
  matchId: string;
  senderId: string;
  content: string;
  createdAt: string;
  editedAt?: string | null;
  sender: {
    id: string;
    name: string;
    profilePicture: string | null;
  };
}

interface MessageWithMetadata extends Message {
  localCreatedAt: Date;
  showTimestamp: boolean;
  dateString: string;
}

type RealtimeEvent = "upsert" | "delete" | "match_inactive";

export default function ChatScreen() {
  const { matchId } = useLocalSearchParams<{ matchId?: string }>();
  const { user } = useAuth();

  if (matchId) {
    useChatNotificationGuard(matchId);
  }

  const [messages, setMessages] = useState<Message[]>([]);
  const [processedMessages, setProcessedMessages] = useState<MessageWithMetadata[]>([]);
  const [visibleTimestamps, setVisibleTimestamps] = useState<Set<string>>(new Set()); // Track which timestamps should be visible
  const [text, setText] = useState("");
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [matchStatus, setMatchStatus] = useState<{
    status: string;
    blockedBy: string | null;
  } | null>(null);

  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const flatListRef = useRef<FlatList<MessageWithMetadata>>(null);

  // Process messages with metadata for UI rendering
  useEffect(() => {
    if (messages.length === 0) {
      setProcessedMessages([]);
      setVisibleTimestamps(new Set());
      return;
    }

    // Convert to local time and add metadata
    const withMetadata: MessageWithMetadata[] = messages.map((msg, index) => {
      const localCreatedAt = convertToLocalTime(msg.createdAt);
      
      const shouldShowTs = isLastInBurst(messages, index);
      
      return {
        ...msg,
        localCreatedAt,
        showTimestamp: shouldShowTs,
        dateString: formatDateSection(localCreatedAt)
      };
    });

    setProcessedMessages(withMetadata);
    
    // Set up delayed timestamps for messages that should show timestamps
    const newVisibleTimestamps = new Set(visibleTimestamps);
    const messagesToShowTimestamp = withMetadata.filter(msg => msg.showTimestamp);
    
    messagesToShowTimestamp.forEach(msg => {
      if (!newVisibleTimestamps.has(msg.id)) {
        // Schedule timestamp to appear after 1 second delay
        setTimeout(() => {
          setVisibleTimestamps(prev => new Set(prev).add(msg.id));
        }, 1000);
      }
    });
  }, [messages]);

  // Clear visible timestamps when messages change significantly
  useEffect(() => {
    if (messages.length === 0) {
      setVisibleTimestamps(new Set());
    }
  }, [messages.length]);

  useEffect(() => {
    if (!matchId || !user) return;

    getMatchStatus(matchId)
      .then(setMatchStatus)
      .catch(console.error);

    getMessages(matchId).then(setMessages).catch(console.error);

    const unsubscribe = subscribeToMessages(
      matchId,
      (event: RealtimeEvent, payload: any) => {
        if (event === "match_inactive") {
          if (payload.status === "blocked") {
            setMatchStatus({
              status: payload.status,
              blockedBy: payload.blockedBy
            });
          } else {
            Alert.alert(
              "Chat unavailable",
              "This conversation is no longer available."
            );
            router.replace("/(tabs)/chat");
          }
          return;
        }

        setMessages(prev => {
          if (event === "delete") {
            return prev.filter(m => m.id !== payload.id);
          }

          const exists = prev.some(m => m.id === payload.id);
          if (exists) {
            return prev.map(m => (m.id === payload.id ? payload : m));
          }

          return [...prev, payload];
        });
      }
    );

    return unsubscribe;
  }, [matchId, user]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 50);
    }
  }, [messages.length]);

  function canEditMessage(message: Message): boolean {
    if (!user) return false;
    const EDIT_WINDOW_MS = 3 * 60 * 1000;
    return (
      message.senderId === user.id &&
      Date.now() - new Date(message.createdAt).getTime() < EDIT_WINDOW_MS
    );
  }

  async function handleSend() {
    if (!user || !matchId) return;
    
    // Validate message
    if (!isChatMessageValid(text)) return;

    const content = text.trim();
    setText("");

    try {
      if (editingMessage) {
        setSavingEdit(true);
        await editMessage(editingMessage.id, content, matchId);
        setEditingMessage(null);
        setSavingEdit(false);
      } else {
        await sendMessage(matchId, content);
      }
    } catch (err: any) {
      if (err.message?.toLowerCase().includes("permission")) {
        Alert.alert(
          "Message not sent",
          "You can no longer send messages in this chat."
        );
        router.replace("/(tabs)/chat");
        return;
      }

      console.error(err);
      Alert.alert("Error", "Failed to send message");
      setText(content);
      setSavingEdit(false);
    }
  }

  if (!user) return <Text>Loading...</Text>;

  const isBlocked = matchStatus?.status === "blocked";
  const messageError = getChatMessageError(text);
  const isMessageTooLong = text.trim().length > CHAT_MESSAGE_MAX_LENGTH;
  const canSend = isChatMessageValid(text) && !savingEdit;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={80}
    >
      <View style={styles.container}>
        {isBlocked && (
          <View style={styles.blockedBanner}>
            <Text style={styles.blockedText}>
              This conversation is unavailable
            </Text>
          </View>
        )}

        <FlatList
          ref={flatListRef}
          data={processedMessages}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messageList}
          renderItem={({ item, index }) => {
            const isMyMessage = item.senderId === user.id;
            const showAvatarAndName = !isMyMessage; // Only show for other user
            
            // Show date section header when date changes
            const showDateHeader = index === 0 || 
              (index > 0 && processedMessages[index - 1].dateString !== item.dateString);

            return (
              <>
                {showDateHeader && (
                  <View style={styles.dateHeader}>
                    <Text style={styles.dateHeaderText}>{item.dateString}</Text>
                  </View>
                )}
                
                <View style={[
                  styles.messageContainer,
                  isMyMessage ? styles.myMessageContainer : styles.theirMessageContainer
                ]}>
                  {showAvatarAndName && (
                    <Pressable 
                      onPress={() => router.push(`/profile/${item.sender.id}`)}
                      style={styles.avatarContainer}
                    >
                      {item.sender.profilePicture ? (
                        <Image
                          source={{ uri: item.sender.profilePicture }}
                          style={styles.avatar}
                        />
                      ) : (
                        <View style={[styles.avatar, styles.noAvatar]}>
                          <Ionicons name="person" size={20} color={COLORS.border} />
                        </View>
                      )}
                      <Text style={styles.senderName}>{item.sender.name}</Text>
                    </Pressable>
                  )}
                  
                  <Pressable
                    onLongPress={() => {
                      if (!canEditMessage(item) || isBlocked) return;
                      setSelectedMessage(item);
                      setActionModalVisible(true);
                    }}
                    style={[
                      styles.messageBubble,
                      isMyMessage ? styles.myMessage : styles.theirMessage
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        isMyMessage
                          ? styles.myMessageText
                          : styles.theirMessageText
                      ]}
                    >
                      {item.content}
                    </Text>
                    
                    {visibleTimestamps.has(item.id) && (
                      <View style={styles.timestampContainer}>
                        <Text style={styles.timestamp}>
                          {formatMessageTime(item.localCreatedAt)}
                        </Text>
                        {item.editedAt && (
                          <Text style={styles.edited}>edited</Text>
                        )}
                      </View>
                    )}
                  </Pressable>
                </View>
              </>
            );
          }}
        />

        {!isBlocked && (
          <View style={styles.inputWrapper}>
            {/* Character counter and error */}
            {text.length > 0 && (
              <View style={styles.charCountContainer}>
                <Text style={[
                  styles.charCount,
                  isMessageTooLong && styles.charCountError
                ]}>
                  {text.trim().length}/{CHAT_MESSAGE_MAX_LENGTH}
                </Text>
                {isMessageTooLong && (
                  <Text style={styles.errorText}>Message too long</Text>
                )}
              </View>
            )}
            <View style={styles.inputContainer}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder={editingMessage ? "Edit message…" : "Type a message…"}
                style={[
                  styles.input,
                  isMessageTooLong && styles.inputError
                ]}
                multiline
                maxLength={CHAT_MESSAGE_MAX_LENGTH + 50} // Allow slight overflow to show error
              />
              <Pressable
                onPress={handleSend}
                disabled={!canSend}
                style={[
                  styles.sendButton,
                  !canSend && styles.sendButtonDisabled
                ]}
              >
                <Text style={styles.sendButtonText}>
                  {editingMessage ? "Save" : "Send"}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        <Modal transparent animationType="fade" visible={actionModalVisible}>
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setActionModalVisible(false)}
          >
            <View style={styles.modalBox}>
              <Pressable
                onPress={() => {
                  if (!selectedMessage) return;
                  setEditingMessage(selectedMessage);
                  setText(selectedMessage.content);
                  setActionModalVisible(false);
                }}
              >
                <Text style={styles.modalAction}>Edit</Text>
              </Pressable>

              <Pressable onPress={() => setActionModalVisible(false)}>
                <Text style={styles.modalAction}>Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  messageList: { padding: 16 },

  // Date Headers
  dateHeader: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMuted,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    ...SHADOWS.small,
    borderWidth: BORDERS.thin,
    borderColor: COLORS.border,
  },

  // Message Containers
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  myMessageContainer: {
    justifyContent: 'flex-end',
    flexDirection: 'row',
  },
  theirMessageContainer: {
    justifyContent: 'flex-start',
  },

  // Avatar and Name
  avatarContainer: {
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 4,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: BORDERS.thin,
    borderColor: COLORS.border,
    marginBottom: 4,
  },
  noAvatar: {
    backgroundColor: COLORS.gray200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'center',
    maxWidth: 60,
  },

  // Message Bubbles
  messageBubble: {
    maxWidth: "70%",
    padding: 12,
    borderRadius: RADIUS.large,
    borderWidth: BORDERS.thin,
    borderColor: COLORS.border,
  },
  myMessage: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: RADIUS.small,
  },
  theirMessage: {
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: RADIUS.small,
  },

  messageText: { 
    fontSize: 16,
    lineHeight: 22,
  },
  myMessageText: { 
    color: COLORS.surface 
  },
  theirMessageText: { 
    color: COLORS.textPrimary 
  },

  // Timestamps
  timestampContainer: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
    alignItems: 'center',
  },
  timestamp: { 
    fontSize: 11, 
    color: COLORS.textLight,
    fontWeight: '500',
  },
  edited: { 
    fontSize: 11, 
    color: COLORS.textLight, 
    fontStyle: "italic" 
  },

  // Blocked Banner
  blockedBanner: {
    backgroundColor: COLORS.danger,
    padding: 12,
    alignItems: "center"
  },
  blockedText: {
    color: COLORS.surface,
    fontSize: 14,
    fontWeight: "600"
  },

  // Input Area
  inputContainer: {
    flexDirection: "row",
    padding: 8,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 16,
    backgroundColor: COLORS.gray100
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    justifyContent: "center",
    borderRadius: RADIUS.full,
    marginLeft: 8,
    ...SHADOWS.small,
  },
  sendButtonDisabled: { 
    backgroundColor: COLORS.gray200,
    ...SHADOWS.small,
  },
  sendButtonText: { 
    color: COLORS.surface, 
    fontSize: 16, 
    fontWeight: "600" 
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center"
  },
  modalBox: {
    backgroundColor: COLORS.surface,
    padding: 20,
    borderRadius: RADIUS.medium,
    width: 200,
    borderWidth: BORDERS.thin,
    borderColor: COLORS.border,
    ...SHADOWS.medium,
  },
  modalAction: {
    fontSize: 16,
    paddingVertical: 12,
    textAlign: "center",
    fontWeight: '600',
  },

  // Input Validation
  inputWrapper: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border
  },
  charCountContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 4
  },
  charCount: {
    fontSize: 12,
    color: COLORS.textLight
  },
  charCountError: {
    color: COLORS.danger,
    fontWeight: "600"
  },
  errorText: {
    fontSize: 12,
    color: COLORS.danger,
    fontWeight: "500"
  },
  inputError: {
    borderColor: COLORS.danger,
    borderWidth: 2
  }
});