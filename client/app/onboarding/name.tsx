import { useEffect, useState } from "react";
import { TextInput, Text, View, StyleSheet, LayoutAnimation, Platform, UIManager } from "react-native";
import { router } from "expo-router";
import { OnboardingScaffold } from "../../src/components/OnboardingScaffold";
import { AnimatedCTA } from "../../src/components/AnimatedCTA";
import { useOnboardingForm } from "../../src/hooks/useOnboardingForm";
import { useAuth } from "../../src/auth/AuthProvider";
import { updateProfile } from "../../src/services/profileService";
import { supabase } from "../../src/auth/supabaseClient";
import { COLORS, BORDERS, RADIUS, SHADOWS } from "../../src/theme/colors";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function OnboardingName() {
  const { data, update } = useOnboardingForm();
  const { user, profile, setProfileLocally } = useAuth();
  const [fullName, setFullName] = useState(data.fullName ?? profile?.name ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      router.replace("/login");
    }
    if (profile?.onboardingCompleted) {
      router.replace("/(tabs)");
    }
  }, [user, profile]);

  const validate = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "Name is required";
    if (trimmed.length < 2 || trimmed.length > 40) return "Use 2-40 characters";
    return null;
  };

  const onContinue = () => {
    const validation = validate(fullName);
    if (validation) {
      setError(validation);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      return;
    }

    const trimmed = fullName.trim();
    update({ fullName: trimmed });

    if (user) {
      updateProfile(user.authId, {
        name: trimmed,
        onboardingCompleted: false,
      })
        .then((next) => setProfileLocally(next))
        .catch((err) => console.warn("Partial save failed", err?.message));
    }

    router.push("/onboarding/birthdate");
  };

  return (
    <OnboardingScaffold
      step={1}
      title="Let’s start with your name"
      subtitle="Tell people what to call you"
      onBack={async () => {
        // User wants to cancel onboarding/sign-up and go back to the previous screen.
        // Sign out the Supabase session, then navigate back in the stack so the
        // animation direction correctly reflects a "back" action (left-to-right).
        try {
          await supabase.auth.signOut();
        } catch (err) {
          console.warn("Failed to sign out during onboarding back navigation:", err);
        }

        // Prefer a stack back navigation for proper back animation.
        // In typical flows this returns to the welcome screen.
        router.back();
      }}
    >
      <View style={styles.formSection}>
        <Text style={styles.label}>Full name</Text>
        <TextInput
          value={fullName}
          onChangeText={(text) => {
            setFullName(text);
            if (error) setError(null);
          }}
          placeholder="Type your name"
          placeholderTextColor={COLORS.textLight}
          style={styles.input}
          returnKeyType="next"
          autoCapitalize="words"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={{ marginTop: "auto", marginBottom: 12 }}>
        <AnimatedCTA
          label="Continue"
          onPress={onContinue}
          disabled={!!validate(fullName)}
        />
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  formSection: {
    gap: 8,
    marginTop: 32,
  },
  label: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
  input: {
    borderWidth: BORDERS.medium,
    borderColor: COLORS.border,
    borderRadius: RADIUS.large,
    padding: 14,
    fontSize: 16,
    fontWeight: "600",
    backgroundColor: COLORS.surface,
    color: COLORS.textPrimary,
    ...SHADOWS.small,
  },
  error: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
});
