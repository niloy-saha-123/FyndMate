/**
 * @file client/src/components/ProfileModal.tsx
 * @description Modal component to display user profile details in chat
 */

import { View, Text, ScrollView, Modal, TouchableOpacity, StyleSheet, Image, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SHADOWS, BORDERS, RADIUS } from "../theme/colors";
import { NeoChip, ChipContainer } from "./NeoChip";

interface ProfileModalProps {
  visible: boolean;
  onClose: () => void;
  profile: {
    id: string;
    name: string;
    profilePicture: string | null;
    bio: string | null;
    skills: string[];
    interests: string[];
    experience: string | null;
    commitment: string | null;
    age: number | null;
    gender: string | null;
    city: string | null;
    country: string | null;
    githubUsername: string | null;
    lookingFor: string[];
  };
}

export function ProfileModal({ visible, onClose, profile }: ProfileModalProps) {
  const displayName = profile.name;
  const displayAgeGender = [profile.age, profile.gender].filter(Boolean).join(' · ');
  const displayLocation = [profile.city, profile.country].filter(Boolean).join(', ');

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity 
          activeOpacity={1} 
          style={styles.modalContent}
        >
          {/* Modal Handle */}
          <View style={styles.modalHandle} />

          <ScrollView 
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
          >
            {/* Profile Image */}
            <View style={styles.imageContainer}>
              {profile.profilePicture ? (
                <Image
                  source={{ uri: profile.profilePicture }}
                  style={styles.profileImage}
                />
              ) : (
                <View style={[styles.profileImage, styles.noPhotoPlaceholder]}>
                  <Ionicons name="person" size={80} color={COLORS.border} />
                </View>
              )}
              <View style={styles.imageGeoCircle} />
            </View>

            {/* Basic Info */}
            <View style={styles.infoSection}>
              <Text style={styles.profileName}>
                {displayName}
                {displayAgeGender ? ` | ${displayAgeGender}` : ''}
              </Text>
            </View>

            {/* Bio */}
            <View style={styles.sectionPadding}>
              <Text style={styles.bioText}>
                {profile.bio || 'No bio available'}
              </Text>

              {/* Meta tags */}
              <ChipContainer style={{ marginTop: 12 }}>
                {profile.experience && (
                  <NeoChip label={`${profile.experience} experience`} variant="meta" />
                )}
                {profile.commitment && (
                  <NeoChip label={profile.commitment} variant="meta" />
                )}
              </ChipContainer>

              {/* GitHub Link */}
              {profile.githubUsername && (
                <TouchableOpacity
                  style={styles.githubLinkContainer}
                  onPress={() => Linking.openURL(`https://github.com/${profile.githubUsername}`)}
                >
                  <Ionicons name="logo-github" size={18} color={COLORS.primary} />
                  <Text style={styles.githubLinkText}>github.com/{profile.githubUsername}</Text>
                  <Ionicons name="open-outline" size={14} color={COLORS.primary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Looking For */}
            {(profile.lookingFor.length > 0) && (
              <View style={styles.sectionPadding}>
                <View style={styles.sectionHeader}>
                  <View style={styles.geoCircleSmall} />
                  <Text style={styles.sectionTitle}>Looking for</Text>
                </View>
                <ChipContainer>
                  {profile.lookingFor.map((item: string, idx: number) => (
                    <NeoChip key={idx} label={item} variant="looking" />
                  ))}
                </ChipContainer>
              </View>
            )}

            {/* Skills */}
            {profile.skills && profile.skills.length > 0 && (
              <View style={styles.sectionPadding}>
                <View style={styles.sectionHeader}>
                  <View style={styles.diamondIcon} />
                  <Text style={styles.sectionTitle}>Skills</Text>
                </View>
                <ChipContainer>
                  {profile.skills.slice(0, 8).map((skill: string, idx: number) => (
                    <NeoChip key={idx} label={skill} variant="skill" />
                  ))}
                  {profile.skills.length > 8 && (
                    <Text style={styles.moreSkills}>
                      +{profile.skills.length - 8} more
                    </Text>
                  )}
                </ChipContainer>
              </View>
            )}

            {/* Location */}
            {displayLocation && (
              <View style={styles.sectionPadding}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="location-outline" size={16} color={COLORS.primary} style={{ marginRight: 8 }} />
                  <Text style={styles.sectionTitle}>Location</Text>
                </View>
                <Text style={styles.profileLocation}>
                  {displayLocation}
                </Text>
              </View>
            )}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '85%',
    minHeight: '50%',
  },
  modalHandle: {
    width: 48,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.textPrimary,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  scrollView: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  // Profile Image
  imageContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profileImage: {
    width: 120,
    height: 160,
    borderRadius: 20,
    borderWidth: BORDERS.medium,
    borderColor: COLORS.border,
    ...SHADOWS.large,
  },
  noPhotoPlaceholder: {
    backgroundColor: COLORS.gray200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageGeoCircle: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  // Info Section
  infoSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
    lineHeight: 32,
  },
  // Sections
  sectionPadding: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  bioText: {
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.textPrimary,
  },
  moreSkills: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginTop: 8,
  },
  profileLocation: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  // Chips
  geoCircleSmall: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
    marginRight: 10,
  },
  diamondIcon: {
    width: 12,
    height: 12,
    backgroundColor: COLORS.skillBg,
    transform: [{ rotate: '45deg' }],
    marginRight: 10,
  },
  // GitHub Link
  githubLinkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 12,
    backgroundColor: COLORS.gray100,
    borderRadius: RADIUS.medium,
    borderWidth: BORDERS.thin,
    borderColor: COLORS.border,
  },
  githubLinkText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
});