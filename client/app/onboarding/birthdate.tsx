import { useEffect, useState } from "react";
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
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

const PRIMARY = "#6058AE";

export default function OnboardingBirthdate() {
  const { data, update } = useOnboardingForm();
  const { user, profile, setProfileLocally } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    data.birthDate ? new Date(data.birthDate) : null
  );
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      router.replace("/login");
    }
    if (profile?.onboardingCompleted) {
      router.replace("/(tabs)");
    }
  }, [user, profile]);

  const handleDateChange = (_: DateTimePickerEvent, date?: Date) => {
    setShowPicker(Platform.OS === "ios");
    if (date) {
      setSelectedDate(date);
      setError(null);
    }
  };

  const validate = () => {
    if (!selectedDate) return "Birthdate is required";
    const today = new Date();
    if (selectedDate > today) return "Birthdate cannot be in the future";
    return null;
  };

  const formatDisplay = (date: Date | null) => {
    if (!date) return "Select your birthdate";
    return date.toLocaleDateString();
  };

  const onContinue = () => {
    const validation = validate();
    if (validation) {
      setError(validation);
      return;
    }

    const isoBirthdate = selectedDate?.toISOString().split("T")[0] ?? null;
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

  return (
    <OnboardingScaffold
      step={2}
      title="When were you born?"
      subtitle="We keep this private"
    >
      <View style={styles.formSection}>
        <Text style={styles.label}>Birthdate</Text>
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.dateInput}
          onPress={() => setShowPicker(true)}
        >
          <Text style={styles.dateText}>{formatDisplay(selectedDate)}</Text>
          <Text style={styles.dateHint}>Tap to pick</Text>
        </TouchableOpacity>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      {showPicker && (
        <DateTimePicker
          value={selectedDate ?? new Date()}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleDateChange}
          maximumDate={new Date()}
        />
      )}

      <View style={{ marginTop: "auto", marginBottom: 12 }}>
        <AnimatedCTA label="Continue" onPress={onContinue} disabled={!!validate()} />
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  formSection: {
    gap: 8,
  },
  label: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "600",
  },
  dateInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 16,
    backgroundColor: "#FFF",
  },
  dateText: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "600",
  },
  dateHint: {
    color: "#6B7280",
    fontSize: 13,
    marginTop: 4,
  },
  error: {
    color: "#DC2626",
    fontSize: 13,
  },
});
