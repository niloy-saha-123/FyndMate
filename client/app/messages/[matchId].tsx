import { useEffect, useState, useRef, useCallback } from "react";
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
  Image,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, router, useNavigation } from "expo-router";
import { useAuth } from "../../src/auth/AuthProvider";
import {
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  getMatchStatus,
  unmatchMatch,
  blockMatch,
  reportUser,
} from "../../src/messages/message.service";
import { subscribeToMessages } from "../../src/messages/message.realtime";
import { useMessageNotificationGuard } from "../../src/notifications/useMessageNotificationGuard";
import {
  MESSAGE_MAX_LENGTH,
  isMessageValid,
  getMessageError,
  REPORT_REASON_MIN_LENGTH,
  REPORT_REASON_MAX_LENGTH,
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
import { getUserProfileById } from "../../src/services/profileService";


interface Message {
  id: string;
  matchId: string;
  senderId: string;
  content: string;
  tempId?: string;
  createdAt: string;
  editedAt?: string | null;
  isDeleted?: boolean;
  deletedBy?: string | null;
  deletedAt?: string | null;
  status?: "pending" | "failed" | "sent";
  clientError?: string | null;
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

interface MatchStatusInfo {
  status: string;
  blockedBy: string | null;
  otherUserId?: string;
}

interface ThreadCache {
  messages: Message[];
  matchStatus: MatchStatusInfo | null;
  otherUser: MatchUserInfo | null;
  timestamp: number;
}

type RealtimeEvent = "upsert" | "delete" | "match_inactive";
type ConfirmAction = "unmatch" | "block" | null;
const THREAD_CACHE_PREFIX = "fyndmate_thread_cache:";
const THREAD_CACHE_MAX_AGE_MS = 2 * 60 * 1000;

function getThreadCacheKey(userId: string, matchId: string): string {
  return `${THREAD_CACHE_PREFIX}${userId}:${matchId}`;
}

async function loadThreadCache(cacheKey: string): Promise<ThreadCache | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ThreadCache;
    if (!Array.isArray(parsed.messages)) return null;
    if (typeof parsed.timestamp !== "number") return null;
    if (Date.now() - parsed.timestamp > THREAD_CACHE_MAX_AGE_MS) return null;
    return {
      messages: parsed.messages,
      matchStatus: parsed.matchStatus ?? null,
      otherUser: parsed.otherUser ?? null,
      timestamp: parsed.timestamp,
    };
  } catch {
    return null;
  }
}

function persistThreadCache(cacheKey: string, payload: ThreadCache) {
  AsyncStorage.setItem(cacheKey, JSON.stringify(payload)).catch(() => {});
}

export default function MessageScreen() {
  const { matchId } = useLocalSearchParams<{ matchId?: string | string[] }>();
  const normalizedMatchId = Array.isArray(matchId) ? matchId[0] : matchId;
  const { user } = useAuth();
  const navigation = useNavigation();

  // Show a stable fallback header immediately to avoid header disappearing
  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      title: "Messages",
      headerBackTitleVisible: false,
      headerRight: () => null,
    });
  }, [navigation]);

  if (normalizedMatchId) {
    useMessageNotificationGuard(normalizedMatchId);
  }

  const [messages, setMessages] = useState<Message[]>([]);
  const [processedMessages, setProcessedMessages] = useState<MessageWithMetadata[]>([]);
  const [visibleTimestamps, setVisibleTimestamps] = useState<Set<string>>(new Set()); // Track which timestamps should be visible
  const [text, setText] = useState("");
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [matchStatus, setMatchStatus] = useState<MatchStatusInfo | null>(null);
  const [otherUser, setOtherUser] = useState<MatchUserInfo | null>(null);

  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [confirmingAction, setConfirmingAction] = useState(false);
  const [loadingThread, setLoadingThread] = useState(true);

  const flatListRef = useRef<FlatList<MessageWithMetadata>>(null);
  const threadCacheWriteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const FAILED_MESSAGE_TEXT = "Cannot send message";
  const MESSAGE_SEND_WINDOW_MS = 5 * 60 * 1000;

  const applyHeaderForOtherUser = useCallback((resolvedOtherUser: MatchUserInfo, currentMatchId: string) => {
    navigation.setOptions({
      headerShown: true,
      title: resolvedOtherUser.name,
      headerTitle: () => (
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/messages/profile/[userId]",
              params: { userId: resolvedOtherUser.id, matchId: currentMatchId },
            })
          }
          style={styles.headerTitleContainer}
        >
          {resolvedOtherUser.profilePicture ? (
            <Image
              source={{ uri: resolvedOtherUser.profilePicture }}
              style={styles.headerAvatar}
            />
          ) : (
            <View style={[styles.headerAvatar, styles.noHeaderAvatar]}>
              <Ionicons name="person" size={20} color={COLORS.border} />
            </View>
          )}
          <Text style={styles.headerTitleText}>{resolvedOtherUser.name}</Text>
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
  }, [navigation]);

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
    if (!normalizedMatchId || !user) return;

    let mounted = true;
    const cacheKey = getThreadCacheKey(user.id, normalizedMatchId);

    const resolveOtherUserFromMessages = (msgs: Message[]): MatchUserInfo | null => {
      if (msgs.length === 0) return null;
      const firstMessage = msgs[0];
      const otherUserInfo = firstMessage.senderId === user.id
        ? msgs.find(m => m.senderId !== user.id)?.sender
        : firstMessage.sender;

      if (!otherUserInfo) return null;
      return {
        id: otherUserInfo.id,
        name: otherUserInfo.name,
        profilePicture: otherUserInfo.profilePicture,
      };
    };

    const fetchThreadFromNetwork = async () => {
      try {
        const [status, msgs] = await Promise.all([
          getMatchStatus(normalizedMatchId),
          getMessages(normalizedMatchId)
        ]);
        if (!mounted) return;

        setMatchStatus(status);
        setMessages(msgs);

        let resolvedOtherUser = resolveOtherUserFromMessages(msgs);

        if (!resolvedOtherUser && status.otherUserId) {
          try {
            const profile = await getUserProfileById(status.otherUserId);
            resolvedOtherUser = {
              id: profile.id,
              name: profile.name || "User",
              profilePicture: profile.profilePicture ?? null,
            };
          } catch (error) {
            console.error("Failed to resolve other user profile for header", error);
          }
        }

        if (!mounted) return;
        if (resolvedOtherUser) {
          setOtherUser(resolvedOtherUser);
          applyHeaderForOtherUser(resolvedOtherUser, normalizedMatchId);
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (mounted) {
          setLoadingThread(false);
        }
      }
    };

    (async () => {
      const cached = await loadThreadCache(cacheKey);
      if (mounted && cached) {
        setMessages(cached.messages);
        setMatchStatus(cached.matchStatus);
        if (cached.otherUser) {
          setOtherUser(cached.otherUser);
          applyHeaderForOtherUser(cached.otherUser, normalizedMatchId);
        }
        setLoadingThread(false);
      } else if (mounted) {
        setLoadingThread(true);
      }

      await fetchThreadFromNetwork();
    })();

    const unsubscribe = subscribeToMessages(
      normalizedMatchId,
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
          const byIdIndex = prev.findIndex(m => m.id === payload.id);
          if (byIdIndex !== -1) {
            const next = [...prev];
            next[byIdIndex] = { ...next[byIdIndex], ...payload };
            return next;
          }

          const pendingIndex = prev.findIndex(
            m =>
              m.status === "pending" &&
              m.senderId === payload.senderId &&
              m.content === payload.content
          );
          if (pendingIndex !== -1) {
            const next = [...prev];
            next[pendingIndex] = {
              ...next[pendingIndex],
              ...payload,
              status: "sent",
              tempId: next[pendingIndex].tempId ?? next[pendingIndex].id,
            };
            return next.filter((msg, idx) => msg.id !== payload.id || idx === pendingIndex);
          }

          return [...prev, payload];
        });
      }
    );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [normalizedMatchId, user, applyHeaderForOtherUser]);

  useEffect(() => {
    if (!normalizedMatchId || !user) return;
    const cacheKey = getThreadCacheKey(user.id, normalizedMatchId);
    if (threadCacheWriteTimerRef.current) {
      clearTimeout(threadCacheWriteTimerRef.current);
    }
    threadCacheWriteTimerRef.current = setTimeout(() => {
      persistThreadCache(cacheKey, {
        messages,
        matchStatus,
        otherUser,
        timestamp: Date.now(),
      });
      threadCacheWriteTimerRef.current = null;
    }, 200);

    return () => {
      if (threadCacheWriteTimerRef.current) {
        clearTimeout(threadCacheWriteTimerRef.current);
        threadCacheWriteTimerRef.current = null;
      }
    };
  }, [normalizedMatchId, user, messages, matchStatus, otherUser]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 50);
    }
  }, [messages.length]);

  function canEditMessage(message: Message): boolean {
    if (!user) return false;
    return (
      !message.isDeleted &&
      message.status !== "pending" &&
      message.status !== "failed" &&
      message.senderId === user.id &&
      Date.now() - new Date(message.createdAt).getTime() < MESSAGE_SEND_WINDOW_MS
    );
  }

  function canDeleteMessage(message: Message): boolean {
    if (!user) return false;
    return (
      !message.isDeleted &&
      message.status !== "pending" &&
      message.status !== "failed" &&
      message.senderId === user.id &&
      Date.now() - new Date(message.createdAt).getTime() < MESSAGE_SEND_WINDOW_MS
    );
  }

  function canRetryMessage(message: Message): boolean {
    if (!user) return false;
    return (
      message.status === "failed" &&
      message.senderId === user.id
    );
  }

  function isSuspiciousContent(content: string): boolean {
    const lower = content.toLowerCase();
    if (lower.includes("<script")) return true;
    if (content.includes("\u0000")) return true;

    const sqlPattern = /\b(drop|alter|delete|insert|update|union|select)\b/i;
    const injectionMarkers = /(--|\/\*|\*\/|;)/;
    if (sqlPattern.test(content) && injectionMarkers.test(content)) return true;

    return false;
  }

  function getDeletedLabel(message: Message): string {
    if (!user) return "Deleted a message";
    if (message.senderId === user.id) return "You deleted a message";
    const fallbackName = otherUser?.name || "User";
    const senderName = message.sender?.name || fallbackName;
    return `${senderName} deleted a message`;
  }

  function getDisplayContent(message: Message): string {
    if (message.isDeleted) {
      return getDeletedLabel(message);
    }
    return message.content;
  }

  function createLocalMessage(content: string, status: "pending" | "failed"): Message {
    const now = new Date().toISOString();
    const tempId = `local-${Date.now()}`;
    return {
      id: tempId,
      tempId,
      matchId: normalizedMatchId || "local",
      senderId: user?.id || "local",
      content,
      createdAt: now,
      editedAt: null,
      isDeleted: false,
      deletedBy: null,
      deletedAt: null,
      status,
      clientError: status === "failed" ? FAILED_MESSAGE_TEXT : null,
      sender: {
        id: user?.id || "local",
        name: "You",
        profilePicture: null,
      },
    };
  }

  function replaceLocalMessage(localId: string, next: Message) {
    setMessages(prev => {
      const withoutDup = prev.filter(m => m.id !== next.id || m.id === localId);
      return withoutDup.map(m =>
        m.id === localId
          ? { ...next, status: "sent", tempId: m.tempId ?? m.id }
          : m
      );
    });
  }

  function markLocalFailed(localId: string) {
    setMessages(prev =>
      prev.map(m =>
        m.id === localId
          ? { ...m, status: "failed", clientError: FAILED_MESSAGE_TEXT }
          : m
      )
    );
  }

  const handleUnmatch = async () => {
    setMenuVisible(false);
    if (!normalizedMatchId) return;
    setConfirmAction("unmatch");
  };

  const handleBlock = async () => {
    setMenuVisible(false);
    if (!normalizedMatchId) return;
    setConfirmAction("block");
  };

  const handleReport = () => {
    setMenuVisible(false);
    setReportReason("");
    setReportModalVisible(true);
  };

  const runConfirmAction = async () => {
    if (!normalizedMatchId || !confirmAction || confirmingAction) return;
    setConfirmingAction(true);
    try {
      if (confirmAction === "unmatch") {
        await unmatchMatch(normalizedMatchId);
      } else {
        await blockMatch(normalizedMatchId);
      }
      setConfirmAction(null);
      router.replace('/(tabs)/messages');
    } catch (error) {
      const fallback = confirmAction === "unmatch"
        ? "Failed to unmatch. Please try again."
        : "Failed to block user. Please try again.";
      Alert.alert("Error", fallback);
    } finally {
      setConfirmingAction(false);
    }
  };

  const submitReport = async () => {
    const reason = reportReason.trim();
    const targetUserId = otherUser?.id ?? matchStatus?.otherUserId;

    if (!targetUserId) {
      Alert.alert("Error", "Could not determine who to report.");
      return;
    }
    if (reason.length < REPORT_REASON_MIN_LENGTH) {
      Alert.alert("Reason too short", `Please provide at least ${REPORT_REASON_MIN_LENGTH} characters.`);
      return;
    }

    try {
      setSubmittingReport(true);
      await reportUser(targetUserId, reason);
      setReportModalVisible(false);
      setReportReason("");
      Alert.alert("Report sent", "Thank you. This user has been blocked for your safety.");
      router.replace('/(tabs)/messages');
    } catch (error: any) {
      Alert.alert("Failed to report", error?.message || "Please try again.");
    } finally {
      setSubmittingReport(false);
    }
  };

  async function handleSend() {
    if (!user || !normalizedMatchId) return;

    // Validate message
    if (!isMessageValid(text)) return;

    const content = text.trim();
    setText("");

    try {
      if (editingMessage) {
        if (editingMessage.isDeleted) {
          Alert.alert("Can't edit", "This message was deleted.");
          setEditingMessage(null);
          return;
        }
        setSavingEdit(true);
        await editMessage(editingMessage.id, content, normalizedMatchId);
        setEditingMessage(null);
        setSavingEdit(false);
      } else {
        if (isSuspiciousContent(content)) {
          const failed = createLocalMessage(content, "failed");
          setMessages(prev => [...prev, failed]);
          return;
        }

        const localPending = createLocalMessage(content, "pending");
        setMessages(prev => [...prev, localPending]);

        try {
          const created = await sendMessage(normalizedMatchId, content);
          replaceLocalMessage(localPending.id, {
            ...localPending,
            ...created,
            status: "sent",
            clientError: null,
            sender: localPending.sender,
          });
        } catch (err) {
          markLocalFailed(localPending.id);
          throw err;
        }
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
      Alert.alert("Error", FAILED_MESSAGE_TEXT);
      setText(content);
      setSavingEdit(false);
    }
  }

  if (!user) return <Text>Loading...</Text>;

  const isBlocked = matchStatus?.status === "blocked";
  const messageError = getMessageError(text);
  const isMessageTooLong = text.trim().length > MESSAGE_MAX_LENGTH;
  const canSend = isMessageValid(text) && !savingEdit;
  const canEditSelected = selectedMessage ? canEditMessage(selectedMessage) : false;
  const canDeleteSelected = selectedMessage ? canDeleteMessage(selectedMessage) : false;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={80}
    >
      <View style={styles.container}>
        {loadingThread ? (
          <View style={styles.threadLoadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.threadLoadingText}>Loading messages...</Text>
          </View>
        ) : (
          <>
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
          keyExtractor={item => item.id || item.tempId || Math.random().toString()}
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
                      onPress={() =>
                        router.push({
                          pathname: '/messages/profile/[userId]',
                          params: { userId: item.sender.id, matchId: normalizedMatchId },
                        })
                      }
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

                  <View style={styles.messageContentStack}>
                    <Pressable
                      onPress={() => {
                        if (!canRetryMessage(item)) return;
                        setText(item.content);
                      }}
                      onLongPress={() => {
                        if (isBlocked || item.senderId !== user.id) return;
                        setSelectedMessage(item);
                        setActionModalVisible(true);
                      }}
                      style={[
                        styles.messageBubble,
                        isMyMessage ? styles.myMessage : styles.theirMessage,
                        item.isDeleted && styles.deletedMessageBubble,
                        item.status === "failed" && styles.failedMessageBubble
                      ]}
                    >
                      <Text
                        style={[
                          styles.messageText,
                          isMyMessage
                            ? styles.myMessageText
                            : styles.theirMessageText,
                          item.isDeleted && styles.deletedMessageText
                        ]}
                      >
                        {getDisplayContent(item)}
                      </Text>
                    </Pressable>
                    {!item.isDeleted && item.editedAt ? (
                      <Text style={[
                        styles.editedLabel,
                        isMyMessage ? styles.editedLabelMy : styles.editedLabelTheir
                      ]}>
                        edited
                      </Text>
                    ) : null}
                    {item.status === "failed" ? (
                      <Text style={styles.failedLabel}>{FAILED_MESSAGE_TEXT}</Text>
                    ) : null}
                  </View>
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
                  if (!selectedMessage || !canEditSelected) return;
                  setEditingMessage(selectedMessage);
                  setText(selectedMessage.content);
                  setActionModalVisible(false);
                }}
                disabled={!canEditSelected}
              >
                <Text style={[styles.modalAction, !canEditSelected && styles.modalActionDisabled]}>
                  Edit
                </Text>
              </Pressable>

              <Pressable
                onPress={async () => {
                  if (!selectedMessage) return;
                  if (selectedMessage.status === "failed") {
                    setMessages(prev => prev.filter(m => m.id !== selectedMessage.id));
                    setActionModalVisible(false);
                    return;
                  }
                  if (!canDeleteSelected || !normalizedMatchId) return;
                  try {
                    await deleteMessage(normalizedMatchId, selectedMessage.id);
                  } catch (err: any) {
                    Alert.alert("Error", err?.message || "Failed to delete message");
                  } finally {
                    setActionModalVisible(false);
                  }
                }}
                disabled={!selectedMessage || (selectedMessage.status !== "failed" && !canDeleteSelected)}
              >
                <Text style={[
                  styles.modalAction,
                  styles.modalActionDelete,
                  (!selectedMessage || (selectedMessage.status !== "failed" && !canDeleteSelected)) && styles.modalActionDisabled
                ]}>
                  Delete
                </Text>
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

        {/* Report Modal */}
        <Modal transparent animationType="fade" visible={reportModalVisible}>
          <Pressable
            style={styles.modalOverlay}
            onPress={() => {
              if (submittingReport) return;
              setReportModalVisible(false);
            }}
          >
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Report user</Text>
              <Text style={styles.modalSubtitle}>
                Tell us what happened
              </Text>
              <TextInput
                value={reportReason}
                onChangeText={setReportReason}
                placeholder="Describe the issue..."
                maxLength={REPORT_REASON_MAX_LENGTH}
                multiline
                style={styles.reportInput}
              />
              <View style={styles.reportActions}>
                <Pressable
                  style={[styles.reportButton, styles.reportCancelButton]}
                  onPress={() => setReportModalVisible(false)}
                  disabled={submittingReport}
                >
                  <Text style={styles.reportCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.reportButton, styles.reportSubmitButton, submittingReport && styles.sendButtonDisabled]}
                  onPress={submitReport}
                  disabled={submittingReport}
                >
                  <Text style={styles.reportSubmitText}>{submittingReport ? "Sending..." : "Send report"}</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Modal>
        <Modal transparent animationType="fade" visible={!!confirmAction}>
          <Pressable
            style={styles.modalOverlay}
            onPress={() => {
              if (confirmingAction) return;
              setConfirmAction(null);
            }}
          >
            <View style={styles.confirmBox}>
              <Text style={styles.confirmTitle}>
                {confirmAction === "unmatch" ? "Unmatch" : "Block user"}
              </Text>
              <Text style={styles.confirmBody}>
                {confirmAction === "unmatch"
                  ? "Are you sure you want to unmatch this person?"
                  : "Are you sure you want to block this user?"}
              </Text>
              <View style={styles.confirmActions}>
                <Pressable
                  style={[styles.reportButton, styles.reportCancelButton]}
                  disabled={confirmingAction}
                  onPress={() => setConfirmAction(null)}
                >
                  <Text style={styles.reportCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.reportButton,
                    styles.reportSubmitButton,
                    confirmingAction && styles.sendButtonDisabled,
                  ]}
                  disabled={confirmingAction}
                  onPress={runConfirmAction}
                >
                  <Text style={styles.reportSubmitText}>
                    {confirmingAction
                      ? "Please wait..."
                      : confirmAction === "unmatch"
                        ? "Unmatch"
                        : "Block"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Modal>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  threadLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  threadLoadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
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
  messageContentStack: {
    maxWidth: "70%",
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
  deletedMessageBubble: {
    backgroundColor: COLORS.gray100,
    borderStyle: 'dashed',
  },
  deletedMessageText: {
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  failedMessageBubble: {
    borderColor: COLORS.danger,
  },
  editedLabel: {
    marginTop: 4,
    fontSize: 12,
    fontStyle: 'italic',
  },
  editedLabelMy: {
    color: COLORS.textMuted,
    alignSelf: 'flex-end',
  },
  editedLabelTheir: {
    color: COLORS.textMuted,
    alignSelf: 'flex-start',
  },
  failedLabel: {
    marginTop: 6,
    fontSize: 12,
    color: COLORS.danger,
    fontWeight: "600",
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
    width: 220,
    borderWidth: BORDERS.thin,
    borderColor: COLORS.border,
    ...SHADOWS.medium,
  },
  confirmBox: {
    backgroundColor: COLORS.surface,
    padding: 20,
    borderRadius: RADIUS.medium,
    width: '88%',
    maxWidth: 360,
    borderWidth: BORDERS.thin,
    borderColor: COLORS.border,
    ...SHADOWS.medium,
  },
  confirmTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  confirmBody: {
    fontSize: 18,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginBottom: 16,
    lineHeight: 26,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalAction: {
    fontSize: 16,
    paddingVertical: 12,
    textAlign: "center",
    fontWeight: '600',
  },
  modalActionDelete: {
    color: COLORS.danger,
  },
  modalActionDisabled: {
    color: COLORS.textLight,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 12,
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
  },

  reportInput: {
    minHeight: 180,
    borderWidth: BORDERS.thin,
    borderColor: COLORS.border,
    borderRadius: RADIUS.small,
    padding: 10,
    fontSize: 16,
    textAlignVertical: 'top',
    backgroundColor: COLORS.gray100,
  },
  reportActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  reportButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: RADIUS.small,
    borderWidth: BORDERS.thin,
    borderColor: COLORS.border,
  },
  reportCancelButton: {
    backgroundColor: COLORS.surface,
  },
  reportSubmitButton: {
    backgroundColor: COLORS.danger,
  },
  reportCancelText: {
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  reportSubmitText: {
    fontWeight: '700',
    color: COLORS.surface,
  },
});
