import React from 'react';
import { View, StyleSheet, Text, Image } from 'react-native';
import { useLinkBuilder } from '@react-navigation/native';
import { PlatformPressable } from '@react-navigation/elements';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { getOptimizedImageUrl, ImageSizes } from '../utils/imageOptimization';

// Brofist icon
const BrofistIcon = require('../../assets/icons/brofist.png');

// Color constants - Dark theme with purple accents
const NAV_BG = "#1E1E1E";      // navbar background (dark)
const INACTIVE = "#666666";    // gray (not selected)
const ACTIVE = "#6058AE";      // purple (selected)

// Map route names to Ionicons icon names (likes uses custom image, profilePage uses user's avatar)
const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'home-outline',
  chat: 'chatbubble-outline',
};

type TabKey = keyof typeof ICON_MAP;

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { buildHref } = useLinkBuilder();
  const { bottom } = useSafeAreaInsets();
  const { profile } = useAuth();

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

        const iconName = ICON_MAP[route.name as TabKey];
        const isLikesTab = route.name === 'likes';
        const isProfileTab = route.name === 'profilePage';
        
        // Skip routes without icons (like communities), but allow likes and profile tabs
        if (!iconName && !isLikesTab && !isProfileTab) return null;

        const renderIcon = () => {
          if (isLikesTab) {
            return (
              <Image 
                source={BrofistIcon} 
                style={{ width: 28, height: 28, tintColor: color }} 
              />
            );
          }
          if (isProfileTab) {
            // Show user's profile picture or fallback to person icon
            if (profile?.profilePicture) {
              return (
                <View style={[
                  styles.ProfileAvatar,
                  { borderColor: isFocused ? ACTIVE : 'transparent' }
                ]}>
                  <Image 
                    source={{ uri: getOptimizedImageUrl(profile.profilePicture, ImageSizes.AVATAR_SMALL.width, ImageSizes.AVATAR_SMALL.quality) }} 
                    style={styles.ProfileAvatarImage}
                  />
                </View>
              );
            }
            return <Ionicons name="person-outline" size={28} color={color} />;
          }
          return <Ionicons name={iconName!} size={28} color={color} />;
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
            style={styles.TabItem}
          >
            <View style={styles.IconContainer}>
              <View style={{ transform: [{ scale: isFocused ? 1.08 : 1 }] }}>
                {renderIcon()}
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
    borderTopColor: '#2A2A2A',
    paddingTop: 10,
    // Shadow for iOS
    shadowColor: '#000',
    shadowOpacity: 0.3,
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

  ProfileAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    overflow: 'hidden',
  },

  ProfileAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
});