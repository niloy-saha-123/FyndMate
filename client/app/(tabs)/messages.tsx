/**
 * @file client/app/(tabs)/messages.tsx
 * @description Messages/Matches Screen with Neo-brutalist design
 */

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/AuthProvider';
import {
  getMyMatches,
  hideMatch,
  blockMatch,
  unblockMatch,
} from '../../src/messages/message.service';
import { supabase } from '../../src/auth/supabaseClient';
import { COLORS, SHADOWS, BORDERS, RADIUS } from '../../src/theme/colors';
import { NeoCard } from '../../src/components/NeoCard';
import { formatRelativeTime, convertToLocalTime } from '../../src/utils/timeFormatting';

const MESSAGES_CACHE_PREFIX = 'fyndmate_messages_cache:';

type MessagesCache = {
  matches: any[];
  timestamp: number;
};

async function loadMessagesCache(userId: string): Promise<any[] | null> {
  try {
    const raw = await AsyncStorage.getItem(`${MESSAGES_CACHE_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MessagesCache;
    return Array.isArray(parsed.matches) ? parsed.matches : null;
  } catch {
    return null;
  }
}

function persistMessagesCache(userId: string, matches: any[]) {
  const payload: MessagesCache = {
    matches,
    timestamp: Date.now(),
  };
  AsyncStorage.setItem(`${MESSAGES_CACHE_PREFIX}${userId}`, JSON.stringify(payload)).catch(() => {});
}

export default function MessagesTab() {
  const { top, bottom } = useSafeAreaInsets();
  const { user, loading } = useAuth();
  const [matches, setMatches] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);

  useEffect(() => {
    if (!user || loading) return;

    let mounted = true;

    (async () => {
      const cached = await loadMessagesCache(user.id);
      if (mounted && cached && cached.length > 0) {
        setMatches(cached);
        setLoadingMessages(false);
      } else if (mounted) {
        setLoadingMessages(true);
      }

      try {
        const fresh = await getMyMatches(user.id);
        if (!mounted) return;
        setMatches(fresh);
        persistMessagesCache(user.id, fresh);
      } catch (error) {
        console.error(error);
      } finally {
        if (mounted) {
          setLoadingMessages(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user, loading]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`message-list-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'Match',
        },
        async (payload) => {
          const match = payload.new;
          if (match.user1Id !== user.id && match.user2Id !== user.id) return;
          const fresh = await getMyMatches(user.id);
          setMatches(fresh);
          persistMessagesCache(user.id, fresh);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'Match',
        },
        (payload) => {
          setMatches((prev) => {
            const next = prev.filter((m) => m.id !== payload.old.id);
            persistMessagesCache(user.id, next);
            return next;
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'Match',
        },
        async (payload) => {
          const updated = payload.new;
          if (updated.status === 'hidden') {
            setMatches((prev) => {
              const next = prev.filter((m) => m.id !== updated.id);
              persistMessagesCache(user.id, next);
              return next;
            });
          } else {
            const fresh = await getMyMatches(user.id);
            setMatches(fresh);
            persistMessagesCache(user.id, fresh);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'Message',
        },
        (payload) => {
          const msg = payload.new;
          setMatches((prev) => {
            const next = prev.map((match) => {
              if (match.id !== msg.matchId) return match;
              if (match.status === 'blocked') return match;

              const unreadIncrement = msg.senderId !== user.id ? 1 : 0;

              return {
                ...match,
                lastMessage: msg,
                unreadCount: match.unreadCount + unreadIncrement,
              };
            });
            persistMessagesCache(user.id, next);
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: top }]}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!user) {
    return null;
  }

  const renderMessageItem = ({ item }: { item: any }) => {
    const isUser1 = item.user1Id === user?.id;
    const otherUser = isUser1 ? item.user2 : item.user1;
    const isBlocked = item.status === 'blocked';
    const iBlockedThem = isBlocked && item.blockedBy === user.id;
    const theyBlockedMe = isBlocked && item.blockedBy !== user.id;
    const lastMessage = item.lastMessage;

    const deletedLabel = () => {
      if (!lastMessage) return 'Start a conversation';
      if (lastMessage.senderId === user?.id) {
        return 'You deleted a message';
      }
      const name = otherUser?.name ?? 'User';
      return `${name} deleted a message`;
    };

    // Format last message time
    const lastMessageTime = lastMessage?.createdAt
      ? formatRelativeTime(convertToLocalTime(item.lastMessage.createdAt))
      : '';

    return (
      <Pressable
        onPress={() => router.push(`/messages/${item.id}`)}
        onLongPress={() => {
          if (iBlockedThem) {
            Alert.alert('Message options', 'What would you like to do?', [
              {
                text: 'Unblock user',
                onPress: async () => {
                  await unblockMatch(item.id);
                  const fresh = await getMyMatches(user.id);
                  setMatches(fresh);
                },
              },
              {
                text: 'Remove from my messages',
                onPress: async () => {
                  await hideMatch(item.id);
                  setMatches((prev) => prev.filter((m) => m.id !== item.id));
                },
              },
              { text: 'Cancel', style: 'cancel' },
            ]);
          } else if (!theyBlockedMe) {
            Alert.alert('Message options', 'What would you like to do?', [
              {
                text: 'Remove from my messages',
                onPress: async () => {
                  await hideMatch(item.id);
                  setMatches((prev) => prev.filter((m) => m.id !== item.id));
                },
              },
              {
                text: 'Block user',
                style: 'destructive',
                onPress: async () => {
                  await blockMatch(item.id);
                  const fresh = await getMyMatches(user.id);
                  setMatches(fresh);
                },
              },
              { text: 'Cancel', style: 'cancel' },
            ]);
          }
        }}
      >
        <NeoCard
          style={[
            styles.messageCard,
            isBlocked && styles.messageCardBlocked,
          ]}
          shadowSize="small"
        >
          <View style={styles.messageContent}>
            {/* Avatar */}
            <View style={styles.avatarContainer}>
              {otherUser?.profilePicture ? (
                <Image
                  source={{ uri: otherUser.profilePicture }}
                  style={styles.avatar}
                />
              ) : (
                <View style={[styles.avatar, styles.noPhotoPlaceholder]}>
                  <Ionicons name="person" size={24} color={COLORS.border} />
                </View>
              )}
            </View>

            {/* Message Info */}
            <View style={styles.messageInfo}>
              <Text style={styles.messageName}>{otherUser?.name ?? 'Unknown user'}</Text>
              <Text
                numberOfLines={1}
                style={[
                  styles.messagePreview,
                  item.unreadCount > 0 && !isBlocked && styles.messagePreviewUnread,
                  isBlocked && styles.messagePreviewBlocked,
                ]}
              >
                {theyBlockedMe
                  ? 'You have been blocked'
                  : iBlockedThem
                    ? 'You blocked this user'
                    : lastMessage
                      ? lastMessage.isDeleted
                        ? deletedLabel()
                        : lastMessage.content
                      : 'Start a conversation'}
              </Text>
            </View>

            {/* Right Side - Time and Unread */}
            <View style={styles.messageRight}>
              {item.lastMessage && (
                <Text style={styles.lastMessageTime}>{lastMessageTime}</Text>
              )}
              {item.unreadCount > 0 && !isBlocked && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>
                    {item.unreadCount > 9 ? '9+' : item.unreadCount}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </NeoCard>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      {loadingMessages && matches.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(item) => item.id}
          renderItem={renderMessageItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: bottom + 80 },
          ]}
          refreshing={loadingMessages}
          onRefresh={async () => {
            if (!user) return;
            setLoadingMessages(true);
            try {
              const fresh = await getMyMatches(user.id);
              setMatches(fresh);
              persistMessagesCache(user.id, fresh);
            } finally {
              setLoadingMessages(false);
            }
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <NeoCard style={styles.emptyCard}>
                <View style={styles.emptyIconContainer}>
                  <Ionicons
                    name="mail-open-outline"
                    size={48}
                    color={COLORS.primary}
                  />
                </View>
                <Text style={styles.emptyTitle}>No messages yet</Text>
                <Text style={styles.emptySubtitle}>
                  When you match with someone, your conversations will appear here.
                </Text>
              </NeoCard>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Header
  header: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.background,
    borderBottomWidth: BORDERS.thin,
    borderBottomColor: COLORS.border,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
    textAlign: 'left',
  },

  // List
  listContent: {
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  // Message Card
  messageCard: {
    marginBottom: 12,
    padding: 12,
  },
  messageCardBlocked: {
    opacity: 0.6,
    backgroundColor: COLORS.gray100,
  },
  messageContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Avatar
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  noPhotoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.gray200,
  },
  // Message Info
  messageInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  messageName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  messagePreview: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  messagePreviewUnread: {
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  messagePreviewBlocked: {
    fontStyle: 'italic',
    color: COLORS.textLight,
  },

  // Right Side
  messageRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  lastMessageTime: {
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: 4,
    fontWeight: '500',
  },
  unreadBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    ...SHADOWS.small,
  },
  unreadText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.surface,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyCard: {
    alignItems: 'center',
    padding: 32,
    width: '100%',
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.skillBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: BORDERS.medium,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  // Loading
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 20,
  },
});
