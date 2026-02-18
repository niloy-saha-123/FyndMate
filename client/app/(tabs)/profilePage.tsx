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
  Linking,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../src/auth/AuthProvider';
import { deleteMyAccount, updateProfile } from '../../src/services/profileService';
import { supabase } from '../../src/auth/supabaseClient';
import { getOptimizedImageUrl, ImageSizes } from '../../src/utils/imageOptimization';
import { COLORS, SHADOWS, BORDERS, RADIUS } from '../../src/theme/colors';
import { NeoCard } from '../../src/components/NeoCard';
import { NeoButton } from '../../src/components/NeoButton';
import { NeoChip, ChipContainer } from '../../src/components/NeoChip';
import { useProfilePictureUpload } from '../../src/hooks/useProfilePictureUpload';
import { useLocationContext } from '../../src/location/LocationProvider';
import {
  PROFILE_BIO_MAX_LENGTH,
  PROFILE_MAX_SKILLS,
  PROFILE_MAX_INTERESTS,
  PROFILE_TAG_MAX_LENGTH,
  PROFILE_TAG_REGEX,
  PROFILE_GITHUB_MAX_LENGTH,
  PROFILE_MAX_PROJECTS,
  PROFILE_MAX_EXPERIENCES,
  PROFILE_PROJECT_NAME_MAX_LENGTH,
  PROFILE_PROJECT_DESCRIPTION_MAX_LENGTH,
  PROFILE_EXPERIENCE_COMPANY_MAX_LENGTH,
  PROFILE_EXPERIENCE_POSITION_MAX_LENGTH,
  PROFILE_EXPERIENCE_DESCRIPTION_MAX_LENGTH,
} from '../../src/constants/validation';

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

function normalizeTagInput(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function validateTagInput(value: string, label: 'Skill' | 'Interest') {
  if (!value) return `${label} is required`;
  if (value.length > PROFILE_TAG_MAX_LENGTH) {
    return `${label} must be ${PROFILE_TAG_MAX_LENGTH} characters or less`;
  }
  if (!PROFILE_TAG_REGEX.test(value)) {
    return `${label} contains invalid characters`;
  }
  return null;
}

function toMonthValue(value?: string | null): string {
  if (!value) return '';
  const monthMatch = /^(\d{4}-\d{2})/.exec(value);
  if (monthMatch) return monthMatch[1];
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const year = parsed.getUTCFullYear();
  const month = `${parsed.getUTCMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

export default function ProfilePage() {
  const { top, bottom } = useSafeAreaInsets();
  const { profile, setProfileLocally, session } = useAuth();
  const { upload, uploading, progress, error: uploadError, rateLimit } = useProfilePictureUpload();
  const {
    preference: locationPreference,
    currentLocation,
    changePreference,
    initialized: locationInitialized,
  } = useLocationContext();

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState('');
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successModalMessage, setSuccessModalMessage] = useState('');
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [deleteAccountModalVisible, setDeleteAccountModalVisible] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [photo, setPhoto] = useState<string | null>(profile?.profilePicture ?? null);

  // Custom skill/interest input state
  const [customSkill, setCustomSkill] = useState('');
  const [customInterest, setCustomInterest] = useState('');
  const [skillError, setSkillError] = useState<string | null>(null);
  const [interestError, setInterestError] = useState<string | null>(null);

  // Modal visibility states
  const [skillModalVisible, setSkillModalVisible] = useState(false);
  const [interestModalVisible, setInterestModalVisible] = useState(false);

  const [formData, setFormData] = useState({
    birthDate: profile?.birthDate ?? '',
    bio: profile?.bio ?? '',
    skills: profile?.skills ?? [],
    interests: profile?.interests ?? [],
    projects: (profile?.projects ?? []).map((project) => ({
      name: project.name ?? '',
      description: project.description ?? '',
    })),
    experiences: (profile?.experiences ?? []).map((experience) => ({
      company: experience.company ?? '',
      position: experience.position ?? '',
      description: experience.description ?? '',
      startDate: toMonthValue(experience.startDate),
      endDate: toMonthValue(experience.endDate),
    })),
    githubUsername: profile?.githubUsername ?? '',
  });

  const handleEditToggle = useCallback(() => {
    if (isEditing) {
      setFormData({
        birthDate: profile?.birthDate ?? '',
        bio: profile?.bio ?? '',
        skills: profile?.skills ?? [],
        interests: profile?.interests ?? [],
        projects: (profile?.projects ?? []).map((project) => ({
          name: project.name ?? '',
          description: project.description ?? '',
        })),
        experiences: (profile?.experiences ?? []).map((experience) => ({
          company: experience.company ?? '',
          position: experience.position ?? '',
          description: experience.description ?? '',
          startDate: toMonthValue(experience.startDate),
          endDate: toMonthValue(experience.endDate),
        })),
        githubUsername: profile?.githubUsername ?? '',
      });
      setPhoto(profile?.profilePicture ?? null);
      // Reset custom inputs and errors
      setCustomSkill('');
      setCustomInterest('');
      setSkillError(null);
      setInterestError(null);
    }
    setIsEditing(!isEditing);
  }, [isEditing, profile]);

  // Auto-cancel editing when navigating away
  useFocusEffect(
    useCallback(() => {
      // Return cleanup function to run on blur
      return () => {
        if (isEditing) {
          handleEditToggle();
        }
      };
    }, [isEditing, handleEditToggle])
  );

  const handleSave = useCallback(async () => {
    if (!session?.user?.id) return;

    setSaving(true);
    try {
      const updated = await updateProfile(session.user.id, formData);
      setProfileLocally(updated);
      setIsEditing(false);
      setSuccessModalMessage('Profile updated successfully!');
      setSuccessModalVisible(true);
    } catch (error: any) {
      setErrorModalMessage(error?.message || 'Failed to update profile');
      setErrorModalVisible(true);
    } finally {
      setSaving(false);
    }
  }, [session, formData, setProfileLocally]);

  const toggleSkill = useCallback((skill: string) => {
    setFormData((prev) => {
      if (prev.skills.includes(skill)) {
        setSkillError(null);
        return { ...prev, skills: prev.skills.filter((s) => s !== skill) };
      }
      if (prev.skills.length >= PROFILE_MAX_SKILLS) {
        setSkillError(`Maximum limit of ${PROFILE_MAX_SKILLS} skills reached`);
        return prev;
      }
      setSkillError(null);
      return { ...prev, skills: [...prev.skills, skill] };
    });
  }, []);

  const toggleInterest = useCallback((interest: string) => {
    setFormData((prev) => {
      if (prev.interests.includes(interest)) {
        setInterestError(null);
        return { ...prev, interests: prev.interests.filter((i) => i !== interest) };
      }
      if (prev.interests.length >= PROFILE_MAX_INTERESTS) {
        setInterestError(`Maximum limit of ${PROFILE_MAX_INTERESTS} interests reached`);
        return prev;
      }
      setInterestError(null);
      return { ...prev, interests: [...prev.interests, interest] };
    });
  }, []);

  const addCustomSkill = useCallback(() => {
    const normalized = normalizeTagInput(customSkill);
    const validation = validateTagInput(normalized, 'Skill');
    if (validation) {
      setSkillError(validation);
      return;
    }

    if (formData.skills.includes(normalized)) {
      setSkillError('This skill is already added');
      return;
    }

    if (formData.skills.length >= PROFILE_MAX_SKILLS) {
      setSkillError(`Maximum limit of ${PROFILE_MAX_SKILLS} skills reached`);
      return;
    }

    setFormData((prev) => ({ ...prev, skills: [...prev.skills, normalized] }));
    setCustomSkill('');
    setSkillError(null);
  }, [customSkill, formData.skills]);

  const addCustomInterest = useCallback(() => {
    const normalized = normalizeTagInput(customInterest);
    const validation = validateTagInput(normalized, 'Interest');
    if (validation) {
      setInterestError(validation);
      return;
    }

    if (formData.interests.includes(normalized)) {
      setInterestError('This interest is already added');
      return;
    }

    if (formData.interests.length >= PROFILE_MAX_INTERESTS) {
      setInterestError(`Maximum limit of ${PROFILE_MAX_INTERESTS} interests reached`);
      return;
    }

    setFormData((prev) => ({ ...prev, interests: [...prev.interests, normalized] }));
    setCustomInterest('');
    setInterestError(null);
  }, [customInterest, formData.interests]);

  const addProject = useCallback(() => {
    setFormData((prev) => {
      if (prev.projects.length >= PROFILE_MAX_PROJECTS) return prev;
      return {
        ...prev,
        projects: [...prev.projects, { name: '', description: '' }],
      };
    });
  }, []);

  const removeProject = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      projects: prev.projects.filter((_, i) => i !== index),
    }));
  }, []);

  const updateProjectField = useCallback((index: number, field: 'name' | 'description', value: string) => {
    setFormData((prev) => ({
      ...prev,
      projects: prev.projects.map((project, i) =>
        i === index ? { ...project, [field]: value } : project
      ),
    }));
  }, []);

  const addExperience = useCallback(() => {
    setFormData((prev) => {
      if (prev.experiences.length >= PROFILE_MAX_EXPERIENCES) return prev;
      return {
        ...prev,
        experiences: [...prev.experiences, { company: '', position: '', description: '', startDate: '', endDate: '' }],
      };
    });
  }, []);

  const removeExperience = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      experiences: prev.experiences.filter((_, i) => i !== index),
    }));
  }, []);

  const updateExperienceField = useCallback(
    (index: number, field: 'company' | 'position' | 'description' | 'startDate' | 'endDate', value: string) => {
      const normalizeMonthInput = (input: string) => {
        const digits = input.replace(/\D/g, '').slice(0, 6);
        if (digits.length <= 4) return digits;
        return `${digits.slice(0, 4)}-${digits.slice(4)}`;
      };

      setFormData((prev) => ({
        ...prev,
        experiences: prev.experiences.map((experience, i) =>
          i === index
            ? {
              ...experience,
              ...(field === 'startDate'
                ? {
                  startDate: normalizeMonthInput(value),
                  ...(normalizeMonthInput(value).length === 0 ? { endDate: '' } : {}),
                }
                : field === 'endDate'
                  ? {
                    endDate: experience.startDate
                      ? normalizeMonthInput(value)
                      : '',
                  }
                  : { [field]: value }),
            }
            : experience
        ),
      }));
    },
    []
  );

  const handlePickImage = useCallback(async () => {
    // Check if rate limited before proceeding
    if (rateLimit.isLimited) {
      Alert.alert(
        'Upload Limit Reached',
        `You've reached the limit of 5 profile picture uploads per hour.\n\nPlease try again in ${rateLimit.retryAfterMinutes} minute${rateLimit.retryAfterMinutes !== 1 ? 's' : ''}.`,
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

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
        const updated = await updateProfile(session.user.id, { profilePicture: publicUrl });
        setProfileLocally(updated);
      }

      setSuccessModalMessage('Profile picture updated!');
      setSuccessModalVisible(true);
    } catch (error: any) {
      // Check if it's a rate limit error (in case state wasn't updated yet)
      if (error.name === 'RateLimitError' || error.message?.includes('Rate limit')) {
        const minutes = error.retryAfterMinutes || Math.ceil((error.retryAfter || 3600) / 60);
        Alert.alert(
          'Upload Limit Reached',
          `You've reached the limit of 5 profile picture uploads per hour.\n\nPlease try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`,
          [{ text: 'OK', style: 'default' }]
        );
      } else {
        Alert.alert('Upload Failed', error.message || 'Failed to upload profile picture');
      }
    }
  }, [upload, session, setProfileLocally, rateLimit]);

  const handleLogout = useCallback(() => {
    setLogoutModalVisible(true);
  }, []);

  const confirmLogout = useCallback(async () => {
    setLogoutModalVisible(false);
    await supabase.auth.signOut();
  }, []);

  const handleDeleteAccount = useCallback(() => {
    setDeleteAccountModalVisible(true);
  }, []);

  const confirmDeleteAccount = useCallback(async () => {
    if (deletingAccount) return;
    setDeletingAccount(true);
    try {
      await deleteMyAccount();
      setDeleteAccountModalVisible(false);
      await supabase.auth.signOut();
    } catch (error: any) {
      setDeleteAccountModalVisible(false);
      setErrorModalMessage(error?.message || 'Failed to delete account. Please try again.');
      setErrorModalVisible(true);
    } finally {
      setDeletingAccount(false);
    }
  }, [deletingAccount]);

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
  const locationEnabled = locationPreference === 'on';
  const locationLabel = currentLocation || (profile?.city && profile?.country ? `${profile.city}, ${profile.country}` : null);

  const handleLocationToggle = useCallback(async (value: boolean) => {
    try {
      await changePreference(value ? 'on' : 'off');
    } catch (error: any) {
      console.error('Failed to update location setting:', error?.message || error);
    }
  }, [changePreference]);

  const handleViewProfile = useCallback(() => {
    if (!profile?.id) return;
    router.push({
      pathname: '/messages/profile/[userId]',
      params: {
        userId: profile.id,
        self: '1',
      },
    });
  }, [profile?.id]);

  return (
    <View style={[styles.container, { paddingTop: top }]}>
      {/* Header */}
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Profile</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.viewButton}
            onPress={handleViewProfile}
          >
            <Text style={styles.viewButtonText}>View</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.editButton, isEditing && styles.editButtonActive]}
            onPress={handleEditToggle}
          >
            <Text style={[styles.editButtonText, isEditing && styles.editButtonTextActive]}>
              {isEditing ? 'Cancel' : 'Edit'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Picture */}
        <View style={styles.profilePhotoSection}>
          <TouchableOpacity
            style={[
              styles.profilePhotoContainer,
              rateLimit.isLimited && styles.profilePhotoDisabled,
            ]}
            onPress={isEditing ? handlePickImage : undefined}
            disabled={!isEditing || uploading || rateLimit.isLimited}
          >
            {uploading ? (
              <View style={styles.emptyProfilePhoto}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.addPhotoText}>Uploading...</Text>
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
          {/* Rate Limit Warning */}
          {rateLimit.isLimited && isEditing && (
            <View style={styles.rateLimitBanner}>
              <Ionicons name="time-outline" size={16} color="#F59E0B" />
              <Text style={styles.rateLimitText}>
                Upload limit reached. Try again in {rateLimit.retryAfterMinutes} min
              </Text>
            </View>
          )}
        </View>

        {/* Name & Basic Info */}
        <NeoCard style={styles.section}>
          <View style={styles.labelRow}>
            <Text style={styles.sectionLabel}>NAME</Text>
          </View>
          <Text style={styles.displayName}>
            {profile?.name || 'Add your name'}
            {age && <Text style={styles.ageText}>, {age}</Text>}
          </Text>
        </NeoCard>

        {/* Location Section */}
        <NeoCard style={styles.section}>
          <View style={styles.locationHeaderRow}>
            <Text style={[styles.sectionLabel, { marginBottom: 0 }]}>LOCATION</Text>
            {isEditing ? (
              <Switch
                value={locationEnabled}
                onValueChange={handleLocationToggle}
                disabled={!locationInitialized}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor={locationEnabled ? COLORS.surface : COLORS.textLight}
              />
            ) : null}
          </View>
          <View style={styles.locationCard}>
            <View style={styles.locationInfo}>
              <Ionicons name="location" size={24} color={COLORS.primary} />
              <View style={styles.locationDetails}>
                <Text style={styles.locationCity}>Location</Text>
                {locationEnabled && locationLabel ? (
                  <Text style={styles.locationUpdatedText}>{locationLabel}</Text>
                ) : null}
              </View>
            </View>
          </View>
        </NeoCard>

        {/* Bio Section */}
        <NeoCard style={styles.section}>
          <View style={styles.labelRow}>
            <Text style={styles.sectionLabel}>BIO</Text>
            {isEditing && (
              <Text style={[
                styles.charCount,
                formData.bio.length >= PROFILE_BIO_MAX_LENGTH && styles.charCountLimit,
              ]}>
                {formData.bio.length}/{PROFILE_BIO_MAX_LENGTH}
              </Text>
            )}
          </View>
          {isEditing ? (
            <>
              <TextInput
                style={[styles.input, styles.bioInput]}
                value={formData.bio}
                maxLength={PROFILE_BIO_MAX_LENGTH}
                onChangeText={(text) => {
                  setFormData((prev) => ({ ...prev, bio: text }));
                }}
                placeholder="Tell others about yourself, your projects, and what you're looking for..."
                placeholderTextColor={COLORS.textLight}
                multiline
                textAlignVertical="top"
              />
              {formData.bio.length >= PROFILE_BIO_MAX_LENGTH && (
                <Text style={styles.charLimitWarning}>
                  Bio cannot exceed {PROFILE_BIO_MAX_LENGTH} characters
                </Text>
              )}
            </>
          ) : (
            <Text style={styles.bioText}>{profile?.bio || 'No bio yet. Tap Edit to add one!'}</Text>
          )}
        </NeoCard>

        {/* Skills Section */}
        <NeoCard style={styles.section}>
          <View style={styles.labelRow}>
            <Text style={styles.sectionLabel}>SKILLS</Text>
            {isEditing && (
              <Text style={[
                styles.charCount,
                formData.skills.length >= PROFILE_MAX_SKILLS && styles.charCountLimit,
              ]}>
                {formData.skills.length}/{PROFILE_MAX_SKILLS}
              </Text>
            )}
          </View>
          {skillError && (
            <Text style={styles.limitError}>{skillError}</Text>
          )}
          <ChipContainer>
            {isEditing ? (
              <>
                {/* Show custom skills first */}
                {formData.skills
                  .filter((s) => !AVAILABLE_SKILLS.includes(s))
                  .map((skill) => (
                    <NeoChip
                      key={skill}
                      label={skill}
                      variant="skill"
                      selected
                      onPress={() => toggleSkill(skill)}
                    />
                  ))}
                {AVAILABLE_SKILLS.map((skill) => {
                  const isSelected = formData.skills.includes(skill);
                  return (
                    <NeoChip
                      key={skill}
                      label={skill}
                      variant="skill"
                      selected={isSelected}
                      onPress={() => toggleSkill(skill)}
                    />
                  );
                })}
                {/* Plus button chip */}
                {formData.skills.length < PROFILE_MAX_SKILLS && (
                  <TouchableOpacity
                    style={styles.addChip}
                    onPress={() => setSkillModalVisible(true)}
                  >
                    <Ionicons name="add" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <>
                {(profile?.skills || []).map((skill) => (
                  <NeoChip
                    key={skill}
                    label={skill}
                    variant="skill"
                    selected
                  />
                ))}
                {(!profile?.skills || profile.skills.length === 0) && (
                  <Text style={styles.emptyText}>No skills added yet</Text>
                )}
              </>
            )}
          </ChipContainer>
        </NeoCard>

        {/* Interests Section */}
        <NeoCard style={styles.section}>
          <View style={styles.labelRow}>
            <Text style={styles.sectionLabel}>INTERESTS</Text>
            {isEditing && (
              <Text style={[
                styles.charCount,
                formData.interests.length >= PROFILE_MAX_INTERESTS && styles.charCountLimit,
              ]}>
                {formData.interests.length}/{PROFILE_MAX_INTERESTS}
              </Text>
            )}
          </View>
          {interestError && (
            <Text style={styles.limitError}>{interestError}</Text>
          )}
          <ChipContainer>
            {isEditing ? (
              <>
                {/* Show custom interests first */}
                {formData.interests
                  .filter((i) => !AVAILABLE_INTERESTS.includes(i))
                  .map((interest) => (
                    <NeoChip
                      key={interest}
                      label={interest}
                      variant="looking"
                      selected
                      onPress={() => toggleInterest(interest)}
                    />
                  ))}
                {AVAILABLE_INTERESTS.map((interest) => {
                  const isSelected = formData.interests.includes(interest);
                  return (
                    <NeoChip
                      key={interest}
                      label={interest}
                      variant="looking"
                      selected={isSelected}
                      onPress={() => toggleInterest(interest)}
                    />
                  );
                })}
                {/* Plus button chip */}
                {formData.interests.length < PROFILE_MAX_INTERESTS && (
                  <TouchableOpacity
                    style={styles.addChip}
                    onPress={() => setInterestModalVisible(true)}
                  >
                    <Ionicons name="add" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <>
                {(profile?.interests || []).map((interest) => (
                  <NeoChip
                    key={interest}
                    label={interest}
                    variant="looking"
                    selected
                  />
                ))}
                {(!profile?.interests || profile.interests.length === 0) && (
                  <Text style={styles.emptyText}>No interests added yet</Text>
                )}
              </>
            )}
          </ChipContainer>
        </NeoCard>

        {/* Experience */}
        <NeoCard style={styles.section}>
          <View style={styles.labelRow}>
            <Text style={styles.sectionLabel}>EXPERIENCE</Text>
            <Text style={styles.charCount}>
              {formData.experiences.length}/{PROFILE_MAX_EXPERIENCES}
            </Text>
          </View>

          {isEditing ? (
            <>
              {formData.experiences.map((experience, index) => (
                <View key={`experience-${index}`} style={styles.itemCard}>
                  <View style={styles.itemCardHeader}>
                    <Text style={styles.itemCardTitle}>Experience {index + 1}</Text>
                    <TouchableOpacity onPress={() => removeExperience(index)}>
                      <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Company"
                    placeholderTextColor={COLORS.textLight}
                    maxLength={PROFILE_EXPERIENCE_COMPANY_MAX_LENGTH}
                    value={experience.company ?? ''}
                    onChangeText={(value) => updateExperienceField(index, 'company', value)}
                  />
                  <TextInput
                    style={[styles.input, { marginTop: 8 }]}
                    placeholder="Position"
                    placeholderTextColor={COLORS.textLight}
                    maxLength={PROFILE_EXPERIENCE_POSITION_MAX_LENGTH}
                    value={experience.position ?? ''}
                    onChangeText={(value) => updateExperienceField(index, 'position', value)}
                  />
                  <TextInput
                    style={[styles.input, styles.bioInput, { marginTop: 8 }]}
                    placeholder="What did you do there? (optional)"
                    placeholderTextColor={COLORS.textLight}
                    maxLength={PROFILE_EXPERIENCE_DESCRIPTION_MAX_LENGTH}
                    value={experience.description ?? ''}
                    onChangeText={(value) => updateExperienceField(index, 'description', value)}
                    multiline
                    textAlignVertical="top"
                  />
                  <View style={styles.rowInputs}>
                    <TextInput
                      style={[styles.input, styles.rowInput]}
                      placeholder="Start (YYYY-MM)"
                      placeholderTextColor={COLORS.textLight}
                      keyboardType="number-pad"
                      maxLength={7}
                      value={experience.startDate ?? ''}
                      onChangeText={(value) => updateExperienceField(index, 'startDate', value)}
                    />
                    <TextInput
                      style={[styles.input, styles.rowInput]}
                      placeholder="End (YYYY-MM, optional)"
                      placeholderTextColor={COLORS.textLight}
                      keyboardType="number-pad"
                      maxLength={7}
                      value={experience.endDate ?? ''}
                      onChangeText={(value) => updateExperienceField(index, 'endDate', value)}
                    />
                  </View>
                </View>
              ))}
              {formData.experiences.length < PROFILE_MAX_EXPERIENCES && (
                <NeoButton title="Add Experience" onPress={addExperience} variant="secondary" />
              )}
            </>
          ) : (
            <>
              {(profile?.experiences ?? []).length > 0 ? (
                (profile?.experiences ?? []).map((experience, index) => (
                  <View key={experience.id ?? `experience-view-${index}`} style={styles.itemCard}>
                    <Text style={styles.itemPrimary}>
                      {experience.position} {experience.company ? `@ ${experience.company}` : ''}
                    </Text>
                    {experience.description ? (
                      <Text style={styles.itemSecondary}>{experience.description}</Text>
                    ) : null}
                    {(experience.startDate || experience.endDate) ? (
                      <Text style={styles.itemMeta}>
                        {(toMonthValue(experience.startDate) || 'Start')} - {(toMonthValue(experience.endDate) || 'Present')}
                      </Text>
                    ) : null}
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No experience added yet</Text>
              )}
            </>
          )}
        </NeoCard>

        {/* Projects */}
        <NeoCard style={styles.section}>
          <View style={styles.labelRow}>
            <Text style={styles.sectionLabel}>PROJECTS</Text>
            <Text style={styles.charCount}>
              {formData.projects.length}/{PROFILE_MAX_PROJECTS}
            </Text>
          </View>

          {isEditing ? (
            <>
              {formData.projects.map((project, index) => (
                <View key={`project-${index}`} style={styles.itemCard}>
                  <View style={styles.itemCardHeader}>
                    <Text style={styles.itemCardTitle}>Project {index + 1}</Text>
                    <TouchableOpacity onPress={() => removeProject(index)}>
                      <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Project name"
                    placeholderTextColor={COLORS.textLight}
                    maxLength={PROFILE_PROJECT_NAME_MAX_LENGTH}
                    value={project.name ?? ''}
                    onChangeText={(value) => updateProjectField(index, 'name', value)}
                  />
                  <TextInput
                    style={[styles.input, styles.bioInput, { marginTop: 8 }]}
                    placeholder="Describe what you built"
                    placeholderTextColor={COLORS.textLight}
                    maxLength={PROFILE_PROJECT_DESCRIPTION_MAX_LENGTH}
                    value={project.description ?? ''}
                    onChangeText={(value) => updateProjectField(index, 'description', value)}
                    multiline
                    textAlignVertical="top"
                  />
                </View>
              ))}
              {formData.projects.length < PROFILE_MAX_PROJECTS && (
                <NeoButton title="Add Project" onPress={addProject} variant="secondary" />
              )}
            </>
          ) : (
            <>
              {(profile?.projects ?? []).length > 0 ? (
                (profile?.projects ?? []).map((project, index) => (
                  <View key={project.id ?? `project-view-${index}`} style={styles.itemCard}>
                    <Text style={styles.itemPrimary}>{project.name}</Text>
                    <Text style={styles.itemSecondary}>{project.description}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No projects added yet</Text>
              )}
            </>
          )}
        </NeoCard>

        {/* GitHub Username */}
        <NeoCard style={styles.section}>
          <Text style={styles.sectionLabel}>GITHUB</Text>
          {isEditing ? (
            <View>
              <View style={styles.inputWithIcon}>
                <Ionicons name="logo-github" size={20} color={COLORS.textLight} />
                <TextInput
                  style={styles.inputWithIconText}
                  value={formData.githubUsername}
                  onChangeText={(text) =>
                    setFormData((prev) => ({
                      ...prev,
                      githubUsername: text.replace(/[^A-Za-z0-9-]/g, ''),
                    }))
                  }
                  placeholder="your-github-username"
                  placeholderTextColor={COLORS.textLight}
                  autoCapitalize="none"
                  maxLength={PROFILE_GITHUB_MAX_LENGTH}
                />
              </View>
              {formData.githubUsername.length >= PROFILE_GITHUB_MAX_LENGTH && (
                <Text style={styles.charLimitWarning}>
                  GitHub username cannot exceed {PROFILE_GITHUB_MAX_LENGTH} characters
                </Text>
              )}
            </View>
          ) : (
            <TouchableOpacity
              style={styles.githubRow}
              onPress={() => {
                if (profile?.githubUsername) {
                  Linking.openURL(`https://github.com/${profile.githubUsername}`);
                }
              }}
              disabled={!profile?.githubUsername}
            >
              <Ionicons name="logo-github" size={20} color={profile?.githubUsername ? COLORS.primary : COLORS.textPrimary} />
              <Text style={[
                styles.githubText,
                profile?.githubUsername && styles.githubLinkText
              ]}>
                {profile?.githubUsername || 'Not connected'}
              </Text>
              {profile?.githubUsername && (
                <Ionicons name="open-outline" size={14} color={COLORS.primary} style={{ marginLeft: 4 }} />
              )}
            </TouchableOpacity>
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

          <TouchableOpacity style={styles.settingsItem} onPress={handleDeleteAccount}>
            <Ionicons name="trash-outline" size={22} color={COLORS.danger} />
            <Text style={[styles.settingsItemText, { color: COLORS.danger }]}>
              Delete Account
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {saving && (
        <View style={styles.savingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.savingOverlayText}>Updating profile...</Text>
        </View>
      )}

      <Modal
        visible={logoutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setLogoutModalVisible(false)}
          />
          <View style={styles.confirmModalContent}>
            <Text style={styles.confirmModalTitle}>Logout</Text>
            <Text style={styles.confirmModalBody}>Are you sure you want to logout?</Text>
            <View style={styles.confirmActions}>
              <View style={styles.confirmActionSlot}>
                <NeoButton
                  title="Cancel"
                  variant="secondary"
                  onPress={() => setLogoutModalVisible(false)}
                  style={{ width: '100%' }}
                />
              </View>
              <View style={styles.confirmActionSlot}>
                <NeoButton
                  title="Logout"
                  onPress={confirmLogout}
                  style={{ width: '100%' }}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={deleteAccountModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deletingAccount) setDeleteAccountModalVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => {
              if (!deletingAccount) setDeleteAccountModalVisible(false);
            }}
          />
          <View style={styles.confirmModalContent}>
            <Text style={styles.confirmModalTitle}>Delete Account</Text>
            <Text style={styles.confirmModalBody}>
              This action is permanent. Your profile, matches, messages, projects, and experiences will be removed.
            </Text>
            <View style={styles.confirmActions}>
              <View style={styles.confirmActionSlot}>
                <NeoButton
                  title="Cancel"
                  variant="secondary"
                  onPress={() => setDeleteAccountModalVisible(false)}
                  disabled={deletingAccount}
                  style={{ width: '100%' }}
                />
              </View>
              <View style={styles.confirmActionSlot}>
                <NeoButton
                  title={deletingAccount ? 'Deleting...' : 'Delete'}
                  variant="danger"
                  onPress={confirmDeleteAccount}
                  disabled={deletingAccount}
                  style={{ width: '100%' }}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={successModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSuccessModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setSuccessModalVisible(false)}
          />
          <View style={styles.successModalContent}>
            <Text style={styles.successModalTitle}>Success</Text>
            <Text style={styles.successModalBody}>{successModalMessage}</Text>
            <NeoButton
              title="OK"
              onPress={() => setSuccessModalVisible(false)}
              fullWidth
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={errorModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setErrorModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setErrorModalVisible(false)}
          />
          <View style={styles.errorModalContent}>
            <Text style={styles.errorModalTitle}>Couldn&apos;t Save Profile</Text>
            <Text style={styles.errorModalBody}>{errorModalMessage}</Text>
            <NeoButton
              title="OK"
              onPress={() => setErrorModalVisible(false)}
              fullWidth
            />
          </View>
        </View>
      </Modal>

      {/* Add Custom Skill Modal */}
      <Modal
        visible={skillModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setSkillModalVisible(false);
          setCustomSkill('');
          setSkillError(null);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => {
              setSkillModalVisible(false);
              setCustomSkill('');
              setSkillError(null);
            }}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Custom Skill</Text>
              <TouchableOpacity
                onPress={() => {
                  setSkillModalVisible(false);
                  setCustomSkill('');
                  setSkillError(null);
                }}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalInput}
              value={customSkill}
              onChangeText={(text) => {
                setCustomSkill(text);
                setSkillError(null);
              }}
              placeholder="Enter skill name..."
              placeholderTextColor={COLORS.textLight}
              maxLength={PROFILE_TAG_MAX_LENGTH}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => {
                addCustomSkill();
                if (!skillError) {
                  setSkillModalVisible(false);
                }
              }}
            />
            <Text style={styles.modalCharCount}>
              {customSkill.length}/{PROFILE_TAG_MAX_LENGTH}
            </Text>
            {skillError && (
              <Text style={styles.modalError}>{skillError}</Text>
            )}
            <TouchableOpacity
              style={[
                styles.modalAddButton,
                !customSkill.trim() && styles.modalAddButtonDisabled,
              ]}
              onPress={() => {
                addCustomSkill();
                if (!skillError && customSkill.trim()) {
                  setSkillModalVisible(false);
                }
              }}
              disabled={!customSkill.trim()}
            >
              <Ionicons name="add" size={20} color={COLORS.background} />
              <Text style={styles.modalAddButtonText}>Add Skill</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Custom Interest Modal */}
      <Modal
        visible={interestModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setInterestModalVisible(false);
          setCustomInterest('');
          setInterestError(null);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => {
              setInterestModalVisible(false);
              setCustomInterest('');
              setInterestError(null);
            }}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Custom Interest</Text>
              <TouchableOpacity
                onPress={() => {
                  setInterestModalVisible(false);
                  setCustomInterest('');
                  setInterestError(null);
                }}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalInput}
              value={customInterest}
              onChangeText={(text) => {
                setCustomInterest(text);
                setInterestError(null);
              }}
              placeholder="Enter interest name..."
              placeholderTextColor={COLORS.textLight}
              maxLength={PROFILE_TAG_MAX_LENGTH}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => {
                addCustomInterest();
                if (!interestError) {
                  setInterestModalVisible(false);
                }
              }}
            />
            <Text style={styles.modalCharCount}>
              {customInterest.length}/{PROFILE_TAG_MAX_LENGTH}
            </Text>
            {interestError && (
              <Text style={styles.modalError}>{interestError}</Text>
            )}
            <TouchableOpacity
              style={[
                styles.modalAddButton,
                !customInterest.trim() && styles.modalAddButtonDisabled,
              ]}
              onPress={() => {
                addCustomInterest();
                if (!interestError && customInterest.trim()) {
                  setInterestModalVisible(false);
                }
              }}
              disabled={!customInterest.trim()}
            >
              <Ionicons name="add" size={20} color={COLORS.background} />
              <Text style={styles.modalAddButtonText}>Add Interest</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
  profilePhotoDisabled: {
    opacity: 0.6,
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
  rateLimitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: BORDERS.thin,
    borderColor: '#F59E0B',
  },
  rateLimitText: {
    fontSize: 12,
    color: '#92400E',
    marginLeft: 6,
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
  charCountLimit: {
    color: COLORS.danger,
  },
  charLimitWarning: {
    fontSize: 12,
    color: COLORS.danger,
    fontWeight: '600',
    marginTop: 6,
  },
  limitError: {
    fontSize: 12,
    color: COLORS.danger,
    fontWeight: '600',
    marginTop: 8,
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
  itemCard: {
    backgroundColor: COLORS.background,
    borderWidth: BORDERS.thin,
    borderColor: COLORS.border,
    borderRadius: RADIUS.small,
    padding: 12,
    marginBottom: 10,
  },
  itemCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  itemCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  rowInputs: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 8,
  },
  rowInput: {
    flex: 1,
  },
  itemPrimary: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  itemSecondary: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    color: COLORS.textSecondary,
  },
  itemMeta: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.background,
    borderBottomWidth: BORDERS.thin,
    borderBottomColor: COLORS.border,
    position: 'relative',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
    textAlign: 'left',
  },
  headerActions: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: BORDERS.thin,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  editButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: BORDERS.thin,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  editButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  editButtonTextActive: {
    color: COLORS.surface,
  },

  // Location
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
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
  locationUpdatedText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
    fontWeight: '500',
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
  githubLinkText: {
    color: COLORS.primary,
    textDecorationLine: 'underline',
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
  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savingOverlayText: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.small,
    borderWidth: BORDERS.thin,
    borderColor: COLORS.border,
  },

  // Add Chip (Plus Button)
  addChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '85%',
    maxWidth: 340,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.medium,
    padding: 20,
    borderWidth: BORDERS.medium,
    borderColor: COLORS.border,
    ...SHADOWS.large,
  },
  errorModalContent: {
    width: '85%',
    maxWidth: 360,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.medium,
    padding: 20,
    borderWidth: BORDERS.medium,
    borderColor: COLORS.border,
    ...SHADOWS.large,
  },
  successModalContent: {
    width: '85%',
    maxWidth: 360,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.medium,
    padding: 20,
    borderWidth: BORDERS.medium,
    borderColor: COLORS.border,
    ...SHADOWS.large,
  },
  successModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  successModalBody: {
    fontSize: 16,
    lineHeight: 22,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  errorModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  errorModalBody: {
    fontSize: 16,
    lineHeight: 22,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  confirmModalContent: {
    width: '85%',
    maxWidth: 360,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.medium,
    padding: 20,
    borderWidth: BORDERS.medium,
    borderColor: COLORS.border,
    ...SHADOWS.large,
  },
  confirmModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  confirmModalBody: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginBottom: 18,
    lineHeight: 22,
  },
  confirmActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  confirmActionSlot: {
    width: '48%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalInput: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.small,
    padding: 14,
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textPrimary,
    borderWidth: BORDERS.thin,
    borderColor: COLORS.border,
  },
  modalCharCount: {
    fontSize: 12,
    color: COLORS.textLight,
    textAlign: 'right',
    marginTop: 6,
    fontWeight: '600',
  },
  modalError: {
    fontSize: 12,
    color: COLORS.danger,
    fontWeight: '600',
    marginTop: 8,
  },
  modalAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.small,
    paddingVertical: 14,
    marginTop: 16,
    gap: 8,
    borderWidth: BORDERS.thin,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  modalAddButtonDisabled: {
    backgroundColor: COLORS.gray200,
    opacity: 0.6,
  },
  modalAddButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.background,
  },
});
