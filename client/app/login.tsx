import { useState } from "react";
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Platform,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, Redirect } from "expo-router";
import { signIn, signUp } from "../src/auth/emailAuth";
import { signInWithGoogle } from "../src/auth/googleOAuth";
import { useAuth } from "../src/auth/AuthProvider";
import { LoadingGate } from "../src/components/LoadingGate";
import { COLORS } from "../src/theme/colors";
import { AuthLegalNote } from "../src/components/AuthLegalNote";

const googleIconImage = Platform.select({
  ios: require("../assets/login/google_icon_ios.png"),
  android: require("../assets/login/google_icon_android.png"),
  default: require("../assets/login/google_icon_web.png"),
});

export default function Login() {
  const router = useRouter();
  // Restore old behavior: show social/email choice first, not email form directly
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false); // default to login, not sign up
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    name?: string;
  }>({});
  const { user, loading, profile, profileLoading } = useAuth();

  if (loading || profileLoading) {
    return <LoadingGate message="Checking your session" />;
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
  
  const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const validate = () => {
    const newErrors: typeof errors = {};

    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!isValidEmail(email)) {
      newErrors.email = "Enter a valid email address";
    }

    if (isSignUp && !name.trim()) {
      newErrors.name = "Full name is required";
    }

    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAuth = async() => {
    if (!validate()) return;

    try {
    if (isSignUp) {
      await signUp(email.trim(), password, name.trim());
    } 
    else {
      const { session, user } = await signIn(email.trim(), password);
      if (!session) {
        alert("Sign in failed. Did you confirm your email?");
        return;
      }
      console.log("Signed in user:", user);
      router.replace("/app-gate");
    }
    } 
    catch (e: any) {
      console.error("Auth error:", e.message);
    }
  };

  const authChoiceButtonHeight = 52;
  const googleLogoTileSize = Platform.OS === "ios" ? 44 : 40;
  const googlePadding =
    Platform.select({
      ios: { left: 16, iconGap: 12, right: 16 },
      default: { left: 12, iconGap: 10, right: 12 },
    }) ?? { left: 12, iconGap: 10, right: 12 };

  // Main sign-in/sign-up choice screen — clean layout matching Get Started
  if (!showEmailForm) {
    return (
      <View style={styles.screen}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.mainScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.container}>
            {/* Hero: monkey head only, centered, larger */}
            <View style={styles.heroSection}>
            <Image
              source={require("../assets/icons/icon.png")}
              style={styles.logoIcon}
              resizeMode="contain"
            />
            <Text style={styles.loginTitle}>Welcome Back!</Text>
            <Text style={styles.loginSubtitle}>Sign in to find your troupe</Text>
          </View>

          {/* Actions */}
          <View style={styles.actionsSection}>
            {Platform.OS === "ios" && (
              <TouchableOpacity
                style={styles.appleBtn}
                onPress={() =>
                  alert("Sign in with Apple is coming soon. Please use Google or Email for now.")
                }
                accessibilityRole="button"
                accessibilityLabel="Sign in with Apple (coming soon)"
              >
                <Text style={styles.appleBtnText}>Sign in with Apple (coming soon)</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.googleBtn, { height: authChoiceButtonHeight }]}
              onPress={signInWithGoogle}
              accessibilityRole="button"
              accessibilityLabel="Continue with Google"
            >
              <View
                style={[
                  styles.googleContent,
                  { paddingHorizontal: googlePadding.right },
                ]}
              >
                <Image
                  source={googleIconImage}
                  style={[
                    styles.googleIcon,
                    {
                      width: googleLogoTileSize,
                      height: googleLogoTileSize,
                      left: googlePadding.left,
                    },
                  ]}
                  resizeMode="contain"
                />
                <Text style={styles.googleText}>
                  Continue with Google
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.ctaOuter}
              onPress={() => {
                setIsSignUp(false);
                setShowEmailForm(true);
              }}
              activeOpacity={0.92}
            >
              <LinearGradient
                colors={[COLORS.primary, COLORS.primaryGradient]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.ctaInner, { minHeight: authChoiceButtonHeight }]}
              >
                <Text style={styles.ctaText}>Continue with Email</Text>
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.signupRow}>
              <Text style={styles.signupText}>Don&apos;t have an account? </Text>
              <TouchableOpacity
                onPress={() => {
                  setIsSignUp(true);
                  setShowEmailForm(true);
                }}
              >
                <Text style={styles.signupLink}>Sign up</Text>
              </TouchableOpacity>
            </View>

            <AuthLegalNote />
          </View>
        </View>
      </ScrollView>
      </View>
    );
  }

  // Email form screen (Create Account / Sign In) — clean, monkey head + social + form
  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.formScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.formContainer}>
          <View style={styles.formHeader}>
            <TouchableOpacity style={styles.backButton} onPress={() => setShowEmailForm(false)}>
              <Ionicons name="chevron-back" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.formHero}>
            <Image
              source={require("../assets/icons/icon.png")}
              style={styles.logoIconSmall}
              resizeMode="contain"
            />
            <Text style={styles.formTitle}>{isSignUp ? "Create Account" : "Welcome Back"}</Text>
            <Text style={styles.formSubtitle}>
              {isSignUp ? "Create your account to get started" : "Sign in to continue"}
            </Text>
          </View>

          <View style={styles.formFields}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setErrors((e) => ({ ...e, email: undefined }));
                }}
                placeholder="Enter your email"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
              />
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>

            {isSignUp && (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  value={name}
                  onChangeText={(text) => {
                    setName(text);
                    setErrors((e) => ({ ...e, name: undefined }));
                  }}
                  placeholder="Enter your full name"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="words"
                  style={styles.input}
                />
                {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setErrors((e) => ({ ...e, password: undefined }));
                }}
                placeholder="Enter your password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                autoCapitalize="none"
                style={styles.input}
              />
              {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
            </View>

            {!isSignUp && (
              <TouchableOpacity style={styles.forgotPassword}>
                <Text style={styles.forgotPasswordText}>Forgot password?</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.ctaOuter, (!email || !password || (isSignUp && !name)) && styles.ctaDisabled]}
              onPress={handleAuth}
              disabled={!email || !password || (isSignUp && !name)}
              activeOpacity={0.92}
            >
              <LinearGradient
                colors={[COLORS.primary, COLORS.primaryGradient]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ctaInner}
              >
                <Text style={styles.ctaText}>{isSignUp ? "Create Account" : "Sign In"}</Text>
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.signupRow}>
              <Text style={styles.signupText}>
                {isSignUp ? "Already have an account? " : "Don't have an account? "}
              </Text>
              <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
                <Text style={styles.signupLink}>{isSignUp ? "Sign In" : "Sign Up"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  mainScrollContent: {
    flexGrow: 1,
    paddingBottom: 28,
  },
  container: {
    flex: 1,
    minHeight: 400,
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 24,
    justifyContent: "space-between",
  },
  heroSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoIcon: {
    width: 112,
    height: 112,
    marginBottom: 16,
  },
  loginTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: "center",
  },
  loginSubtitle: {
    fontSize: 15,
    fontWeight: "500",
    color: COLORS.textMuted,
    textAlign: "center",
    paddingHorizontal: 16,
  },
  actionsSection: {
    width: "100%",
  },
  appleBtn: {
    backgroundColor: "#000",
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    width: "100%",
    minHeight: 48,
  },
  appleBtnText: {
    fontWeight: "600",
    fontSize: 16,
    color: "#FFFFFF",
  },
  googleBtn: {
    width: "100%",
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    backgroundColor: "#F2F2F2",
    borderRadius: 999,
  },
  googleContent: {
    width: "100%",
    height: "100%",
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  googleIcon: {
    width: 40,
    height: 40,
    position: "absolute",
  },
  googleText: {
    color: "#1F1F1F",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    textAlign: "center",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 16,
    width: "100%",
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.gray200,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textMuted,
    textTransform: "uppercase",
  },
  ctaOuter: {
    width: "100%",
    alignSelf: "stretch",
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 12,
  },
  ctaDisabled: {
    opacity: 0.6,
  },
  ctaInner: {
    minHeight: 52,
    paddingVertical: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  signupRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  signupText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  signupLink: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: "600",
  },
  legalLink: {
    color: COLORS.primary,
    textDecorationLine: "underline",
    fontWeight: "500",
  },
  // Form screen
  scrollView: {
    flex: 1,
  },
  formScrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  formContainer: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  formHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  formHero: {
    alignItems: "center",
    marginBottom: 24,
  },
  logoIconSmall: {
    width: 72,
    height: 72,
    marginBottom: 12,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginBottom: 6,
    textAlign: "center",
  },
  formSubtitle: {
    fontSize: 15,
    fontWeight: "500",
    color: COLORS.textMuted,
    textAlign: "center",
  },
  formFields: {
    width: "100%",
  },
  inputContainer: {
    width: "100%",
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: COLORS.gray200,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  errorText: {
    marginTop: 4,
    color: COLORS.danger,
    fontSize: 13,
  },
  forgotPassword: {
    alignSelf: "flex-end",
    marginBottom: 16,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: "600",
  },
});
