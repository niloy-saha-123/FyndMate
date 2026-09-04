import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

/**
 * Every gate on the auth bootstrap path (welcome -> login -> app-gate -> tabs)
 * must render this exact message. Those routes hand off to each other while the
 * session and profile load, so differing copy makes one wait look like several
 * separate loading screens.
 */
export const AUTH_LOADING_MESSAGE = "Getting things ready";

export function LoadingGate({
  message = "Loading",
  subtext,
}: {
  message?: string;
  subtext?: string;
}) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#6058AE" />
      <Text style={styles.message}>{message}</Text>
      {subtext ? <Text style={styles.subtext}>{subtext}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
    paddingHorizontal: 24,
  },
  message: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
  },
  subtext: {
    marginTop: 6,
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
});
