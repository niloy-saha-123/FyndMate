/**
 * @file client/app/(tabs)/profilePage.tsx
 * @description User Profile Screen - View and Edit mode with photo grid
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/AuthProvider';
import { updateProfile } from '../../src/services/profileService';
import { supabase } from '../../src/auth/supabaseClient';
import { getOptimizedImageUrl, ImageSizes } from '../../src/utils/imageOptimization';

// Colors - Dark theme with orange accents
const COLORS = {
  primary: '#EE8B44',
  primaryLight: '#F8C89E',
  background: '#121212',
  surface: '#1E1E1E',
  card: '#2A2A2A',
  white: '#FFFFFF',
  text: '#FFFFFF',
  textSecondary: '#B0B0B0',
  textLight: '#888888',
  border: '#3A3A3A',
  danger: '#E74C3C',
  success: '#27AE60',
};

// Available skills/interests for selection
const AVAILABLE_SKILLS = [
  'React', 'React Native', 'TypeScript', 'JavaScript', 'Python', 'Node.js',
  'AI/ML', 'Flutter', 'Swift', 'Kotlin', 'Go', 'Rust', 'AWS', 'Firebase',
  'PostgreSQL', 'MongoDB', 'GraphQL', 'Docker', 'Kubernetes', 'UI/UX',
];

const AVAILABLE_INTERESTS = [
  'Startups', 'Open Source', 'Gaming', 'Music', 'Travel', 'Fitness',
  'Reading', 'Photography', 'Art', 'Cooking', 'Movies', 'Podcasts',
  'Crypto', 'Investing', 'Mentoring', 'Hackathons', 'Side Projects',
];

const EXPERIENCE_LEVELS = [
  { value: 'student', label: '🎓 Student' },
  { value: 'junior', label: '🌱 Junior (0-2 years)' },
  { value: 'mid', label: '💼 Mid-level (2-5 years)' },
  { value: 'senior', label: '🚀 Senior (5+ years)' },
  { value: 'lead', label: '👑 Lead/Manager' },
];

const COMMITMENT_LEVELS = [
  { value: 'hobby', label: '🎮 Hobby (few hours/week)' },
  { value: 'part-time', label: '⏰ Part-time (10-20 hrs/week)' },
  { value: 'serious', label: '🔥 Serious (20+ hrs/week)' },
  { value: 'full-time', label: '💪 Full-time dedication' },
];

export default function ProfilePage() {
  const { top, bottom } = useSafeAreaInsets();
  const { profile, refreshProfile, session } = useAuth();
  
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Photo slots (6 slots for profile pictures)
  const [photos, setPhotos] = useState<(string | null)[]>([
    profile?.profilePicture ?? null,
    null, null, null, null, null
  ]);
  
  // Form state
  const [formData, setFormData] = useState({
    fullName: profile?.fullName ?? '',
    bio: profile?.bio ?? '',
    skills: profile?.skills ?? [],
    interests: profile?.interests ?? [],
    experience: profile?.experience ?? '',
    commitment: profile?.commitment ?? '',
    githubUsername: profile?.githubUsername ?? '',
  });

  const MAX_BIO_LENGTH = 300;

  const handleEditToggle = useCallback(() => {
    if (isEditing) {
      // Reset form data when canceling
      setFormData({
        fullName: profile?.fullName ?? '',
        bio: profile?.bio ?? '',
        skills: profile?.skills ?? [],
        interests: profile?.interests ?? [],
        experience: profile?.experience ?? '',
        commitment: profile?.commitment ?? '',
        githubUsername: profile?.githubUsername ?? '',
      });
      setPhotos([profile?.profilePicture ?? null, null, null, null, null, null]);
    }
    setIsEditing(!isEditing);
  }, [isEditing, profile]);

  const handleSave = useCallback(async () => {
    if (!session?.user?.id) return;
    
    setSaving(true);
    try {
      await updateProfile(session.user.id, formData);
      await refreshProfile();
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }, [session, formData, refreshProfile]);

  const toggleSkill = useCallback((skill: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill],
    }));
  }, []);

  const toggleInterest = useCallback((interest: string) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest],
    }));
  }, []);

  const handlePickImage = useCallback((slotIndex: number) => {
    // Note: Image picker requires a development build, not Expo Go
    Alert.alert(
      'Development Build Required',
      'Profile picture upload requires a development build. Run `npx expo run:android` or `npx expo run:ios` to enable this feature.'
    );
  }, []);

  const handleDeletePhoto = useCallback((slotIndex: number) => {
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setPhotos(prev => {
              const newPhotos = [...prev];
              newPhotos[slotIndex] = null;
              return newPhotos;
            });
          },
        },
      ]
    );
  }, []);

  const handleLogout = useCallback(async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
          },
        },
      ]
    );
  }, []);

  const calculateAge = (birthDate: string | null): number | null => {
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const age = calculateAge(profile?.birthDate ?? null);

  return (
    <View style={[styles.container, { paddingTop: top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Profile</Text>
        <TouchableOpacity
          style={[styles.editButton, isEditing && styles.editButtonActive]}
          onPress={handleEditToggle}
        >
          <Text style={[styles.editButtonText, isEditing && styles.editButtonTextActive]}>
            {isEditing ? 'Cancel' : 'Edit'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Photo Grid - 3x2 */}
        <View style={styles.photoGridSection}>
          <Text style={styles.sectionLabel}>Photos</Text>
          <View style={styles.photoGrid}>
            {photos.map((photo, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.photoSlot,
                  index === 0 && styles.photoSlotMain,
                ]}
                onPress={() => isEditing && handlePickImage(index)}
                disabled={!isEditing}
              >
                {photo ? (
                  <>
                    <Image 
                      source={{ uri: getOptimizedImageUrl(photo, ImageSizes.CARD.width, ImageSizes.CARD.quality) }} 
                      style={styles.photoImage} 
                    />
                    {isEditing && (
                      <TouchableOpacity
                        style={styles.deletePhotoButton}
                        onPress={() => handleDeletePhoto(index)}
                      >
                        <Ionicons name="close-circle" size={24} color={COLORS.danger} />
                      </TouchableOpacity>
                    )}
                  </>
                ) : (
                  <View style={styles.emptySlot}>
                    {isEditing ? (
                      <>
                        <Ionicons name="add" size={32} color={COLORS.primary} />
                        <Text style={styles.addPhotoText}>Add</Text>
                      </>
                    ) : (
                      <Ionicons name="image-outline" size={32} color={COLORS.border} />
                    )}
                  </View>
                )}
                {index === 0 && (
                  <View style={styles.mainPhotoBadge}>
                    <Text style={styles.mainPhotoBadgeText}>Main</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Name & Basic Info */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Name</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={formData.fullName}
              onChangeText={(text) => setFormData(prev => ({ ...prev, fullName: text }))}
              placeholder="Your name"
              placeholderTextColor={COLORS.textLight}
            />
          ) : (
            <Text style={styles.displayName}>
              {profile?.fullName || 'Add your name'}
              {age && <Text style={styles.ageText}>, {age}</Text>}
            </Text>
          )}
          {!isEditing && profile?.location && (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={16} color={COLORS.textLight} />
              <Text style={styles.locationText}>{profile.location}</Text>
            </View>
          )}
        </View>

        {/* Bio Section */}
        <View style={styles.section}>
          <View style={styles.labelRow}>
            <Text style={styles.sectionLabel}>Bio</Text>
            {isEditing && (
              <Text style={styles.charCount}>
                {formData.bio.length}/{MAX_BIO_LENGTH}
              </Text>
            )}
          </View>
          {isEditing ? (
            <TextInput
              style={[styles.input, styles.bioInput]}
              value={formData.bio}
              onChangeText={(text) => {
                if (text.length <= MAX_BIO_LENGTH) {
                  setFormData(prev => ({ ...prev, bio: text }));
                }
              }}
              placeholder="Tell others about yourself, your projects, and what you're looking for..."
              placeholderTextColor={COLORS.textLight}
              multiline
              textAlignVertical="top"
            />
          ) : (
            <Text style={styles.bioText}>
              {profile?.bio || 'No bio yet. Tap Edit to add one!'}
            </Text>
          )}
        </View>

        {/* Skills Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Skills</Text>
          <View style={styles.tagContainer}>
            {(isEditing ? AVAILABLE_SKILLS : (profile?.skills || [])).map((skill) => {
              const isSelected = formData.skills.includes(skill);
              return (
                <Pressable
                  key={skill}
                  style={[
                    styles.tag,
                    isSelected && styles.tagSelected,
                    !isEditing && styles.tagViewMode,
                  ]}
                  onPress={isEditing ? () => toggleSkill(skill) : undefined}
                  disabled={!isEditing}
                >
                  <Text style={[
                    styles.tagText,
                    isSelected && styles.tagTextSelected,
                  ]}>
                    {skill}
                  </Text>
                </Pressable>
              );
            })}
            {!isEditing && (!profile?.skills || profile.skills.length === 0) && (
              <Text style={styles.emptyText}>No skills added yet</Text>
            )}
          </View>
        </View>

        {/* Interests Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Interests</Text>
          <View style={styles.tagContainer}>
            {(isEditing ? AVAILABLE_INTERESTS : (profile?.interests || [])).map((interest) => {
              const isSelected = formData.interests.includes(interest);
              return (
                <Pressable
                  key={interest}
                  style={[
                    styles.tag,
                    isSelected && styles.tagSelected,
                    !isEditing && styles.tagViewMode,
                  ]}
                  onPress={isEditing ? () => toggleInterest(interest) : undefined}
                  disabled={!isEditing}
                >
                  <Text style={[
                    styles.tagText,
                    isSelected && styles.tagTextSelected,
                  ]}>
                    {interest}
                  </Text>
                </Pressable>
              );
            })}
            {!isEditing && (!profile?.interests || profile.interests.length === 0) && (
              <Text style={styles.emptyText}>No interests added yet</Text>
            )}
          </View>
        </View>

        {/* Experience Level */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Experience Level</Text>
          {isEditing ? (
            <View style={styles.optionsList}>
              {EXPERIENCE_LEVELS.map((level) => (
                <TouchableOpacity
                  key={level.value}
                  style={[
                    styles.optionButton,
                    formData.experience === level.value && styles.optionButtonActive,
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, experience: level.value }))}
                >
                  <Text style={[
                    styles.optionButtonText,
                    formData.experience === level.value && styles.optionButtonTextActive,
                  ]}>
                    {level.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.valueText}>
              {EXPERIENCE_LEVELS.find(l => l.value === profile?.experience)?.label || 'Not set'}
            </Text>
          )}
        </View>

        {/* Commitment Level */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Commitment Level</Text>
          {isEditing ? (
            <View style={styles.optionsList}>
              {COMMITMENT_LEVELS.map((level) => (
                <TouchableOpacity
                  key={level.value}
                  style={[
                    styles.optionButton,
                    formData.commitment === level.value && styles.optionButtonActive,
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, commitment: level.value }))}
                >
                  <Text style={[
                    styles.optionButtonText,
                    formData.commitment === level.value && styles.optionButtonTextActive,
                  ]}>
                    {level.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.valueText}>
              {COMMITMENT_LEVELS.find(l => l.value === profile?.commitment)?.label || 'Not set'}
            </Text>
          )}
        </View>

        {/* GitHub Username */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>GitHub</Text>
          {isEditing ? (
            <View style={styles.inputWithIcon}>
              <Ionicons name="logo-github" size={20} color={COLORS.textLight} />
              <TextInput
                style={styles.inputWithIconText}
                value={formData.githubUsername}
                onChangeText={(text) => setFormData(prev => ({ ...prev, githubUsername: text }))}
                placeholder="your-github-username"
                placeholderTextColor={COLORS.textLight}
                autoCapitalize="none"
              />
            </View>
          ) : (
            <View style={styles.githubRow}>
              <Ionicons name="logo-github" size={20} color={COLORS.text} />
              <Text style={styles.githubText}>
                {profile?.githubUsername || 'Not connected'}
              </Text>
            </View>
          )}
        </View>

        {/* Save Button (Edit Mode) */}
        {isEditing && (
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Settings Section */}
        <View style={styles.settingsSection}>
          <Text style={styles.settingsSectionTitle}>Settings</Text>
          
          <TouchableOpacity style={styles.settingsItem} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color={COLORS.danger} />
            <Text style={[styles.settingsItemText, { color: COLORS.danger }]}>
              Logout
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingsItem}>
            <Ionicons name="trash-outline" size={22} color={COLORS.danger} />
            <Text style={[styles.settingsItemText, { color: COLORS.danger }]}>
              Delete Account
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.card,
  },
  editButtonActive: {
    backgroundColor: COLORS.primary,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  editButtonTextActive: {
    color: COLORS.white,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  
  // Photo Grid Styles
  photoGridSection: {
    marginBottom: 24,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoSlot: {
    width: '31%',
    aspectRatio: 3 / 4,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  photoSlotMain: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  photoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  emptySlot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoText: {
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 4,
  },
  deletePhotoButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
  },
  mainPhotoBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  mainPhotoBadgeText: {
    fontSize: 10,
    color: COLORS.white,
    fontWeight: '600',
  },
  
  // Section Styles
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  charCount: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  displayName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  ageText: {
    fontWeight: 'normal',
    color: COLORS.textSecondary,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  locationText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  bioText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    lineHeight: 24,
  },
  valueText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textLight,
    fontStyle: 'italic',
  },
  
  // Tags
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tagSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tagViewMode: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tagText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  tagTextSelected: {
    color: COLORS.white,
    fontWeight: '600',
  },
  
  // Options
  optionsList: {
    gap: 8,
  },
  optionButton: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  optionButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  optionButtonText: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  optionButtonTextActive: {
    color: COLORS.white,
    fontWeight: '600',
  },
  
  // GitHub
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  inputWithIconText: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: COLORS.text,
  },
  githubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  githubText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  
  // Save Button
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Settings
  settingsSection: {
    marginTop: 16,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  settingsSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 16,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  settingsItemText: {
    fontSize: 16,
  },
});