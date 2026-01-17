import { useEffect, useState } from "react";
import { TextInput, Text, View, StyleSheet, LayoutAnimation, Platform, UIManager } from "react-native";
import { router } from "expo-router";
import LottieView from "lottie-react-native";
import { OnboardingScaffold } from "../../src/components/OnboardingScaffold";
import { AnimatedCTA } from "../../src/components/AnimatedCTA";
import { useOnboardingForm } from "../../src/hooks/useOnboardingForm";
import { useAuth } from "../../src/auth/AuthProvider";
import { updateProfile } from "../../src/services/profileService";

const PRIMARY = "#6058AE";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function OnboardingName() {
  const { data, update } = useOnboardingForm();
  const { user, profile, setProfileLocally } = useAuth();
  const [fullName, setFullName] = useState(data.fullName ?? "");
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
        fullName: trimmed,
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
    >
      <View style={styles.animationContainer}>
        <LottieView
          source={require("../../assets/animation.json")}
          autoPlay
          loop
          style={styles.animation}
        />
      </View>

      <View style={styles.formSection}>
        <Text style={styles.label}>Full name</Text>
        <TextInput
          value={fullName}
          onChangeText={(text) => {
            setFullName(text);
            if (error) setError(null);
          }}
          placeholder="Type your name"
          placeholderTextColor="#9CA3AF"
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
  animationContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  animation: {
    height: 140,
    width: 140,
  },
  formSection: {
    gap: 8,
    marginTop: 4,
  },
  label: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    backgroundColor: "#FFF",
    color: "#111827",
  },
  error: {
    color: "#DC2626",
    fontSize: 13,
    marginTop: 4,
  },
});
