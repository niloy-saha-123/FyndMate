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
import { useLocalSearchParams, router, useNavigation } from "expo-router";
import { useAuth } from "../../src/auth/AuthProvider";
import {
  getMessages,
  sendMessage,
  editMessage,
  getMatchStatus,
} from "../../src/messages/message.service";
import { subscribeToMessages } from "../../src/messages/message.realtime";
import { useMessageNotificationGuard } from "../../src/notifications/useMessageNotificationGuard";
import {
  MESSAGE_MAX_LENGTH,
  isMessageValid,
  getMessageError,
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

interface MatchUserInfo {
  id: string;
  name: string;
  profilePicture: string | null;
}

type RealtimeEvent = "upsert" | "delete" | "match_inactive";

export default function MessageScreen() {
  const { matchId } = useLocalSearchParams<{ matchId?: string }>();
  const { user } = useAuth();
  const navigation = useNavigation();

  // Hide default header initially to prevent flash of "messages/[matchId]"
  useEffect(() => {
    navigation.setOptions({
      headerShown: false
    });
  }, [navigation]);

  if (matchId) {
    useMessageNotificationGuard(matchId);
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
  const [otherUser, setOtherUser] = useState<MatchUserInfo | null>(null);

  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

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

    // Get the other user's info from the first message
    getMessages(matchId).then(msgs => {
      setMessages(msgs);
      if (msgs.length > 0) {
        // Find the other user (not the current user)
        const firstMessage = msgs[0];
        const otherUserInfo = firstMessage.senderId === user.id
          ? msgs.find(m => m.senderId !== user.id)?.sender
          : firstMessage.sender;

        if (otherUserInfo) {
          setOtherUser({
            id: otherUserInfo.id,
            name: otherUserInfo.name,
            profilePicture: otherUserInfo.profilePicture
          });

          // Set the navigation header title
          navigation.setOptions({
            headerShown: true,
            title: otherUserInfo.name,
            headerTitle: () => (
              <Pressable
                onPress={() => router.push(`/profile/${otherUserInfo.id}`)}
                style={styles.headerTitleContainer}
              >
                {otherUserInfo.profilePicture ? (
                  <Image
                    source={{ uri: otherUserInfo.profilePicture }}
                    style={styles.headerAvatar}
                  />
                ) : (
                  <View style={[styles.headerAvatar, styles.noHeaderAvatar]}>
                    <Ionicons name="person" size={20} color={COLORS.border} />
                  </View>
                )}
                <Text style={styles.headerTitleText}>{otherUserInfo.name}</Text>
              </Pressable>
            ),
            headerRight: () => (
              <Pressable
                onPress={() => setMenuVisible(true)}
                style={styles.headerMenuButton}
              >
                <Ionicons name="ellipsis-vertical" size={24} color={COLORS.textPrimary} />
              </Pressable>
            ),
            headerBackTitleVisible: false,
          });
        }
      }
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
              "Conversation unavailable",
              "This conversation is no longer available."
            );
            router.replace("/(tabs)/messages");
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

  const handleUnmatch = async () => {
    setMenuVisible(false);
    Alert.alert(
      "Unmatch",
      "Are you sure you want to unmatch this person?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unmatch",
          style: "destructive",
          onPress: async () => {
            try {
              // TODO: Implement unmatch functionality
              // await unmatchUser(matchId);
              router.replace('/matches');
            } catch (error) {
              console.error("Failed to unmatch:", error);
              Alert.alert("Error", "Failed to unmatch. Please try again.");
            }
          }
        }
      ]
    );
  };

  const handleBlock = async () => {
    setMenuVisible(false);
    Alert.alert(
      "Block User",
      "Are you sure you want to block this user?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            try {
              // TODO: Implement block functionality
              // await blockUser(otherUserInfo.id);
              router.replace('/matches');
            } catch (error) {
              console.error("Failed to block user:", error);
              Alert.alert("Error", "Failed to block user. Please try again.");
            }
          }
        }
      ]
    );
  };

  const handleReport = () => {
    setMenuVisible(false);
    Alert.alert(
      "Report User",
      "Reporting functionality is not yet implemented.",
      [{ text: "OK", style: "default" }]
    );
  };

  async function handleSend() {
    if (!user || !matchId) return;

    // Validate message
    if (!isMessageValid(text)) return;

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
          "You can no longer send messages in this conversation."
        );
        router.replace("/(tabs)/messages");
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
  const messageError = getMessageError(text);
  const isMessageTooLong = text.trim().length > MESSAGE_MAX_LENGTH;
  const canSend = isMessageValid(text) && !savingEdit;

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
                  </Pressable>
                </View>
              </>
            );
          }}
        />

        {!isBlocked && (
          <View style={styles.inputWrapper}>
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
                maxLength={MESSAGE_MAX_LENGTH + 50} // Allow slight overflow to show error
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

        {/* Three-dot Menu Modal */}
        <Modal transparent animationType="fade" visible={menuVisible}>
          <Pressable
            style={styles.menuOverlay}
            onPress={() => setMenuVisible(false)}
          >
            <View style={styles.menuContainer}>
              <Pressable
                style={styles.menuItem}
                onPress={handleUnmatch}
              >
                <Text style={[styles.menuText, styles.menuTextDestructive]}>Unmatch</Text>
              </Pressable>

              <Pressable
                style={styles.menuItem}
                onPress={handleBlock}
              >
                <Text style={[styles.menuText, styles.menuTextDestructive]}>Block</Text>
              </Pressable>

              <Pressable
                style={[styles.menuItem, styles.menuItemLast]}
                onPress={handleReport}
              >
                <Text style={styles.menuText}>Report</Text>
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

  // Header Title
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: -20,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: BORDERS.thin,
    borderColor: COLORS.border,
  },
  noHeaderAvatar: {
    backgroundColor: COLORS.gray200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headerMenuButton: {
    padding: 12,
    marginRight: -8,
  },

  // Menu Modal
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  menuContainer: {
    position: 'absolute',
    top: 60,
    right: 16,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.medium,
    borderWidth: BORDERS.thin,
    borderColor: COLORS.border,
    ...SHADOWS.medium,
    minWidth: 180,
  },
  menuItem: {
    padding: 16,
    borderBottomWidth: BORDERS.thin,
    borderBottomColor: COLORS.border,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuText: {
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  menuTextDestructive: {
    color: COLORS.danger,
    fontWeight: '600',
  },

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
    borderTopColor: COLORS.border,
    alignItems: "center", // Keep send button vertically centered
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.large, // More rectangular with rounded edges instead of fully oval
    paddingHorizontal: 16,
    paddingVertical: 12, // Increased vertical padding for better text containment
    fontSize: 16,
    backgroundColor: COLORS.gray100,
    minHeight: 44, // Ensure minimum height for touch targets
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24, // Increased from 20 to make button wider
    paddingVertical: 12, // Added vertical padding for better proportion
    justifyContent: "center",
    borderRadius: RADIUS.full,
    marginLeft: 8,
    minWidth: 80, // Minimum width to prevent it from becoming too thin
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
  inputError: {
    borderColor: COLORS.danger,
    borderWidth: 2
  }
});
