import { ReactNode, useEffect, useMemo, useRef } from "react";
import { Animated, StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { COLORS } from "../theme/colors";

const PRIMARY = COLORS.primary;
const ACCENT = COLORS.primaryGradient;

export function OnboardingScaffold({
  step,
  title,
  subtitle,
  children,
  onBack,
}: {
  step: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onBack?: () => void;
}) {
  const progress = useRef(new Animated.Value(step / 3)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: step / 3,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [progress, step]);

  const widthInterpolate = useMemo(
    () =>
      progress.interpolate({
        inputRange: [0, 1],
        outputRange: ["0%", "100%"],
        extrapolate: "clamp",
      }),
    [progress]
  );

  return (
    <View style={styles.container}>
      <View style={styles.progressBarBackground}>
        <Animated.View
          style={[styles.progressFill, { width: widthInterpolate }]}
        />
      </View>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          {onBack ? (
            <TouchableOpacity
              onPress={onBack}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Text style={styles.backLabel}>‹</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.backButtonPlaceholder} />
          )}
          <Text style={styles.stepText}>Step {step} of 3</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: COLORS.background,
  },
  progressBarBackground: {
    height: 8,
    width: "100%",
    borderRadius: 8,
    backgroundColor: COLORS.gray100,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 8,
    backgroundColor: PRIMARY,
  },
  header: {
    marginTop: 18,
    gap: 6,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    marginBottom: 4,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  backButtonPlaceholder: {
    width: 32,
    height: 32,
    marginRight: 8,
  },
  backLabel: {
    fontSize: 22,
    color: COLORS.textSecondary,
  },
  stepText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  body: {
    marginTop: 22,
    flex: 1,
  },
});
