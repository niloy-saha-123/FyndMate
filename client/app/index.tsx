import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  FlatList,
  Animated,
} from "react-native";
import { useRouter, Redirect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../src/auth/AuthProvider";
import { LoadingGate } from "../src/components/LoadingGate";

const { width, height } = Dimensions.get("window");

interface OnboardingSlide {
  id: string;
  title?: string;
  description: string;
  gradientColors: string[];
}

const onboardingData: OnboardingSlide[] = [
  {
    id: "1",
    description: "Users going through a vetting process to ensure you never match with bots.",
    gradientColors: ["#FDE68A", "#F59E0B"],
  },
  {
    id: "2",
    title: "Matches",
    description: "We match you with people that have a large array of similar interests.",
    gradientColors: ["#FECACA", "#F472B6"],
  },
];

export default function Welcome() {
  const router = useRouter();
  const { user, loading, profile, profileLoading } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);

  // These refs MUST be declared before any early returns (Rules of Hooks)
  const handleViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index || 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  if (loading || profileLoading) {
    return <LoadingGate message="Checking your account" />;
  }

  if (user && profile) {
    const destination = profile.onboardingCompleted
      ? "/(tabs)"
      : !profile.fullName
      ? "/onboarding/name"
      : !profile.birthDate
      ? "/onboarding/birthdate"
      : "/onboarding/gender";
    return <Redirect href={destination} />;
  }

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false }
  );

  const renderSlide = ({ item, index }: { item: OnboardingSlide; index: number }) => {
    return (
      <View style={styles.slide}>
        <View style={styles.carouselContainer}>
          {/* Previous card peek */}
          {index > 0 && (
            <View style={[styles.peekCard, styles.leftPeek]}>
              <LinearGradient
                colors={onboardingData[index - 1].gradientColors as [string, string]}
                style={styles.cardGradient}
              />
            </View>
          )}

          {/* Main card */}
          <View style={styles.mainCard}>
            <LinearGradient
              colors={item.gradientColors as [string, string]}
              style={styles.cardGradient}
            />
          </View>

          {/* Next card peek */}
          {index < onboardingData.length - 1 && (
            <View style={[styles.peekCard, styles.rightPeek]}>
              <LinearGradient
                colors={onboardingData[index + 1].gradientColors as [string, string]}
                style={styles.cardGradient}
              />
            </View>
          )}
        </View>

        <View style={styles.textContainer}>
          {item.title && (
            <Text style={styles.title}>{item.title}</Text>
          )}
          <Text style={styles.description}>{item.description}</Text>
        </View>
      </View>
    );
  };

  const renderPagination = () => {
    return (
      <View style={styles.paginationContainer}>
        {onboardingData.map((_, index) => {
          const inputRange = [
            (index - 1) * width,
            index * width,
            (index + 1) * width,
          ];

          const dotWidth = scrollX.interpolate({
            inputRange,
            outputRange: [8, 8, 8],
            extrapolate: "clamp",
          });

          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.3, 1, 0.3],
            extrapolate: "clamp",
          });

          const backgroundColor = scrollX.interpolate({
            inputRange,
            outputRange: ["#D1D5DB", "#E77C02", "#D1D5DB"],
            extrapolate: "clamp",
          });

          return (
            <Animated.View
              key={index}
              style={[
                styles.dot,
                {
                  width: dotWidth,
                  opacity,
                  backgroundColor,
                },
              ]}
            />
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={onboardingData}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        scrollEventThrottle={16}
      />

      {renderPagination()}

      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={styles.createAccountButton}
          onPress={() => router.push("/login")}
        >
          <LinearGradient
            colors={["#F59E0B", "#E77C02"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientButton}
          >
            <Text style={styles.createAccountText}>Create an account</Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.signInContainer}>
          <Text style={styles.signInText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.push("/login")}>
            <Text style={styles.signInLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  slide: {
    width: width,
    alignItems: "center",
    paddingTop: 60,
  },
  carouselContainer: {
    width: width,
    height: height * 0.45,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  mainCard: {
    width: width * 0.55,
    height: height * 0.40,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    zIndex: 2,
  },
  cardGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
  },
  peekCard: {
    width: width * 0.25,
    height: height * 0.30,
    borderRadius: 16,
    overflow: "hidden",
    position: "absolute",
    opacity: 0.7,
    zIndex: 1,
  },
  leftPeek: {
    left: 10,
  },
  rightPeek: {
    right: 10,
  },
  textContainer: {
    paddingHorizontal: 40,
    alignItems: "center",
    marginTop: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#E77C02",
    marginBottom: 12,
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 24,
  },
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 30,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  bottomContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    marginTop: "auto",
  },
  createAccountButton: {
    borderRadius: 30,
    overflow: "hidden",
    marginBottom: 20,
    shadowColor: "#E77C02",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  gradientButton: {
    paddingVertical: 18,
    alignItems: "center",
    borderRadius: 30,
  },
  createAccountText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  signInContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  signInText: {
    fontSize: 14,
    color: "#6B7280",
  },
  signInLink: {
    fontSize: 14,
    color: "#E77C02",
    fontWeight: "700",
  },
});
