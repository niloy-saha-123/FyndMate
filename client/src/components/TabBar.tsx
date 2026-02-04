/**
 * @file client/src/components/TabBar.tsx
 * @description Neo-brutalist bottom tab navigation
 */

import React from 'react';
import { View, StyleSheet, Text, Image } from 'react-native';
import { useLinkBuilder } from '@react-navigation/native';
import { PlatformPressable } from '@react-navigation/elements';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { getOptimizedImageUrl, ImageSizes } from '../utils/imageOptimization';
import { COLORS, BORDERS } from '../theme/colors';

// Brofist icon
const BrofistIcon = require('../../assets/icons/brofist.png');

// Map route names to Ionicons icon names
const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'home',
  chat: 'chatbubble',
};

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { buildHref } = useLinkBuilder();
  const { bottom } = useSafeAreaInsets();
  const { profile } = useAuth();

  const bottomInset = Math.max(bottom, 12);

  return (
    <View style={[styles.navbar, { paddingBottom: bottomInset }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const color = isFocused ? COLORS.navActive : COLORS.navInactive;

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

        const iconName = ICON_MAP[route.name];
        const isLikesTab = route.name === 'likes';
        const isProfileTab = route.name === 'profilePage';

        // Skip routes without icons (like communities), but allow likes and profile tabs
        if (!iconName && !isLikesTab && !isProfileTab) return null;

        const renderIcon = () => {
          if (isLikesTab) {
            return (
              <Image
                source={BrofistIcon}
                style={{ width: 24, height: 24, tintColor: color }}
              />
            );
          }
          if (isProfileTab) {
            if (profile?.profilePicture) {
              return (
                <View
                  style={[
                    styles.profileAvatar,
                    { borderColor: isFocused ? COLORS.navActive : COLORS.border },
                  ]}
                >
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
              <Ionicons
                name={isFocused ? 'person' : 'person-outline'}
                size={24}
                color={color}
              />
            );
          }
          return (
            <Ionicons
              name={isFocused ? iconName : (`${iconName}-outline` as any)}
              size={24}
              color={color}
            />
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
            style={styles.tabItem}
          >
            <View style={styles.iconContainer}>
              <View style={[styles.iconWrapper, isFocused && styles.iconWrapperActive]}>
                {renderIcon()}
              </View>

              <Text
                style={[
                  styles.label,
                  { color },
                  isFocused && styles.labelActive,
                ]}
                numberOfLines={1}
              >
                {label}
              </Text>

              {/* Badge indicator */}
              {options.tabBarBadge && (
                <View style={styles.badge}>
                  <View style={styles.badgeDot} />
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
    paddingTop: 8,
    // Neo-brutalist shadow effect at top
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },

  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconWrapper: {
    padding: 4,
  },

  iconWrapperActive: {
    transform: [{ scale: 1.1 }],
  },

  label: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  labelActive: {
    color: COLORS.navActive,
  },

  badge: {
    position: 'absolute',
    top: 0,
    right: -4,
  },

  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: COLORS.border,
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