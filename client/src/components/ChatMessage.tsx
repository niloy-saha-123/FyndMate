/**
 * @file client/src/components/ChatMessage.tsx
 * @description Enhanced chat message component with profile pictures, names, and smart formatting
 */

import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { formatRelativeTime, formatAbsoluteTime, areMessagesInBurst } from "../utils/timeFormatting";
import { getOptimizedImageUrl, ImageSizes } from "../utils/imageOptimization";
import { COLORS } from "../theme/colors";

interface ChatMessageProps {
  message: {
    id: string;
    senderId: string;
    sender: {
      id: string;
      name: string;
      profilePicture: string | null;
    };
    content: string;
    createdAt: string;
    editedAt?: string | null;
  };
  currentUser: {
    id: string;
    timezone?: string;
  };
  previousMessage?: {
    senderId: string;
    createdAt: string;
  } | null;
  nextMessage?: {
    senderId: string;
    createdAt: string;
  } | null;
  showTimestamp: boolean;
}

export function ChatMessage({
  message,
  currentUser,
  previousMessage,
  nextMessage,
  showTimestamp
}: ChatMessageProps) {
  const router = useRouter();
  const isMyMessage = message.senderId === currentUser.id;
  const showSenderInfo = !isMyMessage;
  const showAvatar = showSenderInfo && (!previousMessage || !areMessagesInBurst(previousMessage, message));
  const showName = showSenderInfo && showAvatar;
  const showTime = showTimestamp;

  const handleAvatarPress = () => {
    if (!isMyMessage) {
      router.push(`/profile/${message.sender.id}`);
    }
  };

  return (
    <View style={[
      styles.container,
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
            onPress={handleAvatarPress}
            style={styles.avatarContainer}
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
      
      {showTime && (
        <Text style={[
          styles.timestamp,
          isMyMessage ? styles.myTimestamp : styles.theirTimestamp
        ]}>
          {formatRelativeTime(message.createdAt, currentUser.timezone)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  myMessageContainer: {
    alignItems: "flex-end",
  },
  theirMessageContainer: {
    alignItems: "flex-start",
  },
  senderName: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginBottom: 4,
    marginLeft: 52, // Account for avatar width + spacing
  },
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
  avatarContainer: {
    marginRight: 8,
    marginBottom: 4,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  avatarPlaceholder: {
    backgroundColor: COLORS.gray200,
    justifyContent: "center",
    alignItems: "center",
  },
  messageBubble: {
    maxWidth: "75%",
    padding: 12,
    borderRadius: 18,
  },
  myBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 6,
  },
  theirBubble: {
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  myMessageText: {
    color: COLORS.surface,
  },
  theirMessageText: {
    color: COLORS.textPrimary,
  },
  editedText: {
    fontSize: 11,
    color: COLORS.textLight,
    fontStyle: "italic",
    marginTop: 2,
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
  },
  myTimestamp: {
    color: COLORS.textLight,
    marginRight: 8,
  },
  theirTimestamp: {
    color: COLORS.textLight,
    marginLeft: 52, // Align with message start
  },
});