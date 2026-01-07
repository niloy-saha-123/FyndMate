/**
 * @file client/app/(tabs)/profilePage.tsx
 * @description SKELETON SCREEN for the User's Own Profile (View & Edit).
 * 
 * TODO (DESIGN) - CRITICAL UI INSTRUCTIONS:
 * 1. **Modes**:
 *    - **View Mode**: How others see you (Card style).
 *    - **Edit Mode**: Form to update photos and bio.
 * 
 * 2. **Photo Grid (Edit Mode)**:
 *    - 3x2 Grid of standard aspect-ratio images.
 *    - Drag-and-drop to reorder (react-native-draggable-flatlist).
 *    - Tap 'X' to delete. Tap '+' to upload.
 * 
 * 3. **Smart Bio Input**:
 *    - Multi-line text input.
 *    - Show "Character Count" (e.g., 50/500).
 *    - "Skills/Interests" should be a "Tag Cloud" (tap to select/deselect).
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TextInput, Button, ScrollView, Switch } from 'react-native';

export default function ProfilePage() {
  // TODO: Connect to separate hooks for user profile
  const [isEditing, setIsEditing] = useState(false);

  // Placeholder Data
  const myProfile = {
    name: "Niloy",
    bio: "Founder & Developer. Loves coding and coffee.",
    photos: [null, null, null, null, null, null], // 6 slots
    skills: ["React", "AI", "Startup"]
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>My Profile</Text>
        {/* TODO (DESIGN): Toggle Switch or Button for "Edit Mode" */}
        <Button title={isEditing ? "Done" : "Edit"} onPress={() => setIsEditing(!isEditing)} />
      </View>

      {/* 
               TODO (DESIGN): PHOTO GRID
               - Needs to be highly interactive.
               - Show placeholder icons (+) for empty slots.
            */}
      <View style={styles.photoGrid}>
        {myProfile.photos.map((photo, index) => (
          <View key={index} style={styles.photoSlot}>
            <Text style={styles.photoPlaceholderText}>Slot {index + 1}</Text>
            {isEditing && <Text style={styles.addIcon}>+</Text>}
          </View>
        ))}
      </View>

      <View style={styles.formSection}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={myProfile.name}
          editable={isEditing}
        />

        <Text style={styles.label}>Bio</Text>
        {/* TODO (DESIGN): Auto-growing text input */}
        <TextInput
          style={[styles.input, styles.bioInput]}
          value={myProfile.bio}
          multiline
          editable={isEditing}
        />

        <Text style={styles.label}>Skills</Text>
        {/* TODO (DESIGN): Horizontal ScrollView of Chips/Tags */}
        <View style={styles.skillsContainer}>
          {myProfile.skills.map(skill => (
            <View key={skill} style={styles.skillChip}>
              <Text>{skill}</Text>
            </View>
          ))}
          {isEditing && <Button title="+ Add" />}
        </View>
      </View>

      {/* TODO (DESIGN): SETTINGS SECTION */}
      <View style={styles.settings}>
        <Text style={styles.sectionHeader}>Settings</Text>
        <Button title="Logout" color="red" />
        <Button title="Delete Account" color="red" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  pageTitle: { fontSize: 24, fontWeight: 'bold' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  photoSlot: { width: '30%', aspectRatio: 3 / 4, backgroundColor: '#eee', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  photoPlaceholderText: { color: '#999' },
  addIcon: { fontSize: 24, fontWeight: 'bold', color: '#666', marginTop: 5 },
  formSection: { marginBottom: 30 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#666', marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 8, marginBottom: 15, fontSize: 16 },
  bioInput: { height: 100, textAlignVertical: 'top' },
  skillsContainer: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  skillChip: { backgroundColor: '#f0f0f0', padding: 8, borderRadius: 20 },
  settings: { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 20 },
  sectionHeader: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 }
});