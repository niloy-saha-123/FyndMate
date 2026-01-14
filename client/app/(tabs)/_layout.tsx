import { Tabs, Redirect } from 'expo-router';
import React from 'react';
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from "react-native-reanimated";
import { StyleSheet } from 'react-native';
import { TabBar } from "../../src/components/TabBar"
import { useAuth } from '../../src/auth/AuthProvider';

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

export default function TabLayout() {

  /* 
   TODO: PARALLEL DATA FETCHING & BADGES
   1. Use the 'usePrefetchData' hook here (see parallel_loading_strategy.md).
      const { feed, likes, matches } = usePrefetchData(token);
   
   2. Determine Badge State:
      const hasNewLikes = likes.length > 0;
      const hasNewMatches = matches.some(m => m.hasUnreadMessages);

   3. Pass to Tabs via options (see below).
  */
  const { user, loading } = useAuth();
  if (loading) return null;

  if (!user) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      tabBar={props => <TabBar {...props} />}>
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
          // TODO: Pass badge state here
          // tabBarBadge: hasNewLikes ? " " : undefined, 
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: 'Chat',
          // TODO: Pass badge state here
          // tabBarBadge: hasNewMatches ? " " : undefined,
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