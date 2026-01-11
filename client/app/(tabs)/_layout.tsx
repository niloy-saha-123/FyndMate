import { Tabs, Redirect } from 'expo-router';
import React from 'react';
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from "react-native-reanimated";
import { StyleSheet } from 'react-native';
import {TabBar} from "../../src/components/TabBar"
import { useAuth } from '../../src/auth/AuthProvider';
import { LoadingGate } from "../../src/components/LoadingGate";

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn, 
  strict: false,                  
});

export default function TabLayout() {

  const { user, loading, profile, profileLoading } = useAuth();
  if (loading || profileLoading) return <LoadingGate message="Loading your profile" />;

  if (!user) return <Redirect href="/login" />;

  if (profile && !profile.onboardingCompleted) {
    const destination = !profile.fullName
      ? "/onboarding/name"
      : !profile.birthDate
      ? "/onboarding/birthdate"
      : "/onboarding/gender";
    return <Redirect href={destination} />;
  }
  
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      tabBar={props => <TabBar {...props}/>}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="communityPage"
        options={{
          title: 'Communities',
        }}
      />
      <Tabs.Screen
        name="likes"
        options={{
          title: 'Likes',
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: 'Chat',
        }}
      />
      <Tabs.Screen
        name="profilePage"
        options={{
          title: 'Profile',
        }}
      />

    </Tabs>
  );
}