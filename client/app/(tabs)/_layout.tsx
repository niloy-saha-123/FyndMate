import { Tabs, Redirect } from 'expo-router';
import React, { useEffect } from 'react';
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from "react-native-reanimated";
import { TabBar } from "../../src/components/TabBar"
import { useAuth } from '../../src/auth/AuthProvider';
import { LoadingGate } from "../../src/components/LoadingGate";
import { TabBadgeProvider, useTabBadge } from '../../src/contexts/TabBadgeContext';
import { useLikes } from '../../src/hooks/useLikes';
import { COLORS } from '../../src/theme/colors';

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

function TabLayoutContent() {
  const { user, loading, profile, profileLoading } = useAuth();
  const { messagesUnread, pendingRequests, setPendingRequests } = useTabBadge();
  const { likes, fetchLikes } = useLikes();

  useEffect(() => {
    setPendingRequests(likes.length);
  }, [likes.length, setPendingRequests]);

  useEffect(() => {
    fetchLikes({ silent: true });
  }, [fetchLikes]);

  if (loading || profileLoading) return <LoadingGate message="Loading your profile" />;

  if (!user) return <Redirect href="/login" />;

  if (profile && !profile.onboardingCompleted) {
    const destination = !profile.name
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
      tabBar={props => <TabBar {...props} />}
    >
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
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="likes"
        options={{
          title: 'Requests',
          tabBarBadgeDot: true,
          tabBarBadge: pendingRequests,
          tabBarBadgeColor: COLORS.accent,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarBadgeDot: true,
          tabBarBadge: messagesUnread,
          tabBarBadgeColor: COLORS.primary,
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

export default function TabLayout() {
  return (
    <TabBadgeProvider>
      <TabLayoutContent />
    </TabBadgeProvider>
  );
}