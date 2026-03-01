import { useCallback, useEffect, useState } from "react";
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
} from "react-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { OnboardingScaffold } from "../../src/components/OnboardingScaffold";
import { AnimatedCTA } from "../../src/components/AnimatedCTA";
import { useOnboardingForm } from "../../src/hooks/useOnboardingForm";
import { useAuth } from "../../src/auth/AuthProvider";
import { updateProfile } from "../../src/services/profileService";
import { COLORS } from "../../src/theme/colors";

const MIN_AGE = 13;
const MIN_DATE = new Date(1900, 0, 1); // Jan 1, 1900
const MAX_DATE = new Date(2030, 11, 31); // Dec 31, 2030

function getToday(): Date {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}

function computeAge(birth: Date): number {
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function formatDisplay(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function OnboardingBirthdate() {
  const { data, update } = useOnboardingForm();
  const { user, profile, setProfileLocally } = useAuth();
  const today = getToday();

  const [selectedDate, setSelectedDate] = useState<Date | null>(() =>
    data.birthDate ? new Date(data.birthDate) : null
  );
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerValue, setPickerValue] = useState<Date>(today);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) router.replace("/login");
    if (profile?.onboardingCompleted) router.replace("/(tabs)");
  }, [user, profile]);

  const validate = useCallback((): string | null => {
    if (!selectedDate) return "Please select your birth date.";
    if (selectedDate > today) {
      return "Your birth date must be on or before today.";
    }
    if (computeAge(selectedDate) < MIN_AGE) {
      return "You must be at least 13 years old to use this app.";
    }
    return null;
  }, [selectedDate, today]);

  const showPicker = () => {
    setPickerValue(selectedDate ?? today);
    setError(null);
    setPickerVisible(true);
  };

  const hidePicker = () => setPickerVisible(false);

  const handlePickerChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === "android") {
      setPickerVisible(false);
    }
    if (event.type === "set" && date) {
      setSelectedDate(date);
      setError(null);
      if (Platform.OS === "ios") hidePicker();
    }
  };

  const handleIOSConfirm = () => {
    setSelectedDate(pickerValue);
    setError(null);
    hidePicker();
  };

  const onContinue = () => {
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }
    setError(null);
    const isoBirthdate = selectedDate!.toISOString().split("T")[0];
    update({ birthDate: isoBirthdate });

    if (user) {
      updateProfile(user.authId, {
        birthDate: isoBirthdate,
        onboardingCompleted: false,
      })
        .then((next) => setProfileLocally(next))
        .catch((err) => console.warn("Partial save failed", err?.message));
    }
    router.push("/onboarding/gender");
  };

  const canContinue = !validate();

  const renderPicker = () => (
    <DateTimePicker
      value={pickerValue}
      mode="date"
      display="spinner"
      minimumDate={MIN_DATE}
      maximumDate={MAX_DATE}
      onChange={handlePickerChange}
    />
  );

  return (
    <OnboardingScaffold
      step={2}
      title="When were you born?"
      subtitle="We keep this private"
      onBack={() => router.back()}
    >
      <View style={styles.formSection}>
        <Text style={styles.label}>Birthdate</Text>
        <TouchableOpacity
          style={styles.inputBox}
          onPress={showPicker}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Select birthdate"
        >
          <Text
            style={[
              styles.inputText,
              !selectedDate && styles.inputPlaceholder,
            ]}
            numberOfLines={1}
          >
            {selectedDate
              ? formatDisplay(selectedDate)
              : "Tap to pick your birth date"}
          </Text>
        </TouchableOpacity>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      {Platform.OS === "android" && pickerVisible && renderPicker()}

      {Platform.OS === "ios" && pickerVisible && (
        <Modal
          transparent
          animationType="slide"
          visible={pickerVisible}
          onRequestClose={hidePicker}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={hidePicker}
          />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={hidePicker}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleIOSConfirm}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.modalDone}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={pickerValue}
              mode="date"
              display="spinner"
              minimumDate={MIN_DATE}
              maximumDate={MAX_DATE}
              onChange={(_, date) => date && setPickerValue(date)}
            />
          </View>
        </Modal>
      )}

      <View style={{ marginTop: "auto", marginBottom: 12 }}>
        <AnimatedCTA
          label="Continue"
          onPress={onContinue}
          disabled={!canContinue}
        />
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  formSection: {
    gap: 8,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  inputBox: {
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: COLORS.surface,
    minHeight: 52,
    justifyContent: "center",
  },
  inputText: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: "600",
  },
  inputPlaceholder: {
    color: COLORS.textLight,
    fontWeight: "500",
  },
  error: {
    color: COLORS.danger,
    fontSize: 13,
    marginTop: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 34,
    paddingHorizontal: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
  },
  modalCancel: {
    fontSize: 17,
    color: COLORS.textSecondary,
  },
  modalDone: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.primary,
  },
});
