import { Stack } from "expo-router";
import { View } from "react-native";
import { OnboardingProvider } from "../../src/hooks/useOnboardingForm";
import { useAuth } from "../../src/auth/AuthProvider";

export default function OnboardingLayout() {
  const { profile } = useAuth();

  return (
    <OnboardingProvider initialProfile={profile}>
      <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
        <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
          <Stack.Screen name="name" />
          <Stack.Screen name="birthdate" />
          <Stack.Screen name="gender" />
        </Stack>
      </View>
    </OnboardingProvider>
  );
}
