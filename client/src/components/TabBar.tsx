import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useLinkBuilder } from '@react-navigation/native';
import { PlatformPressable } from '@react-navigation/elements';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HomeIcon from '../../assets/icons/home.svg';
import BrofistIcon from '../../assets/icons/brofist.svg';
import ChatIcon from '../../assets/icons/chat.svg';
import ProfileIcon from '../../assets/icons/profile.svg';

// Color constants - Hinge-style behavior
const NAV_BG = "#F6F7E7";      // navbar background (off-white)
const INACTIVE = "#F8C89E";    // light orange (not selected)
const ACTIVE = "#EE8B44";      // dark orange (selected)

// Map route names to their SVG components
const ICON_MAP = {
  index: HomeIcon,
  likes: BrofistIcon,
  matches: ChatIcon,
  profilePage: ProfileIcon,
} as const;

type TabKey = keyof typeof ICON_MAP;

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { buildHref } = useLinkBuilder();
  const { bottom } = useSafeAreaInsets();

  const bottomInset = Math.max(bottom, 12); // keep room for gesture areas

  return (
    <View style={[styles.Navbar, { paddingBottom: bottomInset }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const color = isFocused ? ACTIVE : INACTIVE;

        const label =
          typeof options.tabBarLabel === 'string'
            ? options.tabBarLabel
            : options.title || route.name;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        const Icon = ICON_MAP[route.name as TabKey];
        if (!Icon) return null; // Skip routes without icons (like communities)

        return (
          <PlatformPressable
            key={route.name}
            href={buildHref(route.name, route.params)}
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarButtonTestID}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.TabItem}
          >
            <View style={styles.IconContainer}>
              <View style={{ transform: [{ scale: isFocused ? 1.08 : 1 }] }}>
                <Icon width={30} height={30} color={color} />
              </View>

              <Text style={[styles.Label, { color }]} numberOfLines={1}>
                {label}
              </Text>

              {/* Badge indicator for likes/chat notifications */}
              {options.tabBarBadge && (
                <View style={styles.Badge} />
              )}
            </View>
          </PlatformPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  Navbar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: NAV_BG,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
    paddingTop: 10,
    // Shadow for iOS
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
    // Shadow for Android
    elevation: 8,
  },

  TabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  IconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },

  Label: {
    marginTop: 6,
    fontSize: 11,
    letterSpacing: 0.2,
    fontWeight: '600',
  },

  Badge: {
    position: 'absolute',
    top: -2,
    right: -6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ACTIVE,
  },
});