/**
 * @file client/app/(tabs)/profilePage.tsx
 * @description User Profile Screen with Neo-brutalist design
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
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../src/auth/AuthProvider';
import { updateProfile } from '../../src/services/profileService';
import { supabase } from '../../src/auth/supabaseClient';
import { getOptimizedImageUrl, ImageSizes } from '../../src/utils/imageOptimization';
import { COLORS, SHADOWS, BORDERS, RADIUS } from '../../src/theme/colors';
import { NeoCard } from '../../src/components/NeoCard';
import { NeoButton } from '../../src/components/NeoButton';
import { NeoChip, ChipContainer } from '../../src/components/NeoChip';
import { useProfilePictureUpload } from '../../src/hooks/useProfilePictureUpload';

// Available skills/interests for selection
const AVAILABLE_SKILLS = [
  'React',
  'React Native',
  'TypeScript',
  'JavaScript',
  'Python',
  'Node.js',
  'AI/ML',
  'Flutter',
  'Swift',
  'Kotlin',
  'Go',
  'Rust',
  'AWS',
  'Firebase',
  'PostgreSQL',
  'MongoDB',
  'GraphQL',
  'Docker',
  'Kubernetes',
  'UI/UX',
];

const AVAILABLE_INTERESTS = [
  'Startups',
  'Open Source',
  'Gaming',
  'Music',
  'Travel',
  'Fitness',
  'Reading',
  'Photography',
  'Art',
  'Cooking',
  'Movies',
  'Podcasts',
  'Crypto',
  'Investing',
  'Mentoring',
  'Hackathons',
  'Side Projects',
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
  const { upload, uploading, progress, error: uploadError } = useProfilePictureUpload();

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [photo, setPhoto] = useState<string | null>(profile?.profilePicture ?? null);

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
  const MAX_SKILLS = 10;
  const MAX_INTERESTS = 10;

  const handleEditToggle = useCallback(() => {
    if (isEditing) {
      setFormData({
        fullName: profile?.fullName ?? '',
        bio: profile?.bio ?? '',
        skills: profile?.skills ?? [],
        interests: profile?.interests ?? [],
        experience: profile?.experience ?? '',
        commitment: profile?.commitment ?? '',
        githubUsername: profile?.githubUsername ?? '',
      });
      setPhoto(profile?.profilePicture ?? null);
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
    setFormData((prev) => {
      if (prev.skills.includes(skill)) {
        return { ...prev, skills: prev.skills.filter((s) => s !== skill) };
      }
      if (prev.skills.length >= MAX_SKILLS) {
        Alert.alert('Limit reached', `You can select up to ${MAX_SKILLS} skills.`);
        return prev;
      }
      return { ...prev, skills: [...prev.skills, skill] };
    });
  }, []);

  const toggleInterest = useCallback((interest: string) => {
    setFormData((prev) => {
      if (prev.interests.includes(interest)) {
        return { ...prev, interests: prev.interests.filter((i) => i !== interest) };
      }
      if (prev.interests.length >= MAX_INTERESTS) {
        Alert.alert('Limit reached', `You can select up to ${MAX_INTERESTS} interests.`);
        return prev;
      }
      return { ...prev, interests: [...prev.interests, interest] };
    });
  }, []);

  const handlePickImage = useCallback(async () => {
    // Request permission first
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (!permissionResult.granted) {
      Alert.alert(
        'Permission Required',
        'Please allow access to your photo library to upload a profile picture.'
      );
      return;
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]?.uri) {
      return;
    }

    const imageUri = result.assets[0].uri;

    try {
      // Upload the image
      const publicUrl = await upload(imageUri);
      
      // Update local state with new photo
      setPhoto(publicUrl);
      
      // Update profile in database
      if (session?.user?.id) {
        await updateProfile(session.user.id, { profilePicture: publicUrl });
        await refreshProfile();
      }
      
      Alert.alert('Success', 'Profile picture updated!');
    } catch (error: any) {
      Alert.alert('Upload Failed', error.message || 'Failed to upload profile picture');
    }
  }, [upload, session, refreshProfile]);

  const handleLogout = useCallback(async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
        },
      },
    ]);
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
        <View style={styles.headerLeft}>
          <View style={styles.geoCircle} />
          <Text style={styles.headerTitle}>My Profile</Text>
        </View>
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
        {/* Profile Picture */}
        <View style={styles.profilePhotoSection}>
          <TouchableOpacity
            style={styles.profilePhotoContainer}
            onPress={isEditing ? handlePickImage : undefined}
            disabled={!isEditing || uploading}
          >
            {uploading ? (
              <View style={styles.emptyProfilePhoto}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.addPhotoText}>
                  {progress?.step === 'uploading' ? 'Uploading...' : 'Processing...'}
                </Text>
              </View>
            ) : photo ? (
              <Image
                source={{
                  uri: getOptimizedImageUrl(
                    photo,
                    ImageSizes.CARD.width,
                    ImageSizes.CARD.quality
                  ),
                }}
                style={styles.profilePhoto}
              />
            ) : (
              <View style={styles.emptyProfilePhoto}>
                {isEditing ? (
                  <>
                    <Ionicons name="camera" size={40} color={COLORS.primary} />
                    <Text style={styles.addPhotoText}>Add Photo</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="person-circle-outline" size={60} color={COLORS.border} />
                    <Text style={styles.noPhotoText}>No photo</Text>
                  </>
                )}
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Name & Basic Info */}
        <NeoCard style={styles.section}>
          <Text style={styles.sectionLabel}>NAME</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={formData.fullName}
              onChangeText={(text) => setFormData((prev) => ({ ...prev, fullName: text }))}
              placeholder="Your name"
              placeholderTextColor={COLORS.textLight}
            />
          ) : (
            <Text style={styles.displayName}>
              {profile?.fullName || 'Add your name'}
              {age && <Text style={styles.ageText}>, {age}</Text>}
            </Text>
          )}
        </NeoCard>

        {/* Location Section */}
        <NeoCard style={styles.section}>
          <Text style={styles.sectionLabel}>LOCATION</Text>
          <View style={styles.locationCard}>
            <View style={styles.locationInfo}>
              <Ionicons name="location" size={24} color={COLORS.primary} />
              <View style={styles.locationDetails}>
                {profile?.city && profile?.country ? (
                  <>
                    <Text style={styles.locationCity}>
                      {profile.city}, {profile.country}
                    </Text>
                    <Text style={styles.locationStatus}>
                      {profile.locationSharing === 'on'
                        ? '📍 Location sharing on'
                        : '🔒 Location sharing off'}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.locationCity}>Location not set</Text>
                    <Text style={styles.locationStatus}>Enable location to show your city</Text>
                  </>
                )}
              </View>
            </View>
          </View>
        </NeoCard>

        {/* Bio Section */}
        <NeoCard style={styles.section}>
          <View style={styles.labelRow}>
            <Text style={styles.sectionLabel}>BIO</Text>
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
              maxLength={MAX_BIO_LENGTH}
              onChangeText={(text) => {
                setFormData((prev) => ({ ...prev, bio: text }));
              }}
              placeholder="Tell others about yourself, your projects, and what you're looking for..."
              placeholderTextColor={COLORS.textLight}
              multiline
              textAlignVertical="top"
            />
          ) : (
            <Text style={styles.bioText}>{profile?.bio || 'No bio yet. Tap Edit to add one!'}</Text>
          )}
        </NeoCard>

        {/* Skills Section */}
        <NeoCard style={styles.section}>
          <Text style={styles.sectionLabel}>SKILLS</Text>
          <ChipContainer>
            {(isEditing ? AVAILABLE_SKILLS : profile?.skills || []).map((skill) => {
              const isSelected = formData.skills.includes(skill);
              return (
                <NeoChip
                  key={skill}
                  label={skill}
                  variant="skill"
                  selected={isSelected}
                  onPress={isEditing ? () => toggleSkill(skill) : undefined}
                />
              );
            })}
            {!isEditing && (!profile?.skills || profile.skills.length === 0) && (
              <Text style={styles.emptyText}>No skills added yet</Text>
            )}
          </ChipContainer>
        </NeoCard>

        {/* Interests Section */}
        <NeoCard style={styles.section}>
          <Text style={styles.sectionLabel}>INTERESTS</Text>
          <ChipContainer>
            {(isEditing ? AVAILABLE_INTERESTS : profile?.interests || []).map((interest) => {
              const isSelected = formData.interests.includes(interest);
              return (
                <NeoChip
                  key={interest}
                  label={interest}
                  variant="looking"
                  selected={isSelected}
                  onPress={isEditing ? () => toggleInterest(interest) : undefined}
                />
              );
            })}
            {!isEditing && (!profile?.interests || profile.interests.length === 0) && (
              <Text style={styles.emptyText}>No interests added yet</Text>
            )}
          </ChipContainer>
        </NeoCard>

        {/* Experience Level */}
        <NeoCard style={styles.section}>
          <Text style={styles.sectionLabel}>EXPERIENCE LEVEL</Text>
          {isEditing ? (
            <View style={styles.optionsList}>
              {EXPERIENCE_LEVELS.map((level) => (
                <TouchableOpacity
                  key={level.value}
                  style={[
                    styles.optionButton,
                    formData.experience === level.value && styles.optionButtonActive,
                  ]}
                  onPress={() => setFormData((prev) => ({ ...prev, experience: level.value }))}
                >
                  <Text
                    style={[
                      styles.optionButtonText,
                      formData.experience === level.value && styles.optionButtonTextActive,
                    ]}
                  >
                    {level.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.valueText}>
              {EXPERIENCE_LEVELS.find((l) => l.value === profile?.experience)?.label || 'Not set'}
            </Text>
          )}
        </NeoCard>

        {/* Commitment Level */}
        <NeoCard style={styles.section}>
          <Text style={styles.sectionLabel}>COMMITMENT LEVEL</Text>
          {isEditing ? (
            <View style={styles.optionsList}>
              {COMMITMENT_LEVELS.map((level) => (
                <TouchableOpacity
                  key={level.value}
                  style={[
                    styles.optionButton,
                    formData.commitment === level.value && styles.optionButtonActive,
                  ]}
                  onPress={() => setFormData((prev) => ({ ...prev, commitment: level.value }))}
                >
                  <Text
                    style={[
                      styles.optionButtonText,
                      formData.commitment === level.value && styles.optionButtonTextActive,
                    ]}
                  >
                    {level.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.valueText}>
              {COMMITMENT_LEVELS.find((l) => l.value === profile?.commitment)?.label || 'Not set'}
            </Text>
          )}
        </NeoCard>

        {/* GitHub Username */}
        <NeoCard style={styles.section}>
          <Text style={styles.sectionLabel}>GITHUB</Text>
          {isEditing ? (
            <View style={styles.inputWithIcon}>
              <Ionicons name="logo-github" size={20} color={COLORS.textLight} />
              <TextInput
                style={styles.inputWithIconText}
                value={formData.githubUsername}
                onChangeText={(text) =>
                  setFormData((prev) => ({ ...prev, githubUsername: text }))
                }
                placeholder="your-github-username"
                placeholderTextColor={COLORS.textLight}
                autoCapitalize="none"
              />
            </View>
          ) : (
            <View style={styles.githubRow}>
              <Ionicons name="logo-github" size={20} color={COLORS.textPrimary} />
              <Text style={styles.githubText}>{profile?.githubUsername || 'Not connected'}</Text>
            </View>
          )}
        </NeoCard>

        {/* Save Button (Edit Mode) */}
        {isEditing && (
          <NeoButton
            title={saving ? 'Saving...' : 'Save Changes'}
            onPress={handleSave}
            disabled={saving}
            fullWidth
            style={{ marginTop: 8 }}
          />
        )}

        {/* Settings Section */}
        <View style={styles.settingsSection}>
          <Text style={styles.settingsSectionTitle}>Settings</Text>

          <TouchableOpacity style={styles.settingsItem} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color={COLORS.danger} />
            <Text style={[styles.settingsItemText, { color: COLORS.danger }]}>Logout</Text>
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

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  geoCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: COLORS.border,
    marginRight: 8,
    ...SHADOWS.small,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: BORDERS.thin,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  editButtonActive: {
    backgroundColor: COLORS.primary,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  editButtonTextActive: {
    color: COLORS.surface,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },

  // Profile Picture
  profilePhotoSection: {
    marginBottom: 24,
    alignItems: 'center',
  },
  profilePhotoContainer: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
    borderWidth: BORDERS.medium,
    borderColor: COLORS.border,
    ...SHADOWS.large,
  },
  profilePhoto: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  emptyProfilePhoto: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.gray100,
  },
  addPhotoText: {
    fontSize: 14,
    color: COLORS.primary,
    marginTop: 8,
    fontWeight: '700',
  },
  noPhotoText: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 4,
    fontWeight: '600',
  },

  // Section
  section: {
    marginBottom: 16,
    padding: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.skillText,
    marginBottom: 12,
    letterSpacing: 1,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  charCount: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '700',
  },

  // Inputs
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.small,
    padding: 12,
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textPrimary,
    borderWidth: BORDERS.thin,
    borderColor: COLORS.border,
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.small,
    paddingHorizontal: 12,
    borderWidth: BORDERS.thin,
    borderColor: COLORS.border,
    gap: 12,
  },
  inputWithIconText: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },

  // Display
  displayName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  ageText: {
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  bioText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textSecondary,
    lineHeight: 24,
  },
  valueText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textLight,
    fontStyle: 'italic',
    fontWeight: '500',
  },

  // Location
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  locationDetails: {
    flex: 1,
  },
  locationCity: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  locationStatus: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontWeight: '600',
  },

  // GitHub
  githubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  githubText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },

  // Options
  optionsList: {
    gap: 8,
  },
  optionButton: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.small,
    padding: 14,
    borderWidth: BORDERS.thin,
    borderColor: COLORS.border,
  },
  optionButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  optionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  optionButtonTextActive: {
    color: COLORS.surface,
    fontWeight: '700',
  },

  // Settings
  settingsSection: {
    marginTop: 16,
    paddingTop: 24,
    borderTopWidth: BORDERS.thin,
    borderTopColor: COLORS.border,
  },
  settingsSectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
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
    fontWeight: '700',
  },
});
