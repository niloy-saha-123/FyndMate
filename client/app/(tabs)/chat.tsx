/**
 * @file client/app/(tabs)/chat.tsx
 * @description Chats/Matches Screen with Neo-brutalist design
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
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/AuthProvider';
import {
  getMyMatches,
  hideMatch,
  blockMatch,
  unblockMatch,
} from '../../src/chat/chat.service';
import { supabase } from '../../src/auth/supabaseClient';
import { COLORS, SHADOWS, BORDERS, RADIUS } from '../../src/theme/colors';
import { NeoCard } from '../../src/components/NeoCard';
import { formatRelativeTime } from '../../src/utils/timeFormatting';

export default function ChatTab() {
  const { top, bottom } = useSafeAreaInsets();
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
          setMatches((prev) => prev.filter((m) => m.id !== payload.old.id));
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
            setMatches((prev) => prev.filter((m) => m.id !== updated.id));
          } else {
            const fresh = await getMyMatches(user.id);
            setMatches(fresh);
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
          setMatches((prev) =>
            prev.map((match) => {
              if (match.id !== msg.matchId) return match;
              if (match.status === 'blocked') return match;

              const unreadIncrement = msg.senderId !== user.id ? 1 : 0;

              return {
                ...match,
                lastMessage: msg,
                unreadCount: match.unreadCount + unreadIncrement,
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
    return (
      <View style={[styles.container, { paddingTop: top }]}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!user) {
    return null;
  }

    const renderChatItem = ({ item }: { item: any }) => {
    const isUser1 = item.user1Id === user?.id;
    const otherUser = isUser1 ? item.user2 : item.user1;
    const isBlocked = item.status === 'blocked';
    const iBlockedThem = isBlocked && item.blockedBy === user.id;
    const theyBlockedMe = isBlocked && item.blockedBy !== user.id;

    return (
      <Pressable
        onPress={() => router.push(`/chat/${item.id}`)}
        onLongPress={() => {
          if (iBlockedThem) {
            Alert.alert('Chat options', 'What would you like to do?', [
              {
                text: 'Unblock user',
                onPress: async () => {
                  await unblockMatch(item.id);
                  const fresh = await getMyMatches(user.id);
                  setMatches(fresh);
                },
              },
              {
                text: 'Remove from my chats',
                onPress: async () => {
                  await hideMatch(item.id);
                  setMatches((prev) => prev.filter((m) => m.id !== item.id));
                },
              },
              { text: 'Cancel', style: 'cancel' },
            ]);
          } else if (!theyBlockedMe) {
            Alert.alert('Chat options', 'What would you like to do?', [
              {
                text: 'Remove from my chats',
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
            styles.chatCard,
            isBlocked && styles.chatCardBlocked,
          ]}
          shadowSize="small"
        >
          <View style={styles.chatContent}>
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
              {!isBlocked && item.unreadCount === 0 && (
                <View style={styles.onlineIndicator} />
              )}
            </View>

            {/* Chat Info */}
            <View style={styles.chatInfo}>
              <View style={styles.chatHeader}>
                <Text style={styles.chatName}>{otherUser?.name ?? 'Unknown user'}</Text>
                {item.lastMessage && (
                  <Text style={styles.lastMessageTime}>
                    {formatRelativeTime(item.lastMessage.createdAt)}
                  </Text>
                )}
              </View>
              <Text
                numberOfLines={1}
                style={[
                  styles.chatMessage,
                  item.unreadCount > 0 && !isBlocked && styles.chatMessageUnread,
                  isBlocked && styles.chatMessageBlocked,
                ]}
              >
                {theyBlockedMe
                  ? 'You have been blocked'
                  : iBlockedThem
                    ? 'You blocked this user'
                    : item.lastMessage
                      ? item.lastMessage.content
                      : 'Start a conversation'}
              </Text>
            </View>

            {/* Right Side */}
            <View style={styles.chatRight}>
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
        <View style={styles.headerLeft}>
          <Ionicons
            name="chatbubble"
            size={24}
            color={COLORS.primaryGradient}
            style={{ marginRight: 8 }}
          />
          <Text style={styles.headerTitle}>Chats</Text>
        </View>
      </View>

      {/* Chat List */}
      <FlatList
        data={matches}
        keyExtractor={(item) => item.id}
        renderItem={renderChatItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: bottom + 80 },
        ]}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <NeoCard style={styles.emptyCard}>
              <View style={styles.emptyIconContainer}>
                <Ionicons
                  name="chatbubbles-outline"
                  size={48}
                  color={COLORS.primary}
                />
              </View>
              <Text style={styles.emptyTitle}>No chats yet</Text>
              <Text style={styles.emptySubtitle}>
                When you match with someone, your conversations will appear here.
              </Text>
            </NeoCard>
          </View>
        }
      />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: COLORS.background,
    borderBottomWidth: BORDERS.thin,
    borderBottomColor: COLORS.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },

  // List
  listContent: {
    padding: 16,
  },

  // Chat Card
  chatCard: {
    marginBottom: 12,
    padding: 12,
  },
  chatCardBlocked: {
    opacity: 0.6,
    backgroundColor: COLORS.gray100,
  },
  chatContent: {
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
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.success,
    borderWidth: 2,
    borderColor: COLORS.border,
  },

  // Chat Info
  chatInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  lastMessageTime: {
    fontSize: 12,
    color: COLORS.textLight,
    fontWeight: '500',
  },
  chatMessage: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  chatMessageUnread: {
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  chatMessageBlocked: {
    fontStyle: 'italic',
    color: COLORS.textLight,
  },

  // Right Side
  chatRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
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
