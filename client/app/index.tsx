import { Redirect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { LoadingGate } from "../src/components/LoadingGate";
import { useAuth } from "../src/auth/AuthProvider";
import { BORDERS, COLORS, RADIUS, SHADOWS } from "../src/theme/colors";
import { AuthLegalNote } from "../src/components/AuthLegalNote";

export default function Welcome() {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const compactLayout = height < 700;
  const { user, loading, profile, profileLoading } = useAuth();

  if (loading || profileLoading) {
    return <LoadingGate message="Checking your account" />;
  }

  if (user && profile) {
    const destination = profile.onboardingCompleted
      ? "/(tabs)"
      : !profile.name
      ? "/onboarding/name"
      : !profile.birthDate
      ? "/onboarding/birthdate"
      : "/onboarding/gender";
    return <Redirect href={destination} />;
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
        <View style={[styles.container, compactLayout && styles.containerCompact]}>
          <View style={styles.heroSection}>
            <View style={styles.brandLockup}>
              <Image source={require("../assets/icons/wordmark.png")} style={styles.wordmark} />
            </View>

            <Text style={[styles.tagline, compactLayout && styles.taglineCompact]}>
              Find the right team for your next goals
            </Text>
          </View>

        <View style={styles.footerSection}>
          <TouchableOpacity
            onPress={() => router.push("/login")}
            activeOpacity={0.92}
            accessibilityRole="button"
            accessibilityLabel="Get started"
            style={[styles.ctaOuter, SHADOWS.medium]}
          >
            <LinearGradient
              colors={[COLORS.primary, COLORS.primaryGradient]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaInner}
            >
              <Text style={styles.ctaText}>Get Started</Text>
            </LinearGradient>
          </TouchableOpacity>

          <AuthLegalNote />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 28,
    justifyContent: "space-between",
  },
  containerCompact: {
    paddingTop: 16,
    paddingBottom: 20,
  },
  heroSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    marginTop: 40,
  },
  brandLockup: {
    alignItems: "center",
    marginBottom: 0,
  },
  wordmark: {
    width: "86%",
    maxWidth: 288,
    aspectRatio: 3,
    resizeMode: "contain",
  },
  tagline: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "700",
    color: COLORS.skillText,
    textAlign: "center",
    letterSpacing: -0.2,
    maxWidth: 300,
    marginTop: -10,
  },
  taglineCompact: {
    fontSize: 20,
    lineHeight: 28,
  },
  footerSection: {
    marginTop: 12,
  },
  ctaOuter: {
    borderWidth: BORDERS.medium,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    overflow: "hidden",
  },
  ctaInner: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  ctaText: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "800",
    color: COLORS.surface,
  },
});
