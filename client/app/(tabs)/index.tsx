/**
 * @file client/app/(tabs)/index.tsx
 * @description Discovery Feed Screen with Neo-brutalist design
 * 
 * Features:
 * - Swipe cards with profile information
 * - Neo-brutalist styling with bold borders and shadows
 * - Skip, Request, and Save actions
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  Dimensions,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOutLeft, SlideInRight } from 'react-native-reanimated';

import { useFeed } from '@/src/hooks/useFeed';
import { useAuth } from '@/src/auth/AuthProvider';
import { COLORS, SHADOWS, BORDERS, RADIUS } from '@/src/theme/colors';
import { NeoCard } from '@/src/components/NeoCard';
import { NeoButton } from '@/src/components/NeoButton';
import { NeoChip, ChipContainer } from '@/src/components/NeoChip';
import {
  INTRO_MESSAGE_MIN_LENGTH,
  INTRO_MESSAGE_MAX_LENGTH,
  isIntroMessageValid,
  getIntroMessageError,
} from '@/src/constants/validation';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function FeedScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const { profiles, loading, error, hasMore, fetchFeed, swipe, swipeError, clearSwipeError } = useFeed();

  const [message, setMessage] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const autoRefreshInFlight = useRef(false);

  // Computed validation state
  const introMessageError = getIntroMessageError(message);
  const isIntroValid = isIntroMessageValid(message);

  // useFeed loads cache + fetches 5 on mount. No explicit fetch needed.

  const currentProfile = profiles[currentIndex];
  const formatMonth = (value?: string | null) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      const monthMatch = /^(\d{4}-\d{2})/.exec(value);
      return monthMatch ? monthMatch[1] : value;
    }
    return parsed.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  };

  const handleSkip = async () => {
    if (!currentProfile) return;
    await swipe(currentProfile.id, false);
  };

  const handleLike = async () => {
    if (!currentProfile) return;
    if (!isIntroValid) return;
    const result = await swipe(currentProfile.id, true, message);
    if (result && (result.matched || !result.error)) {
      setMessage('');
      setShowRequestModal(false);
    }
    // On error, modal stays open so user can fix validation (e.g. field 'message') and retry
  };

  const handleRetrySwipe = async () => {
    if (!swipeError) return;
    await swipe(swipeError.profileId, swipeError.liked, swipeError.message);
  };

  const showSwipeRetry = swipeError && currentProfile && swipeError.profileId === currentProfile.id;

  const handleSave = () => {
    // Visual feedback - bookmark functionality
  };

  const openRequestModal = () => {
    setShowRequestModal(true);
    setMessage('');
  };

  const closeRequestModal = () => {
    setShowRequestModal(false);
    setMessage('');
  };

  const insertTemplate = (type: 'hackathon' | 'project' | 'startup') => {
    const templates = {
      hackathon:
        "Hey! I'm looking for a teammate for an upcoming hackathon focused on [topic]. Your experience with ",
      project:
        "Hi! I'm working on a side project and think your skills would be a great fit. ",
      startup:
        "Hello! I'm building a startup in the [industry] space and looking for a technical co-founder. ",
    };
    setMessage(templates[type]);
  };

  // Auto-refresh when feed is empty so newly joined users appear without manual action.
  useEffect(() => {
    if (currentProfile || loading) return;

    const interval = setInterval(async () => {
      if (autoRefreshInFlight.current) return;
      autoRefreshInFlight.current = true;
      try {
        await fetchFeed(true);
      } finally {
        autoRefreshInFlight.current = false;
      }
    }, 90 * 1000);

    return () => clearInterval(interval);
  }, [currentProfile, loading, fetchFeed]);

  // Loading state
  if (loading && profiles.length === 0) {
    return (
      <View style={[styles.centerContainer, { paddingTop: top }]}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Finding collaborators...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={[styles.centerContainer, { paddingTop: top }]}>
        <NeoCard style={styles.errorCard}>
          <Ionicons name="alert-circle" size={48} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <NeoButton title="Retry" onPress={() => fetchFeed(true)} />
        </NeoCard>
      </View>
    );
  }

  // Empty state
  if (!currentProfile || currentIndex >= profiles.length) {
    return (
      <View style={[styles.centerContainer, { paddingTop: top }]}>
        <NeoCard style={styles.emptyCard}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="search" size={48} color={COLORS.primary} />
          </View>
          <Text style={styles.emptyTitle}>No more profiles</Text>
          <Text style={styles.emptySubtitle}>
            Check back later for more profiles or refresh to see people you have passed.
          </Text>
          <NeoButton
            title="Refresh"
            onPress={() => {
              setCurrentIndex(0);
              fetchFeed(true);
            }}
            style={{ marginTop: 16 }}
          />
        </NeoCard>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Troupe</Text>
        </View>
      </View>

      {/* Profile Card */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          key={currentProfile.id}
          entering={SlideInRight.duration(300)}
          exiting={FadeOutLeft.duration(200)}
        >
          <NeoCard style={styles.profileCard}>
            {/* Swipe failure retry banner */}
            {showSwipeRetry && (
              <View style={styles.swipeErrorBanner}>
                <Ionicons name="alert-circle" size={20} color={COLORS.danger} />
                <Text style={styles.swipeErrorText}>Couldn&apos;t send. Tap Retry to try again.</Text>
                <TouchableOpacity
                  style={styles.swipeRetryButton}
                  onPress={handleRetrySwipe}
                >
                  <Text style={styles.swipeRetryButtonText}>Retry</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.swipeDismissButton}
                  onPress={clearSwipeError}
                >
                  <Ionicons name="close" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
            )}


            {/* Profile Image - progressive load with placeholder → sharp transition */}
            <View style={{ paddingHorizontal: 12, paddingTop: 12 }}>
              <View style={styles.imageContainer}>
                {currentProfile.profilePicture ? (
                  <Image
                    source={{ uri: currentProfile.profilePicture }}
                    style={styles.profileImage}
                    contentFit="cover"
                    transition={300}
                  />
                ) : (
                  <View style={[styles.profileImage, styles.noPhotoPlaceholder]}>
                    <Ionicons name="person" size={80} color={COLORS.border} />
                  </View>
                )}
              </View>
            </View>

            {/* Basic Info */}
            <View style={styles.infoSection}>
              <Text style={styles.profileName}>
                {currentProfile.name}
                {currentProfile.age != null ? ` | ${currentProfile.age}` : ''}
              </Text>
            </View>

            {/* Bio */}
            <View style={styles.sectionPadding}>
              <Text style={styles.bioText} numberOfLines={3}>
                {currentProfile.bio || 'No bio available'}
              </Text>

              {/* GitHub Link */}
              {currentProfile.githubUsername && (
                <TouchableOpacity
                  style={styles.githubLinkContainer}
                  onPress={() => Linking.openURL(`https://github.com/${currentProfile.githubUsername}`)}
                >
                  <Ionicons name="logo-github" size={18} color={COLORS.primary} />
                  <Text style={styles.githubLinkText}>github.com/{currentProfile.githubUsername}</Text>
                  <Ionicons name="open-outline" size={14} color={COLORS.primary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Skills */}
            {currentProfile.skills && currentProfile.skills.length > 0 && (
              <View style={styles.sectionPadding}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Skills</Text>
                </View>
                <ChipContainer>
                  {currentProfile.skills.slice(0, 8).map((skill: string, idx: number) => (
                    <NeoChip key={idx} label={skill} variant="skill" />
                  ))}
                  {currentProfile.skills.length > 8 && (
                    <Text style={styles.moreSkills}>
                      +{currentProfile.skills.length - 8} more
                    </Text>
                  )}
                </ChipContainer>
              </View>
            )}

            {/* Interests */}
            {(currentProfile.interests ?? []).length > 0 && (
              <View style={styles.sectionPadding}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Interests</Text>
                </View>
                <ChipContainer>
                  {(currentProfile.interests ?? []).map((item: string, idx: number) => (
                    <NeoChip key={idx} label={item} variant="looking" />
                  ))}
                </ChipContainer>
              </View>
            )}

            {/* Experience */}
            {currentProfile.experiences && currentProfile.experiences.length > 0 && (
              <View style={styles.sectionPadding}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="briefcase-outline" size={16} color={COLORS.primary} style={{ marginRight: 8 }} />
                  <Text style={styles.sectionTitle}>Experience</Text>
                </View>
                {currentProfile.experiences.slice(0, 5).map((experience, index) => (
                  <View key={experience.id ?? `experience-${index}`} style={styles.portfolioItem}>
                    <Text style={styles.portfolioTitle}>
                      {experience.position}{experience.company ? ` @ ${experience.company}` : ''}
                    </Text>
                    {experience.description ? (
                      <Text style={styles.portfolioDescription}>{experience.description}</Text>
                    ) : null}
                    {(experience.startDate || experience.endDate) ? (
                      <Text style={styles.portfolioTimeline}>
                        {(formatMonth(experience.startDate) || 'Start')} - {(formatMonth(experience.endDate) || 'Present')}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            )}

            {/* Projects */}
            {currentProfile.projects && currentProfile.projects.length > 0 && (
              <View style={styles.sectionPadding}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="hammer-outline" size={16} color={COLORS.primary} style={{ marginRight: 8 }} />
                  <Text style={styles.sectionTitle}>Projects</Text>
                </View>
                {currentProfile.projects.slice(0, 5).map((project, index) => (
                  <View key={project.id ?? `project-${index}`} style={styles.portfolioItem}>
                    <Text style={styles.portfolioTitle}>{project.name}</Text>
                    <Text style={styles.portfolioDescription}>{project.description}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Location - at bottom (city and country only) */}
            {(currentProfile.city || currentProfile.country) && (
              <View style={styles.sectionPadding}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="location-outline" size={16} color={COLORS.primary} style={{ marginRight: 8 }} />
                  <Text style={styles.sectionTitle}>Location</Text>
                </View>
                <Text style={styles.profileLocation}>
                  {[currentProfile.city, currentProfile.country].filter(Boolean).join(', ')}
                </Text>
              </View>
            )}

            {/* CTA at bottom of card */}
            {/* CTA at bottom of card - REMOVED as per user request */}
            {/* <View style={styles.cardCTA}>
              <Text style={styles.ctaText}>
                Want to collaborate with {currentProfile.name?.split(' ')[0]}?
              </Text>
              <NeoButton
                title="Request to collaborate"
                onPress={openRequestModal}
                icon={<Ionicons name="star" size={16} color="#FDE047" />}
                fullWidth
              />
            </View> */}

            {/* Action Buttons - at bottom of card */}
            <View style={styles.cardActions}>
              <NeoButton title="Skip" onPress={handleSkip} variant="secondary" />
              <NeoButton
                title="Request"
                onPress={openRequestModal}
                style={{ flex: 2, marginHorizontal: 12 }}
              />
            </View>
          </NeoCard>
        </Animated.View>
      </ScrollView>

      {/* Request Modal */}
      <Modal
        visible={showRequestModal}
        animationType="slide"
        transparent
        onRequestClose={closeRequestModal}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeRequestModal}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            {/* Modal Handle */}
            <View style={styles.modalHandle} />

            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Ionicons name="star" size={20} color={COLORS.accent} />
              <Text style={styles.modalTitle}>Send Troupe Request</Text>
            </View>
            <Text style={styles.modalSubtitle}>
              Include a short message so they know why you reached out.
            </Text>

            {/* Profile Preview */}
            <View style={styles.modalProfilePreview}>
              {currentProfile.profilePicture ? (
                <Image
                  source={{ uri: currentProfile.profilePicture || '' }}
                  style={styles.modalAvatar}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <View style={[styles.modalAvatar, styles.noPhotoPlaceholderSmall]}>
                  <Ionicons name="person" size={24} color={COLORS.border} />
                </View>
              )}
              <View>
                <Text style={styles.modalName}>{currentProfile.name}</Text>
                <Text style={styles.modalRole} />
              </View>
            </View>

            {/* Template Buttons */}
            <View style={styles.templateButtons}>
              <TouchableOpacity
                style={[styles.templateBtn, { backgroundColor: COLORS.lookingBg }]}
                onPress={() => insertTemplate('hackathon')}
              >
                <Text style={[styles.templateBtnText, { color: COLORS.lookingText }]}>
                  Hackathon teammate
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.templateBtn, { backgroundColor: COLORS.skillBg }]}
                onPress={() => insertTemplate('project')}
              >
                <Text style={[styles.templateBtnText, { color: COLORS.skillText }]}>
                  Side project partner
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.templateBtn, { backgroundColor: COLORS.greenBg }]}
                onPress={() => insertTemplate('startup')}
              >
                <Text style={[styles.templateBtnText, { color: COLORS.greenText }]}>
                  Long-term collaborator
                </Text>
              </TouchableOpacity>
            </View>

            {/* Message Input */}
            <TextInput
              style={[
                styles.messageInput,
                message.length > INTRO_MESSAGE_MAX_LENGTH && styles.messageInputError
              ]}
              placeholder="Explain what you're building or learning and why you want to collaborate."
              placeholderTextColor={COLORS.textLight}
              value={message}
              onChangeText={setMessage}
              maxLength={INTRO_MESSAGE_MAX_LENGTH + 50} // Allow slight overflow to show error
              multiline
              textAlignVertical="top"
            />

            <View style={styles.charCountRow}>
              <Text style={[
                styles.charCount,
                message.length > INTRO_MESSAGE_MAX_LENGTH && styles.charCountError
              ]}>
                {message.length}/{INTRO_MESSAGE_MAX_LENGTH}
              </Text>
              {(introMessageError || (swipeError?.field === 'message' && swipeError?.profileId === currentProfile?.id && swipeError?.errorMessage)) && (
                <Text style={styles.charError}>
                  {introMessageError || swipeError?.errorMessage}
                </Text>
              )}
            </View>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <NeoButton
                title="Cancel"
                onPress={closeRequestModal}
                variant="secondary"
              />
              <NeoButton
                title="Send request"
                onPress={handleLike}
                disabled={!isIntroValid}
                style={{ flex: 1, marginLeft: 12 }}
              />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: 20,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.background,
    borderBottomWidth: BORDERS.thin,
    borderBottomColor: COLORS.border,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 1,
    marginTop: 2,
  },
  geoCircle: {
    position: 'absolute',
    left: 16,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  sparkle: {
    position: 'absolute',
    right: 32,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },

  // Profile Card
  profileCard: {
    marginBottom: 16,
  },
  swipeErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: RADIUS.small,
    borderWidth: BORDERS.thin,
    borderColor: COLORS.danger,
    gap: 10,
  },
  swipeErrorText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.danger,
  },
  swipeRetryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: RADIUS.small,
  },
  swipeRetryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.surface,
  },
  swipeDismissButton: {
    padding: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  cardBadge: {
    backgroundColor: COLORS.skillBg,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },

  // Image
  imageContainer: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: RADIUS.medium,
    overflow: 'hidden',
    borderWidth: BORDERS.thin,
    borderColor: COLORS.border,
    backgroundColor: COLORS.gray200,
    ...SHADOWS.medium,
  },
  profileImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  noPhotoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.gray200,
  },
  noPhotoPlaceholderSmall: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.gray200,
  },
  imageGeoCircle: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: COLORS.border,
  },

  // Info Section
  infoSection: {
    padding: 16,
    paddingBottom: 12,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  profileLocation: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  profileMeta: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.skillText,
  },

  // Sections
  sectionPadding: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  geoCircleSmall: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: COLORS.border,
    marginRight: 8,
    ...SHADOWS.small,
  },
  diamondIcon: {
    width: 12,
    height: 12,
    backgroundColor: COLORS.accent,
    borderWidth: 2,
    borderColor: COLORS.border,
    transform: [{ rotate: '45deg' }],
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  bioText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textPrimary,
    lineHeight: 24,
  },
  portfolioItem: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDERS.thin,
    borderColor: COLORS.border,
    borderRadius: RADIUS.small,
    padding: 12,
    marginBottom: 10,
  },
  portfolioTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  portfolioDescription: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    color: COLORS.textSecondary,
  },
  portfolioTimeline: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  moreSkills: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.skillText,
    marginLeft: 4,
    alignSelf: 'center',
  },
  githubLinkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: 12,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.small,
    borderWidth: BORDERS.thin,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
  },
  githubLinkText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },

  // Card CTA
  cardCTA: {
    padding: 16,
    borderTopWidth: BORDERS.thin,
    borderTopColor: COLORS.border,
    marginTop: 8,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
  },

  // Card Actions (Skip/Request buttons)
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: BORDERS.thin,
    borderTopColor: COLORS.border,
    marginTop: 8,
  },

  // Action Bar
  actionBar: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    paddingTop: 16,
    paddingHorizontal: 16,

  },
  actionBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookmarkButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    borderWidth: BORDERS.medium,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Loading/Error/Empty States
  loadingCard: {
    alignItems: 'center',
    padding: 40,
  },
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
    maxHeight: '85%',
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
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginLeft: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textMuted,
    marginBottom: 20,
  },
  modalProfilePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.skillBg,
    padding: 12,
    borderRadius: RADIUS.medium,
    borderWidth: BORDERS.thin,
    borderColor: COLORS.border,
    marginBottom: 16,
    ...SHADOWS.small,
  },
  modalAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: COLORS.border,
    marginRight: 12,
  },
  modalName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  modalRole: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.skillText,
  },
  templateButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  templateBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: RADIUS.full,
    borderWidth: BORDERS.thin,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  templateBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  messageInput: {
    borderWidth: BORDERS.thin,
    borderColor: COLORS.border,
    borderRadius: RADIUS.medium,
    padding: 16,
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textPrimary,
    backgroundColor: COLORS.surface,
    minHeight: 120,
    ...SHADOWS.medium,
  },
  messageInputError: {
    borderColor: COLORS.danger,
    borderWidth: 2,
  },
  charCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 20,
  },
  charCount: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  charCountError: {
    color: COLORS.danger,
  },
  charError: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.danger,
    flexShrink: 1,
  },
  modalActions: {
    flexDirection: 'row',
  },
});
