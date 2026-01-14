import { View, Platform, StyleSheet } from 'react-native';
import { useLinkBuilder, useTheme } from '@react-navigation/native';
import { Text, PlatformPressable } from '@react-navigation/elements';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const { buildHref } = useLinkBuilder();

  return (
    <View style={styles.Navbar}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label =
          options.tabBarLabel === 'string'
            ? options.tabBarLabel
            : options.title ?? route.name;

        const isFocused = state.index === index;

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
            <Text style={[
              styles.TabText,
              { color: isFocused ? 'red' : '#222' },
            ]}>
              {label}
            </Text>

            {/* 
              TODO: BADGE RENDERER
              Check options.tabBarBadge
              If present, render an Orange Dot (8x8px, rounded)
              Position: Absolute, top-right of the icon/text
              Style:
              {
                position: 'absolute',
                top: 0,
                right: 10,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: 'orange' // Theme color
              }
            */}
          </PlatformPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  Navbar: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
  },

  TabItem: {
    flex: 1,
    alignItems: 'center',
  },

  TabText: {
    fontSize: 14,
    textAlign: 'center',
    textDecorationLine: 'none',
  },
});