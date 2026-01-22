/**
 * @file client/src/screens/LocationSettingsScreen.tsx
 * @description Settings screen for managing location sharing preferences.
 * 
 * This screen allows users to:
 * - Toggle location sharing ON/OFF
 * - See their current location (city, country)
 * - Manually update their location
 * - See when location was last updated
 * - View current OS permission level
 */

import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
    Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocation } from '@/src/hooks/useLocation';

// Dark theme colors (consistent with app)
const COLORS = {
    background: '#121212',
    surface: '#1E1E1E',
    card: '#2A2A2A',
    primary: '#6058AE',
    text: '#FFFFFF',
    textSecondary: '#AAAAAA',
    border: '#333333',
    success: '#4CAF50',
    disabled: '#666666',
};

/**
 * Format relative time (e.g., "2 hours ago")
 */
function formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

export const LocationSettingsScreen = () => {
    const {
        preference,
        permission,
        loading,
        currentLocation,
        lastUpdated,
        updateLocationNow,
        changePreference,
    } = useLocation();

    const isEnabled = preference === 'on';

    const handleToggle = (value: boolean) => {
        changePreference(value ? 'on' : 'off');
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Ionicons name="location" size={28} color={COLORS.primary} />
                <Text style={styles.headerTitle}>Location</Text>
            </View>

            {/* Main Toggle Card */}
            <View style={styles.card}>
                <View style={styles.toggleRow}>
                    <View style={styles.toggleInfo}>
                        <Text style={styles.toggleLabel}>Share your location</Text>
                        <Text style={styles.toggleDescription}>
                            Show your city on your profile so others can find you nearby
                        </Text>
                    </View>
                    <Switch
                        value={isEnabled}
                        onValueChange={handleToggle}
                        trackColor={{ false: COLORS.border, true: COLORS.primary }}
                        thumbColor={isEnabled ? '#FFFFFF' : '#888888'}
                        disabled={loading}
                    />
                </View>
            </View>

            {/* Permission Status */}
            {permission && (
                <View style={styles.card}>
                    <View style={styles.infoRow}>
                        <Ionicons
                            name={permission === 'always' ? 'shield-checkmark' : 'shield'}
                            size={20}
                            color={permission === 'denied' ? COLORS.disabled : COLORS.success}
                        />
                        <Text style={styles.infoLabel}>Permission:</Text>
                        <Text style={styles.infoValue}>
                            {permission === 'always' && 'Always'}
                            {permission === 'whileUsing' && 'While Using App'}
                            {permission === 'denied' && 'Denied'}
                        </Text>
                        {permission !== 'denied' && (
                            <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                        )}
                    </View>
                </View>
            )}

            {/* Current Location Card */}
            <View style={styles.card}>
                <Text style={styles.sectionTitle}>Current Location</Text>

                {currentLocation ? (
                    <View style={styles.locationDisplay}>
                        <Ionicons name="navigate" size={20} color={COLORS.primary} />
                        <Text style={styles.locationText}>{currentLocation}</Text>
                    </View>
                ) : (
                    <Text style={styles.noLocation}>
                        {isEnabled ? 'Fetching location...' : 'Location not set'}
                    </Text>
                )}

                {lastUpdated && (
                    <Text style={styles.lastUpdated}>
                        Last updated: {formatTimeAgo(lastUpdated)}
                    </Text>
                )}

                {/* Update Button */}
                <TouchableOpacity
                    style={[
                        styles.updateButton,
                        (!isEnabled || loading) && styles.updateButtonDisabled,
                    ]}
                    onPress={updateLocationNow}
                    disabled={!isEnabled || loading}
                    activeOpacity={0.7}
                >
                    {loading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <>
                            <Ionicons name="refresh" size={18} color="#FFFFFF" />
                            <Text style={styles.updateButtonText}>Update Location Now</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            {/* Info Note */}
            <View style={styles.infoNote}>
                <Ionicons name="information-circle-outline" size={18} color={COLORS.textSecondary} />
                <Text style={styles.infoNoteText}>
                    To change between "Always" and "While Using App", go to your device's Settings → FyndMate → Location
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 24,
        paddingTop: 8,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: COLORS.text,
    },
    card: {
        backgroundColor: COLORS.card,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    toggleInfo: {
        flex: 1,
        marginRight: 16,
    },
    toggleLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 4,
    },
    toggleDescription: {
        fontSize: 13,
        color: COLORS.textSecondary,
        lineHeight: 18,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    infoLabel: {
        fontSize: 14,
        color: COLORS.textSecondary,
    },
    infoValue: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text,
        flex: 1,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textSecondary,
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    locationDisplay: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8,
    },
    locationText: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.text,
    },
    noLocation: {
        fontSize: 16,
        color: COLORS.disabled,
        fontStyle: 'italic',
        marginBottom: 8,
    },
    lastUpdated: {
        fontSize: 13,
        color: COLORS.textSecondary,
        marginBottom: 16,
    },
    updateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: COLORS.primary,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    updateButtonDisabled: {
        backgroundColor: COLORS.disabled,
        opacity: 0.6,
    },
    updateButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    infoNote: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        paddingHorizontal: 4,
        marginTop: 8,
    },
    infoNoteText: {
        flex: 1,
        fontSize: 12,
        color: COLORS.textSecondary,
        lineHeight: 18,
    },
});
