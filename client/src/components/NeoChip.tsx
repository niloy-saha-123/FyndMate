/**
 * @file client/src/components/NeoChip.tsx
 * @description Neo-brutalist chip/tag components for skills and looking-for items
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { COLORS, SHADOWS, BORDERS, RADIUS } from '../theme/colors';

type ChipVariant = 'skill' | 'looking' | 'meta' | 'tech' | 'green';

interface NeoChipProps {
    label: string;
    variant?: ChipVariant;
    onPress?: () => void;
    selected?: boolean;
    size?: 'small' | 'medium';
    style?: ViewStyle;
}

const chipColors: Record<ChipVariant, { bg: string; text: string }> = {
    skill: { bg: COLORS.skillBg, text: COLORS.skillText },
    looking: { bg: COLORS.lookingBg, text: COLORS.lookingText },
    meta: { bg: COLORS.gray100, text: COLORS.textPrimary },
    tech: { bg: COLORS.surface, text: COLORS.textPrimary },
    green: { bg: COLORS.greenBg, text: COLORS.greenText },
};

export function NeoChip({
    label,
    variant = 'skill',
    onPress,
    selected = false,
    size = 'medium',
    style,
}: NeoChipProps) {
    const colors = chipColors[variant];
    const isSmall = size === 'small';
    const selectedColors =
        variant === 'looking'
            ? { bg: COLORS.accent, text: COLORS.surface }
            : { bg: COLORS.primary, text: COLORS.surface };

    const chipStyle = [
        styles.chip,
        {
            backgroundColor: selected ? selectedColors.bg : colors.bg,
            paddingVertical: isSmall ? 5 : 7,
            paddingHorizontal: isSmall ? 9 : 14,
        },
        style,
    ];

    const textStyle = [
        styles.text,
        {
            color: selected ? selectedColors.text : colors.text,
            fontSize: isSmall ? 12 : 13,
        },
    ];

    if (onPress) {
        return (
            <TouchableOpacity onPress={onPress} style={chipStyle} activeOpacity={0.8}>
                <Text style={textStyle}>{label}</Text>
            </TouchableOpacity>
        );
    }

    return (
        <View style={chipStyle}>
            <Text style={textStyle}>{label}</Text>
        </View>
    );
}

// Container for groups of chips
interface ChipContainerProps {
    children: React.ReactNode;
    style?: ViewStyle;
}

export function ChipContainer({ children, style }: ChipContainerProps) {
    return <View style={[styles.container, style]}>{children}</View>;
}

const styles = StyleSheet.create({
    chip: {
        borderWidth: BORDERS.thin,
        borderColor: COLORS.border,
        borderRadius: RADIUS.full,
        ...SHADOWS.small,
    },
    text: {
        fontWeight: '600',
    },
    container: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        alignItems: 'flex-start',
    },
});
