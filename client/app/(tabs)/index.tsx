/**
 * @file client/app/(tabs)/index.tsx
 * @description SKELETON SCREEN for the Discovery Feed.
 * 
 * TODO (DESIGN) - CRITICAL UI INSTRUCTIONS:
 * 1. **Card Stack Animation**:
 *    - Use `react-native-reanimated` and `react-native-gesture-handler`.
 *    - Implement a "Tinder-style" card stack where the top card can be dragged.
 *    - **Swipe Right**: Triggers `handleLike`. Show a GREEN "LIKE" stamp overlay.
 *    - **Swipe Left**: Triggers `handlePass`. Show a RED "NOPE" stamp overlay.
 *    - **Tap Edge**: Optional: Tap left/right to browse photos within the SAME profile.
 * 
 * 2. **Card Layout**:
 *    - Image should take up 80% of the screen height.
 *    - Overlay Name, Age, and Skills at the bottom gradient.
 *    - "Info Button" (i) to flip card or scroll down for Bio.
 * 
 * 3. **Empty State**:
 *    - When `profiles.length === 0`:
 *    - Show a "Radar Pulse" animation indicating we are searching for more users.
 *    - Add a "Refresh" button styled as a primary call-to-action.
 */

import React, { useEffect } from 'react';
import { View, Text, Button, StyleSheet, ActivityIndicator, ScrollView, TextInput } from 'react-native';
import { useFeed } from '@/src/hooks/useFeed';
import { useAuth } from '@/src/auth/AuthProvider';

export default function FeedScreen() {
  const { isAuthenticated } = useAuth();
  const { profiles, loading, error, hasMore, fetchFeed, swipe } = useFeed();

  const [message, setMessage] = React.useState("");

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  if (loading && profiles.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text>Finding matches...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <Button title="Retry" onPress={() => fetchFeed(true)} />
      </View>
    );
  }

  if (profiles.length === 0) {
    return (
      <View style={styles.center}>
        <Text>No more profiles around you.</Text>
        <Text>Check back later!</Text>
        <Button title="Refresh" onPress={() => fetchFeed(true)} />
      </View>
    );
  }

  // SKELETON UI: Just showing the first profile (Top of Deck)
  const currentProfile = profiles[0];

  const handleLike = async () => {
    // TODO (DESIGNER): Open a Modal to type message first?
    // Hinge requires message for LIKES.
    if (message.length < 20) {
      alert("Write at least 20 chars!");
      return;
    }
    await swipe(currentProfile.id, true, message);
    setMessage(""); // Reset
  };

  const handlePass = async () => {
    await swipe(currentProfile.id, false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Discovery Feed</Text>

      {/* 
        TODO (DESIGN): MAIN CARD CONTAINER 
        - This View should be the "Swipeable" component.
        - Add shadow and elevation for depth.
        - Border radius: 20px.
      */}
      <View style={styles.card}>
        <Text style={styles.name}>{currentProfile.name}</Text>
        <Text>{currentProfile.bio}</Text>
        {/* TODO (DESIGN): Style these as "Pills" or "Tags" (e.g., bg-gray-200 rounded-full) */}
        <Text style={styles.skills}>{currentProfile.skills.join(', ')}</Text>

        {/* 
            TODO (DESIGN): PROFILE IMAGE
            - Use <Image source={{ uri: currentProfile.profilePicture }} />
            - Mode: 'cover'
            - Handle null/loading states with a skeleton shimmer.
        */}
        <View style={styles.imagePlaceholder}>
          <Text>Image Here: {currentProfile.profilePicture}</Text>
        </View>

        {/* 
            TODO (DESIGN): MESSAGE INPUT (Required for Like)
            - This should probably be a Modal that opens when you try to Swipe Right.
            - "Add a note with your like..." 
            - Floating label or placeholder.
        */}
        <TextInput
          style={styles.input}
          placeholder="Type something nice..."
          value={message}
          onChangeText={setMessage}
        />

        {/* 
            TODO (DESIGN): ACTION BUTTONS
            - Floating Action Buttons (FABs) at the bottom.
            - Large 'X' button (Red/Gray).
            - Large 'Heart' button (Green/Pink).
            - Add 'Super Like' or 'Rewind' if applicable in future.
        */}
        <View style={styles.actions}>
          <Button title="❌ Pass" onPress={handlePass} color="red" />
          <Button title="❤️ Like" onPress={handleLike} color="green" />
        </View>
      </View>

      <Text style={styles.debug}>Next: {profiles.length - 1} profiles waiting</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  error: { color: 'red', marginBottom: 10 },
  card: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 20,
    backgroundColor: '#fff',
    height: '70%',
    justifyContent: 'space-between'
  },
  name: { fontSize: 22, fontWeight: 'bold' },
  skills: { color: '#666', marginTop: 5 },
  imagePlaceholder: {
    height: 200,
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    borderRadius: 5,
    marginBottom: 10
  },
  actions: { flexDirection: 'row', justifyContent: 'space-around' },
  debug: { marginTop: 20, color: '#999', textAlign: 'center' }
});
