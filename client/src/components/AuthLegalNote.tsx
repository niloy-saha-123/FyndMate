import React from "react";
import { StyleSheet, Text } from "react-native";
import { COLORS } from "../theme/colors";

/**
 * Reusable Terms & Privacy notice for auth screens.
 * Keeps copy and styling consistent across Get Started and Login.
 */
export function AuthLegalNote() {
  return (
    <Text style={styles.text}>
      By continuing, you agree to our <Text style={styles.link}>Terms</Text> and{" "}
      <Text style={styles.link}>Privacy Policy</Text>.
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    marginTop: 14,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    color: COLORS.textSecondary,
    paddingHorizontal: 8,
  },
  link: {
    color: COLORS.primary,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});

