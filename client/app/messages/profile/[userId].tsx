import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Alert,
  TextInput,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS, BORDERS, RADIUS } from '../../../src/theme/colors';
import { NeoCard } from '../../../src/components/NeoCard';
import { NeoChip, ChipContainer } from '../../../src/components/NeoChip';
import { getUserProfileById } from '../../../src/services/profileService';
import { blockMatch, reportUser, unmatchMatch } from '../../../src/messages/message.service';
import { acceptLike, blockUser, declineLike } from '../../../src/services/matchingService';
import {
  REPORT_REASON_MAX_LENGTH,
  REPORT_REASON_MIN_LENGTH,
} from '../../../src/constants/validation';
import type { UserProfile } from '../../../src/types/profile';

type ConfirmAction = 'unmatch' | 'block' | null;

function formatMonth(value?: string | null) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    const monthMatch = /^(\d{4}-\d{2})/.exec(value);
    return monthMatch ? monthMatch[1] : value;
  }
  return parsed.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

export default function MessageProfileScreen() {
  const { bottom } = useSafeAreaInsets();
  const { userId, matchId, self, mode, likeId, introMessage } = useLocalSearchParams<{
    userId?: string | string[];
    matchId?: string | string[];
    self?: string | string[];
    mode?: string | string[];
    likeId?: string | string[];
    introMessage?: string | string[];
  }>();
  const normalizedUserId = Array.isArray(userId) ? userId[0] : userId;
  const normalizedMatchId = Array.isArray(matchId) ? matchId[0] : matchId;
  const selfParam = Array.isArray(self) ? self[0] : self;
  const modeParam = Array.isArray(mode) ? mode[0] : mode;
  const normalizedLikeId = Array.isArray(likeId) ? likeId[0] : likeId;
  const introMessageParam = Array.isArray(introMessage) ? introMessage[0] : introMessage;
  const isSelfPreview = selfParam === '1';
  const isRequestMode = modeParam === 'request' && Boolean(normalizedLikeId);
  const showManageMenu = !isSelfPreview && (Boolean(normalizedMatchId) || isRequestMode);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [confirmingAction, setConfirmingAction] = useState(false);
  const [requestActionSubmitting, setRequestActionSubmitting] = useState<'accept' | 'decline' | null>(null);
  const [declineConfirmVisible, setDeclineConfirmVisible] = useState(false);

  const displayName = useMemo(() => profile?.name ?? 'Profile', [profile?.name]);
  const requestIntroMessage = (introMessageParam ?? '').trim();
  const requestBottomPadding = isRequestMode ? bottom + 210 : bottom + 24;

  const routeToRequests = () => {
    router.replace({
      pathname: '/(tabs)/likes',
      params: { refreshAt: Date.now().toString() },
    });
  };

  useEffect(() => {
    if (!normalizedUserId) return;
    setLoading(true);
    getUserProfileById(normalizedUserId)
      .then(setProfile)
      .catch((error: any) => {
        Alert.alert('Error', error?.message || 'Failed to load profile');
        router.back();
      })
      .finally(() => setLoading(false));
  }, [normalizedUserId]);

  const handleUnmatch = () => {
    setMenuVisible(false);
    if (!normalizedMatchId) return;
    setConfirmAction('unmatch');
  };

  const handleBlock = () => {
    setMenuVisible(false);
    setConfirmAction('block');
  };

  const runConfirmAction = async () => {
    if (!confirmAction || confirmingAction) return;
    setConfirmingAction(true);
    try {
      if (confirmAction === 'unmatch') {
        if (!normalizedMatchId) return;
        await unmatchMatch(normalizedMatchId);
        setConfirmAction(null);
        router.replace('/(tabs)/messages');
      } else {
        if (normalizedMatchId) {
          await blockMatch(normalizedMatchId);
          setConfirmAction(null);
          if (isRequestMode) {
            routeToRequests();
          } else {
            router.replace('/(tabs)/messages');
          }
        } else if (normalizedUserId) {
          await blockUser(normalizedUserId);
          setConfirmAction(null);
          routeToRequests();
        }
      }
    } catch (error) {
      const fallback = confirmAction === 'unmatch'
        ? 'Failed to unmatch. Please try again.'
        : 'Failed to block user. Please try again.';
      Alert.alert('Error', fallback);
    } finally {
      setConfirmingAction(false);
    }
  };

  const submitReport = async () => {
    const reason = reportReason.trim();
    if (!normalizedUserId) return;
    if (reason.length < REPORT_REASON_MIN_LENGTH) {
      Alert.alert('Reason too short', `Please provide at least ${REPORT_REASON_MIN_LENGTH} characters.`);
      return;
    }
    try {
      setSubmittingReport(true);
      await reportUser(normalizedUserId, reason);
      setReportModalVisible(false);
      setReportReason('');
      Alert.alert('Report sent', 'Thank you. This user has been blocked for your safety.');
      if (isRequestMode) {
        routeToRequests();
      } else {
        router.replace('/(tabs)/messages');
      }
    } catch (error: any) {
      Alert.alert('Failed to report', error?.message || 'Please try again.');
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleAcceptRequest = async () => {
    if (!normalizedLikeId || requestActionSubmitting) return;
    setRequestActionSubmitting('accept');
    try {
      await acceptLike(normalizedLikeId);
      routeToRequests();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to accept request.');
    } finally {
      setRequestActionSubmitting(null);
    }
  };

  const handleDeclineRequest = async () => {
    if (!normalizedLikeId || requestActionSubmitting) return;
    setRequestActionSubmitting('decline');
    try {
      await declineLike(normalizedLikeId);
      setDeclineConfirmVisible(false);
      routeToRequests();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to decline request.');
    } finally {
      setRequestActionSubmitting(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  if (!profile) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerIconButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </Pressable>
        <Text numberOfLines={1} style={styles.headerTitle}>{displayName}</Text>
        {showManageMenu ? (
          <Pressable onPress={() => setMenuVisible(true)} style={styles.headerIconButton}>
            <Ionicons name="ellipsis-vertical" size={24} color={COLORS.textPrimary} />
          </Pressable>
        ) : (
          <View style={styles.headerIconButton} />
        )}
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: requestBottomPadding }]}>
        <NeoCard style={styles.profileCard}>
          <View style={styles.imageSection}>
            <View style={styles.imageContainer}>
              {profile.profilePicture ? (
                <Image source={{ uri: profile.profilePicture }} style={styles.profileImage} contentFit="cover" />
              ) : (
                <View style={[styles.profileImage, styles.noPhotoPlaceholder]}>
                  <Ionicons name="person" size={80} color={COLORS.border} />
                </View>
              )}
            </View>
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.profileName}>
              {profile.name}
              {profile.age != null ? ` | ${profile.age}` : ''}
            </Text>
            {profile.bio ? <Text style={styles.bioText}>{profile.bio}</Text> : null}
            {profile.githubUsername ? (
              <Pressable
                style={styles.githubLinkContainer}
                onPress={() => Linking.openURL(`https://github.com/${profile.githubUsername}`)}
              >
                <Ionicons name="logo-github" size={18} color={COLORS.primary} />
                <Text style={styles.githubLinkText}>github.com/{profile.githubUsername}</Text>
                <Ionicons name="open-outline" size={14} color={COLORS.primary} />
              </Pressable>
            ) : null}
          </View>

          {profile.skills.length > 0 ? (
            <View style={styles.sectionPadding}>
              <Text style={styles.sectionTitle}>Skills</Text>
              <ChipContainer>
                {profile.skills.map((item, idx) => (
                  <NeoChip key={`${item}-${idx}`} label={item} variant="skill" />
                ))}
              </ChipContainer>
            </View>
          ) : null}

          {(profile.interests ?? []).length > 0 ? (
            <View style={styles.sectionPadding}>
              <Text style={styles.sectionTitle}>Interests</Text>
              <ChipContainer>
                {(profile.interests ?? []).map((item, idx) => (
                  <NeoChip key={`${item}-${idx}`} label={item} variant="looking" />
                ))}
              </ChipContainer>
            </View>
          ) : null}

          {profile.experiences.length > 0 ? (
            <View style={styles.sectionPadding}>
              <Text style={styles.sectionTitle}>Experience</Text>
              {profile.experiences.slice(0, 5).map((experience, index) => (
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
          ) : null}

          {profile.projects.length > 0 ? (
            <View style={styles.sectionPadding}>
              <Text style={styles.sectionTitle}>Projects</Text>
              {profile.projects.slice(0, 5).map((project, index) => (
                <View key={project.id ?? `project-${index}`} style={styles.portfolioItem}>
                  <Text style={styles.portfolioTitle}>{project.name}</Text>
                  <Text style={styles.portfolioDescription}>{project.description}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {(profile.city || profile.country) ? (
            <View style={styles.sectionPadding}>
              <Text style={styles.sectionTitle}>Location</Text>
              <Text style={styles.profileLocation}>
                {[profile.city, profile.country].filter(Boolean).join(', ')}
              </Text>
            </View>
          ) : null}
        </NeoCard>
      </ScrollView>

      <Modal visible={menuVisible && showManageMenu} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuSheet}>
            {normalizedMatchId ? (
              <Pressable style={styles.menuItem} onPress={handleUnmatch}>
                <Text style={styles.menuDangerText}>Unmatch</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.menuItem} onPress={handleBlock}>
              <Text style={styles.menuDangerText}>Block</Text>
            </Pressable>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                setReportModalVisible(true);
              }}
            >
              <Text style={styles.menuText}>Report</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={reportModalVisible} transparent animationType="slide" onRequestClose={() => setReportModalVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setReportModalVisible(false)}>
          <Pressable style={styles.reportSheet} onPress={() => {}}>
            <Text style={styles.reportTitle}>Report user</Text>
            <TextInput
              style={styles.reportInput}
              value={reportReason}
              onChangeText={setReportReason}
              maxLength={REPORT_REASON_MAX_LENGTH}
              multiline
              textAlignVertical="top"
              placeholder="Tell us what happened..."
              placeholderTextColor={COLORS.textLight}
            />
            <View style={styles.reportActions}>
              <Pressable style={[styles.reportButton, styles.reportCancel]} onPress={() => setReportModalVisible(false)}>
                <Text style={styles.reportCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.reportButton, styles.reportSubmit, submittingReport && styles.reportSubmitDisabled]}
                onPress={submitReport}
                disabled={submittingReport}
              >
                <Text style={styles.reportSubmitText}>{submittingReport ? 'Sending...' : 'Submit'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      {isRequestMode ? (
        <View style={[styles.requestActionContainer, { paddingBottom: bottom + 12 }]}>
          <View style={styles.requestMessageBox}>
            <Text style={styles.requestMessageLabel}>They said:</Text>
            <Text numberOfLines={3} style={styles.requestMessageText}>
              {requestIntroMessage ? `"${requestIntroMessage}"` : 'No intro message'}
            </Text>
          </View>
          <View style={styles.requestActions}>
            <Pressable
              style={[styles.requestActionButton, styles.requestDeclineButton]}
              onPress={() => setDeclineConfirmVisible(true)}
              disabled={Boolean(requestActionSubmitting)}
            >
              <Text style={styles.requestDeclineText}>Decline</Text>
            </Pressable>
            <Pressable
              style={[styles.requestActionButton, styles.requestAcceptButton, requestActionSubmitting && styles.requestActionButtonDisabled]}
              onPress={handleAcceptRequest}
              disabled={Boolean(requestActionSubmitting)}
            >
              <Text style={styles.requestAcceptText}>
                {requestActionSubmitting === 'accept' ? 'Accepting...' : 'Accept'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      <Modal visible={!!confirmAction} transparent animationType="fade" onRequestClose={() => setConfirmAction(null)}>
        <Pressable style={styles.overlay} onPress={() => {
          if (confirmingAction) return;
          setConfirmAction(null);
        }}>
          <View style={styles.confirmSheet}>
            <Text style={styles.confirmTitle}>
              {confirmAction === 'unmatch' ? 'Unmatch' : 'Block user'}
            </Text>
            <Text style={styles.confirmBody}>
              {confirmAction === 'unmatch'
                ? 'Are you sure you want to unmatch this person?'
                : 'Are you sure you want to block this user?'}
            </Text>
            <View style={styles.reportActions}>
              <Pressable
                style={[styles.reportButton, styles.reportCancel]}
                onPress={() => setConfirmAction(null)}
                disabled={confirmingAction}
              >
                <Text style={styles.reportCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.reportButton, styles.reportSubmit, confirmingAction && styles.reportSubmitDisabled]}
                onPress={runConfirmAction}
                disabled={confirmingAction}
              >
                <Text style={styles.reportSubmitText}>
                  {confirmingAction
                    ? 'Please wait...'
                    : confirmAction === 'unmatch'
                      ? 'Unmatch'
                      : 'Block'}
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
      <Modal
        visible={declineConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!requestActionSubmitting) {
            setDeclineConfirmVisible(false);
          }
        }}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => {
            if (!requestActionSubmitting) {
              setDeclineConfirmVisible(false);
            }
          }}
        >
          <View style={styles.confirmSheet}>
            <Text style={styles.confirmTitle}>Decline request</Text>
            <Text style={styles.confirmBody}>This will remove their request.</Text>
            <View style={styles.reportActions}>
              <Pressable
                style={[styles.reportButton, styles.reportCancel]}
                onPress={() => setDeclineConfirmVisible(false)}
                disabled={Boolean(requestActionSubmitting)}
              >
                <Text style={styles.reportCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.reportButton, styles.reportSubmit, requestActionSubmitting && styles.reportSubmitDisabled]}
                onPress={handleDeclineRequest}
                disabled={Boolean(requestActionSubmitting)}
              >
                <Text style={styles.reportSubmitText}>
                  {requestActionSubmitting === 'decline' ? 'Declining...' : 'Decline'}
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 12,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: BORDERS.thin,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.background,
  },
  headerIconButton: {
    width: 36,
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginHorizontal: 8,
  },
  scrollContent: {
    padding: 16,
  },
  profileCard: {
    overflow: 'visible',
  },
  imageSection: {
    paddingHorizontal: 12,
    paddingTop: 12,
  },
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
  },
  noPhotoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoSection: {
    padding: 16,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  bioText: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  sectionPadding: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 10,
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
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  portfolioTimeline: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  profileLocation: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  githubLinkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 10,
    borderWidth: BORDERS.thin,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.small,
    backgroundColor: COLORS.surface,
  },
  githubLinkText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    padding: 20,
  },
  menuSheet: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDERS.medium,
    borderColor: COLORS.border,
    borderRadius: RADIUS.medium,
    overflow: 'hidden',
  },
  menuItem: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderBottomWidth: BORDERS.thin,
    borderBottomColor: COLORS.border,
  },
  menuText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  menuDangerText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.danger,
  },
  reportSheet: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDERS.medium,
    borderColor: COLORS.border,
    borderRadius: RADIUS.medium,
    padding: 16,
    width: '92%',
    maxWidth: 420,
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  reportInput: {
    borderWidth: BORDERS.thin,
    borderColor: COLORS.border,
    borderRadius: RADIUS.small,
    minHeight: 180,
    padding: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.background,
  },
  confirmSheet: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDERS.medium,
    borderColor: COLORS.border,
    borderRadius: RADIUS.medium,
    padding: 18,
    width: '92%',
    maxWidth: 420,
  },
  confirmTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  confirmBody: {
    fontSize: 18,
    lineHeight: 26,
    color: COLORS.textSecondary,
    fontWeight: '500',
    marginBottom: 16,
  },
  reportActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 10,
  },
  reportButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: RADIUS.small,
    borderWidth: BORDERS.thin,
    borderColor: COLORS.border,
  },
  reportCancel: {
    backgroundColor: COLORS.surface,
  },
  reportSubmit: {
    backgroundColor: COLORS.primary,
  },
  reportSubmitDisabled: {
    opacity: 0.6,
  },
  reportCancelText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  reportSubmitText: {
    color: COLORS.surface,
    fontWeight: '700',
  },
  requestActionContainer: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 0,
    backgroundColor: COLORS.surface,
    borderWidth: BORDERS.thin,
    borderColor: COLORS.border,
    borderRadius: RADIUS.medium,
    paddingHorizontal: 12,
    paddingTop: 12,
    ...SHADOWS.medium,
  },
  requestMessageBox: {
    borderWidth: BORDERS.thin,
    borderColor: COLORS.border,
    borderRadius: RADIUS.small,
    backgroundColor: COLORS.background,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  requestMessageLabel: {
    textTransform: 'uppercase',
    color: COLORS.textMuted,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 4,
    fontSize: 12,
  },
  requestMessageText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  requestActionButton: {
    flex: 1,
    borderWidth: BORDERS.thin,
    borderColor: COLORS.border,
    borderRadius: RADIUS.large,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestDeclineButton: {
    backgroundColor: COLORS.surface,
  },
  requestAcceptButton: {
    backgroundColor: COLORS.primary,
  },
  requestActionButtonDisabled: {
    opacity: 0.7,
  },
  requestDeclineText: {
    color: COLORS.textPrimary,
    fontWeight: '800',
    fontSize: 18,
  },
  requestAcceptText: {
    color: COLORS.surface,
    fontWeight: '800',
    fontSize: 18,
  },
});
