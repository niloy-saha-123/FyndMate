/**
 * @file client/src/components/ChatDateHeader.tsx
 * @description Date section header component for chat message grouping
 */

import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "../theme/colors";

interface ChatDateHeaderProps {
  date: string;
}

export function ChatDateHeader({ date }: ChatDateHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.line} />
      <View style={styles.dateContainer}>
        <Text style={styles.dateText}>{date}</Text>
      </View>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dateContainer: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dateText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});