import { ReactNode, useEffect, useMemo, useRef } from "react";
import { Animated, StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { COLORS, BORDERS, SHADOWS, RADIUS } from "../theme/colors";

const PRIMARY = COLORS.primary;

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
    height: 10,
    width: "100%",
    borderRadius: RADIUS.small,
    backgroundColor: COLORS.surface,
    borderWidth: BORDERS.medium,
    borderColor: COLORS.border,
    overflow: "hidden",
    ...SHADOWS.small,
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
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
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    borderWidth: BORDERS.medium,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    ...SHADOWS.small,
  },
  backButtonPlaceholder: {
    width: 40,
    height: 40,
    marginRight: 8,
  },
  backLabel: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  stepText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  body: {
    marginTop: 22,
    flex: 1,
  },
});
