import { Tabs } from 'expo-router';
import React from 'react';
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from "react-native-reanimated";
import { StyleSheet } from 'react-native';
import {TabBar} from "../../src/components/TabBar"

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn, 
  strict: false,                  
});

export default function TabLayout() {

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
        name="likesPage"
        options={{
          title: 'Likes',
        }}
      />
      <Tabs.Screen
        name="chat"
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