import { useEffect, useMemo, useState } from "react";
import { Text, View, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { OnboardingScaffold } from "../../src/components/OnboardingScaffold";
import { AnimatedCTA } from "../../src/components/AnimatedCTA";
import { useOnboardingForm } from "../../src/hooks/useOnboardingForm";
import { updateProfile } from "../../src/services/profileService";
import { useAuth } from "../../src/auth/AuthProvider";
import { COLORS } from "../../src/theme/colors";

const options = [
  "Female",
  "Male",
  "Non-binary",
  "Prefer not to say",
];

export default function OnboardingGender() {
  const { data, update } = useOnboardingForm();
  const { user, refreshProfile, setProfileLocally, profile } = useAuth();
  const [selected, setSelected] = useState<string | null>(data.gender ?? null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) {
      router.replace("/login");
    }
    if (profile?.onboardingCompleted) {
      router.replace("/(tabs)");
    }
  }, [user, profile]);

  const readyToSubmit = useMemo(() => {
    const hasName = data.fullName?.trim().length >= 2 && data.fullName?.trim().length <= 40;
    const hasBirthdate = Boolean(data.birthDate);
    const hasGender = Boolean(selected);
    return hasName && hasBirthdate && hasGender;
  }, [data.fullName, data.birthDate, selected]);

  const onFinish = async () => {
    if (!user) {
      router.replace("/login");
      return;
    }

    if (!readyToSubmit) {
      setError("Please complete all fields before continuing.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const nextProfile = await updateProfile(user.authId, {
        name: data.fullName.trim(),
        birthDate: data.birthDate,
        gender: selected,
        onboardingCompleted: true,
      });

      // Keep context in sync immediately
      setProfileLocally(nextProfile);
      await refreshProfile();
      router.replace("/(tabs)");
    } catch (err: any) {
      setError(err?.message ?? "Could not save your profile. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <OnboardingScaffold
      step={3}
      title="Choose your gender"
      subtitle="Pick the option that fits you"
      onBack={() => router.back()}
    >
      <View style={styles.optionsGrid}>
        {options.map((option) => {
          const isActive = selected === option;
          return (
            <TouchableOpacity
              key={option}
              activeOpacity={0.9}
              style={[styles.optionCard, isActive && styles.optionActive]}
              onPress={() => {
                setSelected(option);
                update({ gender: option });
                setError(null);
              }}
            >
              <Text style={[styles.optionText, isActive && styles.optionTextActive]}>
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={{ marginTop: "auto", marginBottom: 12 }}>
        <AnimatedCTA
          label={submitting ? "Saving..." : "Finish"}
          onPress={onFinish}
          disabled={!readyToSubmit || submitting}
        />
        {submitting ? (
          <View style={styles.loaderRow}>
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: 12 }} />
            <Text style={styles.loaderText}>Setting up your account...</Text>
          </View>
        ) : null}
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  optionCard: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    flexBasis: "47%",
  },
  optionActive: {
    borderColor: COLORS.textPrimary,
    backgroundColor: COLORS.gray100,
  },
  optionText: {
    color: COLORS.textPrimary,
    fontWeight: "600",
  },
  optionTextActive: {
    color: COLORS.textPrimary,
  },
  error: {
    marginTop: 8,
    color: COLORS.danger,
    fontSize: 13,
  },
  loaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loaderText: {
    marginTop: 10,
    color: COLORS.textSecondary,
  },
});
