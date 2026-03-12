import { useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BORDERS, COLORS, SHADOWS } from "../theme/colors";

const PRIMARY = COLORS.primary;
const SECONDARY = COLORS.primaryGradient;
const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

export function AnimatedCTA({
  label,
  onPress,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.98,
      useNativeDriver: true,
      speed: 15,
      bounciness: 6,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 7,
    }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          disabled && styles.disabled,
        ]}
      >
        <AnimatedGradient
          colors={[SECONDARY, PRIMARY]}
          style={styles.gradient}
        >
          <Text style={styles.label}>{label}</Text>
        </AnimatedGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 999,
    borderWidth: BORDERS.medium,
    borderColor: COLORS.border,
    overflow: "hidden",
    backgroundColor: COLORS.surface,
    ...SHADOWS.medium,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  gradient: {
    minHeight: 48,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  label: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.5,
  },
});
