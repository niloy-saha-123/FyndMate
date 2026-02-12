/**
 * @file client/src/components/TabBar.tsx
 * @description Neo-brutalist bottom tab bar with animated sliding pill.
 *
 * Icons: Compass · People · Mail · Person (always outline, never filled)
 * Active: icon stroke turns indigo + soft pill slides behind icon with spring physics
 * Inactive: icon stroke is black
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Text, Image, LayoutChangeEvent } from 'react-native';
import { useLinkBuilder } from '@react-navigation/native';
import { PlatformPressable } from '@react-navigation/elements';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useAuth } from '../auth/AuthProvider';
import { getOptimizedImageUrl, ImageSizes } from '../utils/imageOptimization';
import { COLORS, BORDERS } from '../theme/colors';

const TAB_CONFIG: Record<string, {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}> = {
  index: { icon: 'compass-outline', label: 'Discover' },
  likes: { icon: 'people-outline', label: 'Requests' },
  messages: { icon: 'mail-outline', label: 'Messages' },
  profilePage: { icon: 'person-outline', label: 'Profile' },
};

const ICON_SIZE = 24;
const PILL_SIZE = 42;

const SPRING_CONFIG = {
  stiffness: 400,
  damping: 30,
  mass: 1,
};

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { buildHref } = useLinkBuilder();
  const { bottom } = useSafeAreaInsets();
  const { profile } = useAuth();

  const bottomInset = Math.max(bottom, 12);

  // Store the center-X of each icon wrapper (relative to navbar)
  const iconCentersX = useRef<number[]>([]);
  // Store the center-Y of each icon wrapper (relative to navbar)
  const iconCenterY = useRef<number>(0);
  const pillX = useSharedValue(0);
  const pillReady = useSharedValue(0); // 0 = hidden until first layout

  const visibleRoutes = state.routes.filter(r => TAB_CONFIG[r.name]);
  const activeVisibleIndex = visibleRoutes.findIndex(r => r.key === state.routes[state.index]?.key);

  useEffect(() => {
    if (iconCentersX.current[activeVisibleIndex] !== undefined) {
      pillX.value = withSpring(
        iconCentersX.current[activeVisibleIndex] - PILL_SIZE / 2,
        SPRING_CONFIG
      );
    }
  }, [activeVisibleIndex]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
    opacity: pillReady.value,
  }));

  // Measure each icon wrapper's center position relative to the navbar
  const handleIconLayout = (index: number) => (e: LayoutChangeEvent) => {
    // We need position relative to the navbar. PlatformPressable > iconColumn > iconWrapper
    // Use the pageX from measure, but simpler: track tab item layout + offset
  };

  // Track each tab item's layout to find the icon center X
  const handleTabLayout = (index: number) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    // Icon wrapper is centered inside the tab item
    iconCentersX.current[index] = x + width / 2;

    if (index === activeVisibleIndex) {
      pillX.value = x + width / 2 - PILL_SIZE / 2;
      pillReady.value = 1;
    }
  };

  // The icon wrapper top position inside the navbar (paddingTop)
  const PILL_TOP = 10; // matches paddingTop of navbar

  return (
    <View style={[styles.navbar, { paddingBottom: bottomInset }]}>
      {/* Sliding pill — positioned at icon row height, slides horizontally */}
      <Animated.View style={[styles.pill, { top: PILL_TOP }, pillStyle]} />

      {visibleRoutes.map((route) => {
        const { options } = descriptors[route.key];
        const isFocused = route.key === state.routes[state.index]?.key;
        const config = TAB_CONFIG[route.name];
        if (!config) return null;

        const iconColor = isFocused ? COLORS.primary : '#1F2937';

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

        const visibleIndex = visibleRoutes.indexOf(route);
        const isProfileTab = route.name === 'profilePage';

        const renderIcon = () => {
          if (isProfileTab && profile?.profilePicture) {
            return (
              <View style={[styles.profileAvatar, { borderColor: isFocused ? COLORS.primary : '#1F2937' }]}>
                <Image
                  source={{
                    uri: getOptimizedImageUrl(
                      profile.profilePicture,
                      ImageSizes.AVATAR_SMALL.width,
                      ImageSizes.AVATAR_SMALL.quality
                    ),
                  }}
                  style={styles.profileAvatarImage}
                />
              </View>
            );
          }
          return (
            <Ionicons name={config.icon} size={ICON_SIZE} color={iconColor} />
          );
        };

        return (
          <PlatformPressable
            key={route.name}
            href={buildHref(route.name, route.params)}
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarButtonTestID}
            onPress={onPress}
            onLongPress={onLongPress}
            onLayout={handleTabLayout(visibleIndex)}
            style={styles.tabItem}
          >
            <View style={styles.iconColumn}>
              {/* Icon wrapper — pill-sized so the sliding pill aligns */}
              <View style={styles.iconWrapper}>
                {renderIcon()}
              </View>

              <Text
                style={[styles.label, { color: isFocused ? COLORS.primary : '#1F2937' }]}
                numberOfLines={1}
              >
                {config.label}
              </Text>

              {options.tabBarBadge != null && (
                <View style={styles.badgeContainer}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{options.tabBarBadge}</Text>
                  </View>
                </View>
              )}
            </View>
          </PlatformPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  navbar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: COLORS.navBackground,
    borderTopWidth: BORDERS.medium,
    borderTopColor: COLORS.border,
    paddingTop: 10,
  },

  // Sliding pill — absolute in navbar, slides along X axis with spring
  pill: {
    position: 'absolute',
    left: 0,
    width: PILL_SIZE,
    height: PILL_SIZE,
    borderRadius: PILL_SIZE / 2,
    backgroundColor: 'rgba(99, 102, 241, 0.10)',
  },

  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconColumn: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconWrapper: {
    width: PILL_SIZE,
    height: PILL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  label: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  badgeContainer: {
    position: 'absolute',
    top: 0,
    right: -6,
  },
  badge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: COLORS.navBackground,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  profileAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    overflow: 'hidden',
  },
  profileAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 13,
  },
});
