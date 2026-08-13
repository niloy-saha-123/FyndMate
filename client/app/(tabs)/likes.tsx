/**
 * @file client/app/(tabs)/likes.tsx
 * @description Requests/Likes Screen with Neo-brutalist design
 */

import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    TextInput,
    Modal,
    TouchableOpacity,
    Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLikes } from '@/src/hooks/useLikes';
import { Like } from '@/src/services/matchingService';
import { useAuth } from '@/src/auth/AuthProvider';
import { router, useLocalSearchParams } from 'expo-router';
import { COLORS, SHADOWS, BORDERS, RADIUS } from '@/src/theme/colors';
import { NeoCard } from '@/src/components/NeoCard';
import { NeoButton } from '@/src/components/NeoButton';

export default function LikesScreen() {
    const { bottom } = useSafeAreaInsets();
    const { isAuthenticated } = useAuth();
    const { likes, loading, error, fetchLikes, onAccept, onDecline } = useLikes();
    const { refreshAt } = useLocalSearchParams<{ refreshAt?: string | string[] }>();
    const normalizedRefreshAt = Array.isArray(refreshAt) ? refreshAt[0] : refreshAt;

    const [selectedLike, setSelectedLike] = useState<Like | null>(null);
    const [replyText, setReplyText] = useState('');
    const [declineTarget, setDeclineTarget] = useState<Like | null>(null);
    const [declineSubmitting, setDeclineSubmitting] = useState(false);
    const MAX_REPLY_LENGTH = 500;

    useEffect(() => {
        fetchLikes({ silent: true });
    }, [fetchLikes, normalizedRefreshAt]);

    const handleAccept = async () => {
        if (!selectedLike) return;
        await onAccept(selectedLike.id, replyText);
        setSelectedLike(null);
        setReplyText('');
    };

    const handleDecline = async (likeId: string) => {
        await onDecline(likeId);
    };

    const confirmDecline = async () => {
        if (!declineTarget) return;
        setDeclineSubmitting(true);
        try {
            await onDecline(declineTarget.id);
        } finally {
            setDeclineSubmitting(false);
            setDeclineTarget(null);
        }
    };

    const renderItem = ({ item }: { item: Like }) => {
        return (
            <NeoCard style={styles.requestCard}>
                {/* Star Badge */}
                {/* Star Badge - REMOVED as per user request */}
                {/* <View style={styles.starBadge}>
                    <Ionicons name="star" size={12} color={COLORS.textPrimary} />
                </View> */}

                {/* Header */}
                <View style={styles.requestHeader}>
                    <TouchableOpacity
                        style={styles.avatarContainer}
                        onPress={() =>
                            router.push({
                                pathname: '/messages/profile/[userId]',
                                params: {
                                    userId: item.likerUser.id,
                                    mode: 'request',
                                    likeId: item.id,
                                    introMessage: item.message ?? '',
                                },
                            })
                        }
                    >
                        {item.likerUser.profilePicture ? (
                            <Image
                                source={{ uri: item.likerUser.profilePicture }}
                                style={styles.avatar}
                            />
                        ) : (
                            <View style={[styles.avatar, styles.noPhotoPlaceholder]}>
                                <Ionicons name="person" size={30} color={COLORS.border} />
                            </View>
                        )}
                    </TouchableOpacity>
                    <View style={styles.requestHeaderInfo}>
                        <Text style={styles.requestName}>{item.likerUser.name}</Text>
                        <Text style={styles.requestMeta}>
                            {formatDate(item.createdAt)}
                        </Text>
                    </View>
                </View>

                {/* Message */}
                <View style={styles.messageBox}>
                    <Text style={styles.messageLabel}>They said:</Text>
                    <Text style={styles.messageText}>&quot;{item.message}&quot;</Text>
                </View>

                {/* Actions */}
                <View style={styles.requestActions}>
                    <View style={styles.requestActionSlot}>
                        <NeoButton
                            title="Decline"
                            onPress={() => setDeclineTarget(item)}
                            variant="secondary"
                            size="small"
                            fullWidth
                            style={styles.requestActionButton}
                        />
                    </View>
                    <View style={styles.requestActionSlot}>
                        <NeoButton
                            title="Accept"
                            onPress={() => setSelectedLike(item)}
                            size="small"
                            fullWidth
                            style={styles.requestActionButton}
                        />
                    </View>
                </View>
            </NeoCard>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Requests</Text>
            </View>

            {/* Content */}
            {loading && likes.length === 0 ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.loadingText}>Loading requests...</Text>
                </View>
            ) : error ? (
                <View style={styles.centerContainer}>
                    <NeoCard style={styles.errorCard}>
                        <Ionicons name="alert-circle" size={48} color={COLORS.danger} />
                        <Text style={styles.errorText}>{error}</Text>
                        <NeoButton title="Retry" onPress={fetchLikes} />
                    </NeoCard>
                </View>
            ) : (
                <FlatList
                    data={likes}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    refreshing={loading}
                    onRefresh={fetchLikes}
                    contentContainerStyle={[
                        styles.listContent,
                        { paddingBottom: bottom + 80 },
                    ]}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <NeoCard style={styles.emptyCard}>
                                <View style={styles.emptyIconContainer}>
                                    <Ionicons name="mail-open-outline" size={48} color={COLORS.primary} />
                                </View>
                                <Text style={styles.emptyTitle}>No pending requests</Text>
                                <Text style={styles.emptySubtitle}>
                                    When someone sends you a collaboration request, it will appear here.
                                </Text>
                            </NeoCard>
                        </View>
                    }
                />
            )}

            {/* Reply Modal */}
            <Modal
                visible={!!selectedLike}
                animationType="slide"
                transparent
                onRequestClose={() => setSelectedLike(null)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setSelectedLike(null)}
                >
                    <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
                        {/* Modal Handle */}
                        <View style={styles.modalHandle} />

                        {/* Modal Header */}
                        <Text style={styles.modalTitle}>
                            Match with {selectedLike?.likerUser.name}
                        </Text>
                        <Text style={styles.modalSubtitle}>Send a message or match instantly</Text>

                        {/* Quote */}
                        <View style={styles.quoteBox}>
                            <Text style={styles.quoteText}>&quot;{selectedLike?.message}&quot;</Text>
                        </View>

                        {/* Reply Input */}
                        <TextInput
                            style={styles.replyInput}
                            placeholder="Send a reply..."
                            placeholderTextColor={COLORS.textLight}
                            value={replyText}
                            onChangeText={setReplyText}
                            maxLength={MAX_REPLY_LENGTH}
                            multiline
                            textAlignVertical="top"
                            autoFocus
                        />
                        <Text style={styles.replyCount}>
                            {replyText.length}/{MAX_REPLY_LENGTH}
                        </Text>

                        {/* Actions */}
                        <View style={styles.modalActions}>
                            <NeoButton
                                title="Cancel"
                                onPress={() => setSelectedLike(null)}
                                variant="secondary"
                            />
                            <NeoButton
                                title="Accept"
                                onPress={handleAccept}
                                disabled={replyText.length > MAX_REPLY_LENGTH}
                                style={{ flex: 1, marginLeft: 12 }}
                            />
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            {/* Decline Confirmation Modal */}
            <Modal
                visible={!!declineTarget}
                animationType="fade"
                transparent
                onRequestClose={() => {
                    if (!declineSubmitting) setDeclineTarget(null);
                }}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => {
                        if (!declineSubmitting) setDeclineTarget(null);
                    }}
                >
                    <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
                        <View style={styles.modalHandle} />
                        <Text style={styles.modalTitle}>
                            Decline {declineTarget?.likerUser.name}?
                        </Text>
                        <Text style={styles.modalSubtitle}>
                            This will remove their request.
                        </Text>

                        <View style={styles.modalActionsRow}>
                            <NeoButton
                                title="Cancel"
                                onPress={() => setDeclineTarget(null)}
                                variant="secondary"
                                size="small"
                                style={{ flex: 1 }}
                                disabled={declineSubmitting}
                            />
                            <NeoButton
                                title={declineSubmitting ? "Declining..." : "Decline"}
                                onPress={confirmDecline}
                                variant="danger"
                                size="small"
                                style={{ flex: 1, marginLeft: 8 }}
                                disabled={declineSubmitting}
                            />
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1d ago';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
        paddingTop: 12,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
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

    // Request Card
    requestCard: {
        marginBottom: 16,
        padding: 16,
        position: 'relative',
    },
    starBadge: {
        position: 'absolute',
        top: -8,
        right: -8,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: COLORS.yellow,
        borderWidth: 2,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    requestHeader: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    avatarContainer: {
        position: 'relative',
        marginRight: 12,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 2,
        borderColor: COLORS.border,
    },
    noPhotoPlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.gray200,
    },
    requestHeaderInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    requestName: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: 2,
    },
    requestMeta: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.skillText,
    },

    // Message
    messageBox: {
        backgroundColor: COLORS.gray100,
        padding: 12,
        borderRadius: RADIUS.small,
        borderWidth: BORDERS.thin,
        borderColor: COLORS.border,
        marginBottom: 12,
    },
    messageLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: COLORS.textMuted,
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    messageText: {
        fontSize: 14,
        fontWeight: '500',
        color: COLORS.textSecondary,
        fontStyle: 'italic',
        lineHeight: 20,
    },

    // Actions
    requestActions: {
        flexDirection: 'row',
        gap: 8,
    },
    requestActionSlot: {
        flex: 1,
        minWidth: 0,
    },
    requestActionButton: {
        width: '100%',
    },

    // Loading/Error/Empty
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    errorCard: {
        alignItems: 'center',
        padding: 32,
        width: '100%',
    },
    errorText: {
        fontSize: 16,
        color: COLORS.danger,
        textAlign: 'center',
        marginVertical: 16,
    },
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

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        borderTopWidth: BORDERS.medium,
        borderColor: COLORS.border,
    },
    modalHandle: {
        width: 48,
        height: 6,
        borderRadius: 3,
        backgroundColor: COLORS.textPrimary,
        alignSelf: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: COLORS.textPrimary,
        marginBottom: 8,
    },
    modalSubtitle: {
        fontSize: 14,
        fontWeight: '500',
        color: COLORS.textMuted,
        marginBottom: 16,
    },
    modalActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
    },
    quoteBox: {
        borderLeftWidth: 4,
        borderLeftColor: COLORS.primary,
        backgroundColor: COLORS.gray100,
        padding: 12,
        borderRadius: RADIUS.small,
        marginBottom: 16,
    },
    quoteText: {
        fontSize: 16,
        fontWeight: '500',
        fontStyle: 'italic',
        color: COLORS.textSecondary,
    },
    replyInput: {
        borderWidth: BORDERS.thin,
        borderColor: COLORS.border,
        borderRadius: RADIUS.medium,
        padding: 16,
        fontSize: 16,
        fontWeight: '500',
        color: COLORS.textPrimary,
        backgroundColor: COLORS.surface,
        minHeight: 100,
        marginBottom: 20,
        ...SHADOWS.medium,
    },
    replyCount: {
        fontSize: 12,
        color: COLORS.textMuted,
        textAlign: 'right',
        marginTop: -12,
        marginBottom: 12,
    },
    modalActions: {
        flexDirection: 'row',
    },
});
