import { ReactNode, useEffect, useMemo, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

const PRIMARY = "#6058AE";
const ACCENT = "#8B85C2";

export function OnboardingScaffold({
  step,
  title,
  subtitle,
  children,
}: {
  step: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
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
        <Text style={styles.stepText}>Step {step} of 3</Text>
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
    backgroundColor: "#FFFFFF",
  },
  progressBarBackground: {
    height: 8,
    width: "100%",
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
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
  stepText: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "600",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: PRIMARY,
  },
  subtitle: {
    fontSize: 16,
    color: "#4B5563",
  },
  body: {
    marginTop: 22,
    flex: 1,
  },
});
