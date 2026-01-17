import { useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../src/auth/AuthProvider";
import { LoadingGate } from "../src/components/LoadingGate";
import { UserProfile } from "../src/services/profileService";

export default function AppGate() {
  const {
    user,
    loading,
    profile,
    profileLoading,
    profileError,
    refreshProfile,
  } = useAuth();

  useEffect(() => {
    if (loading || profileLoading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (profile) {
      const destination = resolveDestination(profile);
      router.replace(destination);
    }
  }, [loading, profileLoading, user, profile]);

  if (profileError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>We could not fetch your profile.</Text>
        <Text style={styles.errorBody}>{profileError}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refreshProfile}>
          <Text style={styles.retryLabel}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <LoadingGate
      message={user ? "Fetching your profile" : "Checking session"}
      subtext="Sit tight while we decide where to take you."
    />
  );
}

function resolveDestination(profile: UserProfile) {
  if (!profile.fullName || profile.fullName.trim().length < 2) {
    return "/onboarding/name";
  }

  if (!profile.birthDate) {
    return "/onboarding/birthdate";
  }

  if (!profile.gender) {
    return "/onboarding/gender";
  }

  return profile.onboardingCompleted ? "/(tabs)" : "/onboarding/gender";
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#FFF7ED",
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#9A3412",
    marginBottom: 8,
    textAlign: "center",
  },
  errorBody: {
    fontSize: 14,
    color: "#9A3412",
    marginBottom: 16,
    textAlign: "center",
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: "#6058AE",
  },
  retryLabel: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 14,
  },
});
