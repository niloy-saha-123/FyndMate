
import { useRouter, Redirect } from "expo-router";
import { useAuth } from "../src/auth/AuthProvider";
import { LoadingGate } from "../src/components/LoadingGate";
import { View, Text, TouchableOpacity, StyleSheet, Image, Dimensions } from "react-native";


export default function Welcome() {
  const router = useRouter();
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


  // Neo-brutalist splash screen inspired by provided HTML
  return (
    <View style={styles.bgWrapper}>
      <View style={styles.mobileFrame}>
        {/* Decorative Triangles */}
        <View style={[styles.triangle, styles.trianglePink]} />
        <View style={[styles.triangle, styles.trianglePurple]} />
        <View style={[styles.triangle, styles.triangleSmall]} />

        {/* Geometric Circles */}
        <View style={[styles.geoCircle, styles.geoCircle1]} />
        <View style={[styles.geoCircle, styles.geoCircle2]} />
        <View style={[styles.geoCircle, styles.geoCircle3]} />

        {/* Main Content */}
        <View style={styles.flex1Center}>
          {/* Logo Container */}
          <View style={styles.logoContainer}>
            <View style={styles.logoBg} />
            <Image source={require("../assets/icons/icon.png")} style={styles.logoImg} />
            {/* Sparkle/Star icons can be added here if available */}
          </View>
          {/* Brand Name */}
          <Image source={require("../assets/icons/wordmark.png")} style={styles.wordmarkImg} />
          {/* Tagline */}
          <Text style={styles.tagline}>Find Your Perfect</Text>
          <View style={styles.taglineRow}>
            <Text style={styles.teamPill}>TEAM</Text>
            <Text style={styles.plus}>+</Text>
            <Text style={styles.projectPill}>PROJECT</Text>
          </View>
          {/* Feature Pills */}
          <View style={styles.featurePillsRow}>
            <Text style={styles.featurePill}>Connect</Text>
            <Text style={styles.featurePill}>Collaborate</Text>
            <Text style={styles.featurePill}>Create</Text>
          </View>
        </View>
        {/* Bottom Section */}
        <View style={styles.bottomSection}>
          <TouchableOpacity style={styles.neoBtnPrimary} onPress={() => router.push("/login")}> 
            <Text style={styles.neoBtnText}>Get Started</Text>
          </TouchableOpacity>
          <Text style={styles.footerText}>
            By continuing, you agree to our <Text style={styles.terms}>Terms</Text> & <Text style={styles.terms}>Privacy</Text>
          </Text>
        </View>
        {/* Bottom Decorative Pattern */}
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
  trianglePink: {
    top: 32,
    right: 24,
    borderLeftWidth: 35,
    borderLeftColor: 'transparent',
    borderRightWidth: 35,
    borderRightColor: 'transparent',
    borderBottomWidth: 60,
    borderBottomColor: '#EC4899',
    transform: [{ rotate: '12deg' }],
  },
  trianglePurple: {
    bottom: 160,
    left: 16,
    borderLeftWidth: 30,
    borderLeftColor: 'transparent',
    borderRightWidth: 30,
    borderRightColor: 'transparent',
    borderTopWidth: 50,
    borderTopColor: '#6366F1',
    transform: [{ rotate: '-12deg' }],
  },
  triangleSmall: {
    top: 128,
    left: 32,
    borderLeftWidth: 20,
    borderLeftColor: 'transparent',
    borderRightWidth: 20,
    borderRightColor: 'transparent',
    borderBottomWidth: 35,
    borderBottomColor: '#F472B6',
    transform: [{ rotate: '45deg' }],
  },
  geoCircle: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  geoCircle1: { top: 80, right: 64, width: 16, height: 16, backgroundColor: '#6366F1' },
  geoCircle2: { bottom: 240, right: 32, width: 24, height: 24, backgroundColor: '#8B5CF6' },
  geoCircle3: { top: 192, left: 16, width: 12, height: 12, backgroundColor: '#EC4899' },
  flex1Center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 40,
  },
  logoContainer: {
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  logoBg: {
    position: 'absolute',
    top: -16,
    left: -16,
    width: 128,
    height: 128,
    backgroundColor: '#8B5CF6',
    borderRadius: 24,
    borderWidth: 3,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
    transform: [{ rotate: '3deg' }],
  },
  logoImg: {
    width: 128,
    height: 128,
    resizeMode: 'contain',
    zIndex: 2,
  },
  wordmarkImg: {
    height: 64,
    resizeMode: 'contain',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 18,
    color: '#5B21B6',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: 1,
  },
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 32,
  },
  teamPill: {
    backgroundColor: '#EDE9FE',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontWeight: 'bold',
    color: '#5B21B6',
    fontSize: 14,
    marginRight: 4,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  plus: {
    fontSize: 24,
    fontWeight: '900',
    marginHorizontal: 4,
  },
  projectPill: {
    backgroundColor: '#FCE7F3',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontWeight: 'bold',
    color: '#BE185D',
    fontSize: 14,
    marginLeft: 4,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  featurePillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 32,
  },
  featurePill: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontWeight: 'bold',
    color: '#000',
    fontSize: 12,
    marginHorizontal: 2,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    marginTop: 'auto',
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
  },
  neoBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
  },
  footerText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '500',
  },
  terms: {
    color: '#5B21B6',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  hatchedBg: {
    height: 24,
    backgroundColor: '#F9A8D4',
    borderTopWidth: 3,
    borderColor: '#000',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
