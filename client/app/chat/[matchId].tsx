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
import { formatRelativeTime, formatDateSection } from "../../src/utils/timeFormatting";
import { groupMessagesWithBurstOptimization } from "../../src/utils/messageGrouping";
import { getOptimizedImageUrl, ImageSizes } from "../../src/utils/imageOptimization";
import { COLORS } from "../../src/theme/colors";
import { Ionicons } from "@expo/vector-icons";
import { ChatDateHeader } from "../../src/components/ChatDateHeader";
import { ProfileModal } from "../../src/components/ProfileModal";
import { getUserProfile, UserProfileData } from "../../src/services/userProfile.service";


interface Sender {
  id: string;
  name: string;
  profilePicture: string | null;
}

interface Message {
  id: string;
  matchId: string;
  senderId: string;
  sender: Sender;
  content: string;
  createdAt: string;
  editedAt?: string | null;
}

type GroupedItem = 
  | { type: "date"; date: string }
  | { 
      type: "message"; 
      data: Message; 
      showTimestamp: boolean;
      isFirstInSequence: boolean;
      isLastInSequence: boolean;
    };

type RealtimeEvent = "upsert" | "delete" | "match_inactive";

export default function ChatScreen() {
  const { matchId } = useLocalSearchParams<{ matchId?: string }>();
  const { user } = useAuth();

  if (matchId) {
    useChatNotificationGuard(matchId);
  }

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [matchStatus, setMatchStatus] = useState<{
    status: string;
    blockedBy: string | null;
  } | null>(null);

  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<UserProfileData | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const flatListRef = useRef<FlatList<GroupedItem>>(null);

  useEffect(() => {
    if (!matchId || !user) return;

    getMatchStatus(matchId)
      .then(setMatchStatus)
      .catch(console.error);

    getMessages(matchId).then(data => {
      console.log('Messages loaded:', data); // Debug log
      setMessages(data);
    }).catch(console.error);

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

  // Group messages with burst optimization
  const groupedMessages = groupMessagesWithBurstOptimization(messages, formatDateSection);

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
          data={groupedMessages}
          keyExtractor={(item: GroupedItem, index: number) => 
            item.type === "date" ? `date-${item.date}-${index}` : `msg-${item.data.id}`
          }
          contentContainerStyle={styles.messageList}
          renderItem={({ item, index }: { item: GroupedItem; index: number }) => {
            if (item.type === "date") {
              return <ChatDateHeader date={item.date} />;
            }

            const message = item.data;
            const isMyMessage = message.senderId === user.id;
            const showTimestamp = item.showTimestamp;
            const showAvatar = !isMyMessage; // Show avatar for every message from other users
            const showName = !isMyMessage && item.isFirstInSequence;

            return (
              <View style={[
                styles.messageContainer,
                isMyMessage ? styles.myMessageContainer : styles.theirMessageContainer
              ]}>
                {showName && (
                  <Text style={styles.senderName}>{message.sender.name}</Text>
                )}
                
                <View style={[
                  styles.messageRow,
                  isMyMessage ? styles.myMessageRow : styles.theirMessageRow
                ]}>
                  {showAvatar && (
                    <Pressable 
                      onPress={async () => {
                        setLoadingProfile(true);
                        try {
                          console.log('Fetching profile for user:', message.sender.id); // Debug log
                          const profileData = await getUserProfile(message.sender.id);
                          console.log('Profile data received:', profileData); // Debug log
                          setSelectedProfile(profileData);
                          setProfileModalVisible(true);
                        } catch (error: any) {
                          console.error("Failed to load profile:", error);
                          const errorMessage = error?.message || error?.toString() || "Unknown error";
                          Alert.alert("Error", `Could not load profile information: ${errorMessage}`);
                        } finally {
                          setLoadingProfile(false);
                        }
                      }}
                      style={styles.avatarContainer}
                      disabled={loadingProfile}
                    >
                      {message.sender.profilePicture ? (
                        <Image
                          source={{ uri: getOptimizedImageUrl(
                            message.sender.profilePicture,
                            ImageSizes.AVATAR_CHAT.width,
                            ImageSizes.AVATAR_CHAT.quality
                          ) }}
                          style={styles.avatar}
                        />
                      ) : (
                        <View style={[styles.avatar, styles.avatarPlaceholder]}>
                          <Ionicons name="person" size={20} color={COLORS.border} />
                        </View>
                      )}
                    </Pressable>
                  )}
                  
                  <View style={[
                    styles.messageBubble,
                    isMyMessage ? styles.myBubble : styles.theirBubble
                  ]}>
                    <Text style={[
                      styles.messageText,
                      isMyMessage ? styles.myMessageText : styles.theirMessageText
                    ]}>
                      {message.content}
                    </Text>
                    
                    {message.editedAt && (
                      <Text style={styles.editedText}>(edited)</Text>
                    )}
                  </View>
                </View>
                
                {showTimestamp && (
                  <Text style={[
                    styles.timestamp,
                    isMyMessage ? styles.myTimestamp : styles.theirTimestamp
                  ]}>
                    {formatRelativeTime(message.createdAt)}
                  </Text>
                )}
              </View>
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

        {/* Profile Modal */}
        <ProfileModal
          visible={profileModalVisible && selectedProfile !== null}
          onClose={() => {
            setProfileModalVisible(false);
            setSelectedProfile(null);
          }}
          profile={selectedProfile || {
            id: '',
            name: '',
            profilePicture: null,
            bio: null,
            skills: [],
            interests: [],
            experience: null,
            commitment: null,
            age: null,
            gender: null,
            city: null,
            country: null,
            githubUsername: null,
            lookingFor: [],
            birthDate: null,
          }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  messageList: { padding: 16 },

  // Message containers
  messageContainer: {
    marginBottom: 12,
  },
  myMessageContainer: {
    alignItems: "flex-end",
  },
  theirMessageContainer: {
    alignItems: "flex-start",
  },

  // Sender name
  senderName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    marginBottom: 4,
    marginLeft: 48, // Account for avatar width + spacing
  },

  // Message row layout
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  myMessageRow: {
    justifyContent: "flex-end",
  },
  theirMessageRow: {
    justifyContent: "flex-start",
  },

  // Avatar
  avatarContainer: {
    marginRight: 8,
    marginBottom: 4,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#e0e0e0",
  },
  avatarPlaceholder: {
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },

  // Message bubbles
  messageBubble: {
    maxWidth: "75%",
    padding: 12,
    borderRadius: 18,
  },
  myBubble: {
    backgroundColor: "#007AFF",
    borderBottomRightRadius: 6,
  },
  theirBubble: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },

  // Message text
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  myMessageText: {
    color: "#fff",
  },
  theirMessageText: {
    color: "#000",
  },
  editedText: {
    fontSize: 11,
    color: "#ccc",
    fontStyle: "italic",
    marginTop: 2,
  },

  // Timestamps
  timestamp: {
    fontSize: 11,
    marginTop: 4,
  },
  myTimestamp: {
    color: "#999",
    marginRight: 8,
  },
  theirTimestamp: {
    color: "#999",
    marginLeft: 48, // Align with message start
  },

  blockedBanner: {
    backgroundColor: "#ff3b30",
    padding: 12,
    alignItems: "center"
  },
  blockedText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600"
  },

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
  },

  // Input validation styles
  inputWrapper: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0"
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
    color: "#999"
  },
  charCountError: {
    color: "#ff3b30",
    fontWeight: "600"
  },
  errorText: {
    fontSize: 12,
    color: "#ff3b30",
    fontWeight: "500"
  },
  inputError: {
    borderColor: "#ff3b30",
    borderWidth: 2
  }
});