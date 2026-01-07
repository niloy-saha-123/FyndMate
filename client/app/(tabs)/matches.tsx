/**
 * @file client/app/(tabs)/matches.tsx
 * @description SKELETON SCREEN for the "Matches" List (Active Chats).
 * 
 * TODO (DESIGN) - CRITICAL UI INSTRUCTIONS:
 * 1. **List Layout**:
 *    - Standard vertical scroll list.
 *    - Row Height: ~80px.
 *    - Separator: Thin grey line, indented to align with text (not avatar).
 * 
 * 2. **Row Content**:
 *    - **Left**: Circular Avatar (60x60). Show green dot if "Online" (future feature).
 *    - **Middle**: 
 *      - Top: Name (Bold, 16sp).
 *      - Bottom: Last Message Preview (Grey, 14sp, truncated... 1 line).
 *    - **Right**: Timestamp (e.g., "10:45 AM" or "Yesterday").
 * 
 * 3. **Gestures (Swipeable Rows)**:
 *    - **Swipe Left**: Reveal "Unmatch" (Red background) and "Block" (Grey background) buttons.
 *    - This keeps the UI clean without buttons cluttering the row.
 */

import React, { useEffect } from 'react';
import { View, Text, Button, StyleSheet, FlatList, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { useMatches } from '@/src/hooks/useMatches';
import { Match } from '@/src/services/matchingService';

export default function MatchesScreen() {
    const token = "debug-token"; // TODO: Auth
    const { matches, loading, error, fetchMatches, onUnmatch, onBlock } = useMatches(token);

    useEffect(() => {
        fetchMatches();
    }, [fetchMatches]);

    const handleUnmatch = (matchId: string, name: string) => {
        Alert.alert(
            "Unmatch?",
            `Are you sure you want to unmatch ${name}? Maybe they were just busy?`,
            [
                { text: "Cancel", style: "cancel" },
                { text: "Unmatch", style: "destructive", onPress: () => onUnmatch(matchId) }
            ]
        );
    };

    const handleBlock = (userId: string, name: string) => {
        Alert.alert(
            "Block User?",
            `They will disappear forever. This cannot be undone.`,
            [
                { text: "Cancel", style: "cancel" },
                { text: "Block", style: "destructive", onPress: () => onBlock(userId) }
            ]
        );
    };

    const renderItem = ({ item }: { item: Match }) => {
        // Determine "Other User" (Logic needs to know MY user ID, but let's assume item.user2 is other for now, 
        // or better, backend should normalize it. 
        // TODO: Ideally backend returns "otherUser" object pre-calculated.
        // For skeleton, let's just show user2's name as placeholder.
        const otherUser = item.user2;

        return (
            /* 
               TODO (DESIGN): SWIPEABLE ROW WRAPPER
               - Wrap this entire View in a Swipeable component (from react-native-gesture-handler).
               - RenderRightActions should return the Unmatch/Block buttons currently shown below. 
            */
            <View style={styles.card}>
                {/* TODO (DESIGN): Avatar with fallback initials if image load fails */}
                <View style={styles.avatarPlaceholder} />

                <View style={styles.info}>
                    <Text style={styles.name}>{otherUser.name || "Unknown User"}</Text>
                    {/* TODO (DESIGN): Truncate text with numberOfLines={1} */}
                    <Text style={styles.lastMessage}>Tap to chat...</Text>
                </View>

                {/* 
                   TODO (DESIGN): HIDE THESE BUTTONS 
                   - These buttons should clutter the UI. 
                   - Move them to "Long Press" menu OR Swipe-Left actions.
                */}
                <View style={styles.actions}>
                    {/* Simulate Chat Navigation */}
                    <Button title="Chat" onPress={() => console.log("Navigate to chat", item.id)} />
                    <Button title="💔" onPress={() => handleUnmatch(item.id, otherUser.name)} color="orange" />
                    <Button title="🚫" onPress={() => handleBlock(otherUser.id, otherUser.name)} color="red" />
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <Text style={styles.pageTitle}>Your Matches ({matches.length})</Text>

            {loading && <ActivityIndicator />}
            {error && <Text style={styles.error}>{error}</Text>}

            <FlatList
                data={matches}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                refreshing={loading}
                onRefresh={fetchMatches}
                ListEmptyComponent={<Text style={styles.empty}>No matches yet. Keep swiping!</Text>}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: '#fff' },
    pageTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
    error: { color: 'red' },
    empty: { textAlign: 'center', marginTop: 50, color: '#999' },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee'
    },
    avatarPlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#eee', marginRight: 15 },
    info: { flex: 1 },
    name: { fontSize: 18, fontWeight: 'bold' },
    lastMessage: { color: '#888' },
    actions: { flexDirection: 'row', gap: 5 }
});
