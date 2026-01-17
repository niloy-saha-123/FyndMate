import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { OnboardingProvider } from "../../src/hooks/useOnboardingForm";
import { useAuth } from "../../src/auth/AuthProvider";

export default function OnboardingLayout() {
  const { profile } = useAuth();

  return (
    <OnboardingProvider initialProfile={profile}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
        <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
          <Stack.Screen name="name" />
          <Stack.Screen name="birthdate" />
          <Stack.Screen name="gender" />
        </Stack>
      </SafeAreaView>
    </OnboardingProvider>
  );
}
