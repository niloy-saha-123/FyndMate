/**
 * @file client/src/components/NeoButton.tsx
 * @description Neo-brutalist button components
 */

import React from 'react';
import {
    TouchableOpacity,
    Text,
    StyleSheet,
    ViewStyle,
    TextStyle,
    View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SHADOWS, BORDERS, RADIUS } from '../theme/colors';

interface NeoButtonProps {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'danger';
    size?: 'small' | 'medium' | 'large';
    icon?: React.ReactNode;
    disabled?: boolean;
    style?: ViewStyle;
    textStyle?: TextStyle;
    fullWidth?: boolean;
}

export function NeoButton({
    title,
    onPress,
    variant = 'primary',
    size = 'medium',
    icon,
    disabled = false,
    style,
    textStyle,
    fullWidth = false,
}: NeoButtonProps) {
    const getSizeStyles = () => {
        switch (size) {
            case 'small':
                return { padding: 8, paddingHorizontal: 16, fontSize: 13 };
            case 'large':
                return { padding: 16, paddingHorizontal: 24, fontSize: 16 };
            default:
                return { padding: 12, paddingHorizontal: 20, fontSize: 15 };
        }
    };

    const sizeStyles = getSizeStyles();

    const buttonContent = (
        <View style={styles.content}>
            {icon && <View style={styles.iconContainer}>{icon}</View>}
            <Text
                style={[
                    styles.text,
                    { fontSize: sizeStyles.fontSize },
                    variant === 'secondary' && styles.textSecondary,
                    textStyle,
                ]}
            >
                {title}
            </Text>
        </View>
    );

    if (variant === 'primary') {
        return (
            <TouchableOpacity
                onPress={onPress}
                disabled={disabled}
                activeOpacity={0.9}
                style={[
                    styles.buttonBase,
                    SHADOWS.medium,
                    { opacity: disabled ? 0.5 : 1 },
                    fullWidth && styles.fullWidth,
                    style,
                ]}
            >
                <LinearGradient
                    colors={[COLORS.primary, COLORS.primaryGradient]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                        styles.gradient,
                        {
                            paddingVertical: sizeStyles.padding,
                            paddingHorizontal: sizeStyles.paddingHorizontal,
                        },
                    ]}
                >
                    {buttonContent}
                </LinearGradient>
            </TouchableOpacity>
        );
    }

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.9}
            style={[
                styles.buttonBase,
                styles.secondary,
                SHADOWS.medium,
                {
                    paddingVertical: sizeStyles.padding,
                    paddingHorizontal: sizeStyles.paddingHorizontal,
                    opacity: disabled ? 0.5 : 1,
                },
                variant === 'danger' && styles.danger,
                fullWidth && styles.fullWidth,
                style,
            ]}
        >
            {buttonContent}
        </TouchableOpacity>
    );
}

// Circular icon button
interface NeoIconButtonProps {
    onPress: () => void;
    icon: React.ReactNode;
    size?: number;
    style?: ViewStyle;
}

export function NeoIconButton({ onPress, icon, size = 48, style }: NeoIconButtonProps) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.9}
            style={[
                styles.iconButton,
                SHADOWS.medium,
                { width: size, height: size, borderRadius: size / 2 },
                style,
            ]}
        >
            {icon}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    buttonBase: {
        borderWidth: BORDERS.medium,
        borderColor: COLORS.border,
        borderRadius: RADIUS.full,
        overflow: 'hidden',
    },
    gradient: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondary: {
        backgroundColor: COLORS.surface,
    },
    danger: {
        backgroundColor: COLORS.danger,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainer: {
        marginRight: 8,
    },
    text: {
        fontWeight: '700',
        color: COLORS.surface,
    },
    textSecondary: {
        color: COLORS.textPrimary,
    },
    fullWidth: {
        flex: 1,
    },
    iconButton: {
        backgroundColor: COLORS.surface,
        borderWidth: BORDERS.medium,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
