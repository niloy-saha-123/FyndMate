import { useState } from "react";
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { signIn, signUp } from "../src/auth/emailAuth";
import { signInWithGoogle } from "../src/auth/googleOAuth";
import { Redirect, router } from "expo-router";
import { useAuth } from "../src/auth/AuthProvider";
import { LoadingGate } from "../src/components/LoadingGate";

import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import LottieView from "lottie-react-native";

export default function Login() {
  const router = useRouter();
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(true);
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

  // Main sign up options screen
  if (!showEmailForm) {
    return (
      <View style={styles.bgWrapper}>
        <View style={styles.mobileFrame}>
          {/* Decorative Triangles */}
          <View style={[styles.triangle, styles.trianglePurple]} />
          <View style={[styles.triangle, styles.trianglePink]} />
          <View style={[styles.geoCircle, styles.geoCircle1]} />
          <View style={[styles.geoCircle, styles.geoCircle2]} />

          {/* Header with Back Button (hidden on first login) */}
          <View style={styles.headerRow} />

          {/* Main Content */}
          <View style={styles.flex1Center}>
            {/* Logo Small */}
            <View style={styles.logoRow}>
              <Image source={require("../assets/icons/icon.png")} style={styles.logoSmall} />
              <Image source={require("../assets/icons/wordmark.png")} style={styles.wordmarkSmall} />
            </View>
            {/* Welcome Text */}
            <Text style={styles.loginTitle}>Welcome Back!</Text>
            <Text style={styles.loginSubtitle}>Sign in to find your collaborators</Text>

            {/* Social Login Buttons */}
            <TouchableOpacity style={styles.socialBtn} onPress={signInWithGoogle}>
              {/* Google SVG icon replacement */}
              <Text style={styles.socialBtnText}>Continue with Google</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialBtn}>
              {/* GitHub SVG icon replacement */}
              <Text style={styles.socialBtnText}>Continue with GitHub</Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Email Login Form Button */}
            <TouchableOpacity style={styles.neoBtnPrimary} onPress={() => setShowEmailForm(true)}>
              <Text style={styles.neoBtnText}>Continue with Email</Text>
            </TouchableOpacity>

            {/* Sign Up Link */}
            <View style={styles.signupRow}>
              <Text style={styles.signupText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => setIsSignUp(true) || setShowEmailForm(true)}>
                <Text style={styles.signupLink}>Sign up</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Bottom Pattern */}
          <View style={styles.hatchedBg} />
        </View>
      </View>
    );
  }

  // Email form screen
  return (
    <View style={styles.bgWrapper}>
      <View style={styles.mobileFrame}>
        {/* Decorative Triangles */}
        <View style={[styles.triangle, styles.trianglePurple]} />
        <View style={[styles.triangle, styles.trianglePink]} />
        <View style={[styles.geoCircle, styles.geoCircle1]} />
        <View style={[styles.geoCircle, styles.geoCircle2]} />

        {/* Header with Back Button */}
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => setShowEmailForm(false)}>
            <Text style={styles.backIcon}>{'<'}</Text>
          </TouchableOpacity>
        </View>

        {/* Main Content */}
        <View style={styles.flex1Center}>
          <Text style={styles.formTitle}>{isSignUp ? 'Create Account' : 'Welcome Back'}</Text>
          <Text style={styles.loginSubtitle}>{isSignUp ? 'Create your account to get started' : 'Sign in to continue'}</Text>

          {/* Email Input */}
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

          {/* Name Input (Sign Up) */}
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

          {/* Password Input */}
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

          {/* Forgot Password */}
          {!isSignUp && (
            <TouchableOpacity style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>
          )}

          {/* Login/Signup Button */}
          <TouchableOpacity
            style={styles.neoBtnPrimary}
            onPress={handleAuth}
            disabled={!email || !password || (isSignUp && !name)}
          >
            <Text style={styles.neoBtnText}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>
          </TouchableOpacity>

          {/* Toggle Sign In/Up */}
          <View style={styles.signupRow}>
            <Text style={styles.signupText}>{isSignUp ? 'Already have an account? ' : "Don't have an account? "}</Text>
            <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
              <Text style={styles.signupLink}>{isSignUp ? 'Sign In' : 'Sign Up'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Pattern */}
        <View style={styles.hatchedBg} />
      </View>
    </View>
  );
}

const { width, height } = Dimensions.get("window");
const styles = StyleSheet.create({
  bgWrapper: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileFrame: {
    width: 390,
    height: 844,
    backgroundColor: '#FAFAFA',
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#000',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 20, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 0,
    elevation: 10,
    position: 'relative',
  },
  triangle: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderStyle: 'solid',
    zIndex: 10,
  },
  trianglePurple: {
    top: 24,
    right: 16,
    borderLeftWidth: 25,
    borderLeftColor: 'transparent',
    borderRightWidth: 25,
    borderRightColor: 'transparent',
    borderBottomWidth: 45,
    borderBottomColor: '#8B5CF6',
    transform: [{ rotate: '12deg' }],
  },
  trianglePink: {
    top: 96,
    left: 16,
    borderLeftWidth: 20,
    borderLeftColor: 'transparent',
    borderRightWidth: 20,
    borderRightColor: 'transparent',
    borderTopWidth: 35,
    borderTopColor: '#EC4899',
    transform: [{ rotate: '-12deg' }],
  },
  geoCircle: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#8B5CF6',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  geoCircle1: { top: 64, right: 80, width: 12, height: 12, backgroundColor: '#6366F1' },
  geoCircle2: { top: 128, right: 32, width: 16, height: 16, backgroundColor: '#F472B6' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 48,
    minHeight: 60,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  backIcon: {
    fontSize: 22,
    color: '#374151',
    fontWeight: 'bold',
  },
  flex1Center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 0,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  logoSmall: {
    width: 48,
    height: 48,
    resizeMode: 'contain',
  },
  wordmarkSmall: {
    height: 40,
    width: 120,
    resizeMode: 'contain',
    marginLeft: 8,
  },
  loginTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#000',
    marginBottom: 8,
    textAlign: 'center',
  },
  loginSubtitle: {
    color: '#6B7280',
    fontWeight: '500',
    fontSize: 15,
    marginBottom: 24,
    textAlign: 'center',
  },
  socialBtn: {
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#000',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
    width: '100%',
  },
  socialBtnText: {
    fontWeight: 'bold',
    fontSize: 15,
    color: '#000',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 18,
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 3,
    backgroundColor: '#000',
  },
  dividerText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6B7280',
    textTransform: 'uppercase',
    marginHorizontal: 8,
  },
  neoBtnPrimary: {
    backgroundColor: '#8B5CF6',
    borderWidth: 3,
    borderColor: '#000',
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
    width: '100%',
  },
  neoBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
    marginBottom: 6,
  },
  input: {
    borderWidth: 3,
    borderColor: '#000',
    borderRadius: 16,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
  },
  errorText: {
    marginTop: 4,
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '500',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 12,
    marginTop: -8,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#6058AE',
    fontWeight: '600',
  },
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  signupText: {
    fontSize: 14,
    color: '#6B7280',
  },
  signupLink: {
    fontSize: 14,
    color: '#5B21B6',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  hatchedBg: {
    height: 16,
    backgroundColor: '#F9A8D4',
    borderTopWidth: 3,
    borderColor: '#000',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});