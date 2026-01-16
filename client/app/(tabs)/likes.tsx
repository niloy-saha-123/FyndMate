/**
 * @file client/app/(tabs)/likes.tsx
 * @description SKELETON SCREEN for the "Likes Section" (Inbox).
 * 
 * TODO (DESIGN) - CRITICAL UI INSTRUCTIONS:
 * 1. **Grid vs List**:
 *    - Default to a **Grid Layout (2 columns)** for visual appeal.
 *    - Each cell shows the user's main photo.
 *    - Overlay a small "Message Icon" 💬 if they sent a message.
 * 
 * 2. **Blur Effect (Premium Upgrade)**:
 *    - If the user is NOT a premium subscriber, apply a Blur Effect (10px radius) to the photo.
 *    - Show a "Upgrade to see who likes you" CTA button in the center.
 * 
 * 3. **Interaction**:
 *    - Tapping a user opens a **Modal Profile View** (similar to Feed but static).
 *    - The Modal MUST show the "Liker's Message" prominently at the top.
 *    - Two floating buttons: "Match" (Reply) and "Pass".
 */

import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, FlatList, ActivityIndicator, TextInput, Modal, TouchableOpacity } from 'react-native';
import { useLikes } from '@/src/hooks/useLikes';
import { Like } from '@/src/services/matchingService';
import { useAuth } from '@/src/auth/AuthProvider';

export default function LikesScreen() {
    const { isAuthenticated } = useAuth();
    const { likes, loading, error, fetchLikes, onAccept, onDecline } = useLikes();

    // Local state for replying
    const [selectedLike, setSelectedLike] = useState<Like | null>(null);
    const [replyText, setReplyText] = useState("");

    useEffect(() => {
        fetchLikes();
    }, [fetchLikes]); // Fetch on mount

    const handleAccept = async () => {
        if (!selectedLike) return;
        await onAccept(selectedLike.id, replyText);
        setSelectedLike(null);
        setReplyText("");
        alert("It's a Match!");
    };

    const renderItem = ({ item }: { item: Like }) => (
        /* 
           TODO (DESIGN): CARD STYLING
           - If Grid: Aspect Ratio 3:4.
           - Image as background.
           - Gradient overlay at bottom for text readability.
        */
        <View style={styles.card}>
            {/* HEADER: Who Liked Me */}
            <View style={styles.header}>
                <Text style={styles.name}>{item.likerUser.name}</Text>
                <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>

            {/* 
               TODO (DESIGN): MESSAGE BUBBLE
               - This is the USP (Unique Selling Point) of Hinge/FyndMate.
               - Make this look like a "Quote" or a "bubble" coming from their photo.
               - Font: Italic, Serif?
            */}
            <View style={styles.messageBox}>
                <Text style={styles.messageLabel}>They said:</Text>
                <Text style={styles.messageText}>"{item.message}"</Text>
            </View>

            {/* ACTIONS */}
            <View style={styles.actions}>
                <Button title="❌ Remove" onPress={() => onDecline(item.id)} color="gray" />
                {/* TODO (DESIGN): Highlight this button as the "Happy Path" */}
                <Button title="💬 Reply & Match" onPress={() => setSelectedLike(item)} />
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <Text style={styles.pageTitle}>Likes You ({likes.length})</Text>

            {loading && <ActivityIndicator />}
            {error && <Text style={styles.error}>{error}</Text>}

            <FlatList
                data={likes}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                refreshing={loading}
                onRefresh={fetchLikes}
                ListEmptyComponent={<Text style={styles.empty}>No pending likes yet.</Text>}
            />

            {/* REPLY MODAL (Designing logic for "Reply to Match") */}
            <Modal visible={!!selectedLike} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Match with {selectedLike?.likerUser.name}</Text>
                        <Text>Respond to their message:</Text>
                        <Text style={styles.quote}>"{selectedLike?.message}"</Text>

                        <TextInput
                            style={styles.input}
                            placeholder="Send a reply..."
                            value={replyText}
                            onChangeText={setReplyText}
                            autoFocus
                        />

                        <View style={styles.modalActions}>
                            <Button title="Cancel" onPress={() => setSelectedLike(null)} color="red" />
                            <Button title="Send & Match" onPress={handleAccept} />
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: '#f9f9f9' },
    pageTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
    error: { color: 'red' },
    empty: { textAlign: 'center', marginTop: 50, color: '#999' },
    card: {
        backgroundColor: 'white',
        padding: 15,
        borderRadius: 10,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 2
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    name: { fontSize: 18, fontWeight: 'bold' },
    date: { color: '#999', fontSize: 12 },
    messageBox: {
        backgroundColor: '#f0f0f0',
        padding: 10,
        borderRadius: 8,
        marginBottom: 15
    },
    messageLabel: { fontSize: 10, color: '#666', marginBottom: 4 },
    messageText: { fontSize: 16, fontStyle: 'italic' },
    actions: { flexDirection: 'row', justifyContent: 'space-between' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: 'white', padding: 20, borderRadius: 10 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
    quote: { fontStyle: 'italic', color: '#666', borderLeftWidth: 2, borderLeftColor: '#ccc', paddingLeft: 10, marginVertical: 10 },
    input: { borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 5, marginBottom: 20 },
    modalActions: { flexDirection: 'row', justifyContent: 'space-between' }
});
