/**
 * @file client/src/components/NeoCard.tsx
 * @description Reusable Neo-brutalist card component
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { COLORS, SHADOWS, BORDERS, RADIUS } from '../theme/colors';

interface NeoCardProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    shadowSize?: 'small' | 'medium' | 'large';
}

export function NeoCard({ children, style, shadowSize = 'medium' }: NeoCardProps) {
    const shadow = SHADOWS[shadowSize];

    return (
        <View style={[styles.card, shadow, style]}>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: COLORS.surface,
        borderWidth: BORDERS.medium,
        borderColor: COLORS.border,
        borderRadius: RADIUS.large,
        overflow: 'hidden',
    },
});
