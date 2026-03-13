import React, { useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Animated,
  PanResponder,
} from "react-native";
import { useRouter } from "expo-router";
import { COLORS } from "../src/theme/colors";

export default function PrivacyScreen() {
  const router = useRouter();

  const translateY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        return gestureState.dy > 5;
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_evt, gestureState) => {
        if (gestureState.dy > 80) {
          Animated.timing(translateY, {
            toValue: 600,
            duration: 180,
            useNativeDriver: true,
          }).start(() => {
            router.back();
          });
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  return (
    <View style={styles.overlay}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Dismiss privacy policy"
      />
      <Animated.View
        style={[styles.sheet, { transform: [{ translateY }] }]}
      >
        <View
          style={styles.handleContainer}
          {...panResponder.panHandlers}
        >
          <View style={styles.handle} />
        </View>
        <Text style={styles.title}>Privacy Policy</Text>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
        <Text style={styles.lastUpdated}>Last Updated: March 5, 2025</Text>

        <Text style={styles.sectionTitle}>1. Introduction</Text>
        <Text style={styles.paragraph}>
          Troupe (“Company,” “we,” “our,” or “us”) operates the Troupe mobile application and related services (the “Service”). This Privacy Policy describes how we collect, use, disclose, and retain information about you when you use the Service. By using the Service, you agree to the practices described in this policy.
        </Text>
        <Text style={styles.paragraph}>
          If you do not agree with this Privacy Policy, you must not use the Service. We may update this policy from time to time; the “Last Updated” date above indicates when it was last revised.
        </Text>
        <Text style={styles.paragraph}>
          This Privacy Policy applies when you use Troupe on iOS (via the App Store), Android (via Google Play), or other platforms. We are not affiliated with, endorsed by, or acting on behalf of Apple Inc. or Google LLC.
        </Text>

        <Text style={styles.sectionTitle}>2. Information We Collect</Text>
        <Text style={styles.paragraph}>
          2.1 Account and profile information. When you create an account, we collect the information you provide, such as your email address and, if you sign up with a third-party provider (e.g., Google), the identifier and basic profile data (e.g., name, email, profile photo) that the provider shares with us. You may also provide a display name, bio, skills, interests, projects, experience, optional GitHub username, and other profile fields. We store this information to operate your account and to display your profile to other users in accordance with the Service’s functionality.
        </Text>
        <Text style={styles.paragraph}>
          2.2 Authentication and session data. We use a third-party authentication provider (e.g., Supabase and, for sign-in, Google OAuth) to manage sign-in and sessions. This includes storing hashed passwords (for email/password accounts), session tokens, and refresh tokens. We do not store your plain-text password.
        </Text>
        <Text style={styles.paragraph}>
          2.3 Messages. When you send or receive messages through the Service, we store the content of those messages, associated metadata (e.g., sender, recipient, timestamps), and relationship data (e.g., match status) on our systems. Messages may be retained for safety, security, and legal purposes even after you or the other user deletes them from the interface (“soft delete”), as further described in Section 5.
        </Text>
        <Text style={styles.paragraph}>
          2.4 Precise and derived location. If you grant the app permission to access your device’s location, we collect precise GPS coordinates (latitude and longitude) on our servers. We use third-party geocoding services (e.g., OpenStreetMap-based Nominatim) to convert coordinates into an approximate location such as city and country. We do not display your raw coordinates to other users; we may display city, country, or other approximate location in accordance with your settings.
        </Text>
        <Text style={styles.paragraph}>
          2.5 Device and technical metadata. We may collect device type, operating system, app version, language preferences, and similar technical information to operate and improve the Service. When you use the Service, we also receive information such as your IP address and request metadata (e.g., URLs, methods) from our infrastructure and logging systems.
        </Text>
        <Text style={styles.paragraph}>
          2.6 Security and operational logs. We log security- and operations-related events, including authentication attempts, token validation, rate-limiting events, and other events necessary to maintain and secure the Service, detect and prevent fraud and abuse, and comply with legal obligations. These logs may include IP addresses, user identifiers, timestamps, and request metadata.
        </Text>
        <Text style={styles.paragraph}>
          2.7 Deletion and support. If you request account deletion or contact support, we may retain a record that a deletion or support request was made, and related information as needed for legal, safety, or fraud-prevention purposes, as described in Section 5.
        </Text>

        <Text style={styles.sectionTitle}>3. How We Use Your Information</Text>
        <Text style={styles.paragraph}>
          We use the information we collect to: (a) create and manage your account and authenticate you; (b) provide, maintain, and improve the Service, including matching, messaging, and location-based features; (c) display your profile and approximate location to other users in accordance with your settings; (d) send you service-related communications and, with your consent, push notifications about matches and messages; (e) detect, prevent, and address fraud, abuse, security risks, and technical issues; (f) enforce our Terms of Service and other policies; (g) comply with legal obligations and respond to lawful requests from authorities; and (h) for other purposes described in this Privacy Policy or with your consent.
        </Text>

        <Text style={styles.sectionTitle}>4. Legal Basis for Processing (EEA/UK)</Text>
        <Text style={styles.paragraph}>
          If you are in the European Economic Area or the United Kingdom, we process your personal data on the following bases: (a) performance of our contract with you (e.g., account and profile management, messaging, matching); (b) our legitimate interests (e.g., security, fraud prevention, improving the Service, analytics), where not overridden by your rights; (c) compliance with legal obligations; and (d) where we have obtained your consent (e.g., for optional push notifications or optional location use). You may withdraw consent where it applies without affecting the lawfulness of processing based on consent before its withdrawal.
        </Text>

        <Text style={styles.sectionTitle}>5. Data Retention</Text>
        <Text style={styles.paragraph}>
          5.1 We retain your account and profile information for as long as your account is active. If you delete your account, we remove your access to the Service and treat the account as deleted; we may retain certain data for a reasonable period thereafter where necessary for safety, security, fraud prevention, or legal compliance (e.g., logs, deletion records, and in some cases message content or metadata).
        </Text>
        <Text style={styles.paragraph}>
          5.2 Messages may be retained on our systems after you or the other user soft-deletes them, for safety, security, and legal purposes. We do not commit to a fixed timeline for permanent deletion of message content or metadata.
        </Text>
        <Text style={styles.paragraph}>
          5.3 Security and operational logs are retained for a period that we determine is reasonable for security, debugging, and legal purposes; specific retention periods may vary by type of log and jurisdiction.
        </Text>
        <Text style={styles.paragraph}>
          5.4 Where we rely on legitimate interests or legal obligations, we retain data only for as long as necessary to fulfill those purposes.
        </Text>

        <Text style={styles.sectionTitle}>6. Sharing and Disclosure</Text>
        <Text style={styles.paragraph}>
          6.1 Other users. Other users of the Service may see your profile information (e.g., name, bio, skills, interests, approximate location such as city and country) and, when matched, exchange messages with you, in accordance with the Service’s functionality and your settings.
        </Text>
        <Text style={styles.paragraph}>
          6.2 Service providers. We use third-party service providers to operate the Service, including hosting, databases, authentication (e.g., Supabase), third-party sign-in (e.g., Google OAuth), geocoding (e.g., OpenStreetMap/Nominatim), push notifications (e.g., Expo Push), and caching/infrastructure (e.g., Redis). These providers process data on our behalf and are contractually or otherwise required to protect your information and use it only as we instruct.
        </Text>
        <Text style={styles.paragraph}>
          6.3 Google OAuth. If you sign in with Google, Google shares with us the data you consent to (e.g., email, name, profile photo). Use of Google Sign-In is subject to Google Privacy Policy (https://policies.google.com/privacy) and Google Terms of Service. We do not sell or share data obtained through Google Sign-In with advertising platforms, data brokers, or information resellers.
        </Text>
        <Text style={styles.paragraph}>
          6.4 Geocoding. Precise coordinates may be sent to our geocoding provider(s) (e.g., OpenStreetMap-based services) to obtain city and country or other approximate location. Please refer to those providers’ privacy policies for their practices.
        </Text>
        <Text style={styles.paragraph}>
          6.5 Legal and safety. We may disclose your information where we believe it is necessary to: (a) comply with applicable law, regulation, legal process, or governmental request; (b) enforce our Terms of Service or other agreements; (c) protect the rights, property, or safety of the Company, our users, or others; or (d) detect, prevent, or address fraud, security, or technical issues.
        </Text>
        <Text style={styles.paragraph}>
          6.6 Business transfers. If we are involved in a merger, acquisition, sale of assets, or bankruptcy, your information may be transferred or disclosed as part of that transaction, subject to applicable law and any successor’s privacy policy.
        </Text>
        <Text style={styles.paragraph}>
          6.7 We do not sell your personal information to third parties for their marketing purposes.
        </Text>

        <Text style={styles.sectionTitle}>7. Security</Text>
        <Text style={styles.paragraph}>
          We use industry-standard measures to protect your information, including encryption in transit and at rest where applicable, secure authentication (e.g., hashed passwords, token-based sessions), and access controls. No method of transmission or storage is completely secure; we cannot guarantee absolute security of your data.
        </Text>
        <Text style={styles.paragraph}>
          Data breach notification. In the event of a data breach in which your user data collected from the Service is compromised (e.g., unintentional disclosure or misuse), we will notify you in accordance with applicable law, which may include sending an email or in-app notification.
        </Text>

        <Text style={styles.sectionTitle}>8. International Transfers</Text>
        <Text style={styles.paragraph}>
          Your information may be processed and stored in countries other than your country of residence, including the United States and other jurisdictions where our service providers operate. Those countries may have different data protection laws. Where we transfer personal data from the EEA or UK to countries not deemed to provide adequate protection, we implement appropriate safeguards (e.g., standard contractual clauses or other mechanisms recognized by applicable law).
        </Text>

        <Text style={styles.sectionTitle}>9. Children</Text>
        <Text style={styles.paragraph}>
          The Service is not intended for users under the age of 13. We do not knowingly collect personal information from children under 13. If you believe we have collected information from a child under 13, please contact us at [Privacy Contact Email] and we will take steps to delete such information.
        </Text>

        <Text style={styles.sectionTitle}>10. Your Rights and Choices</Text>
        <Text style={styles.paragraph}>
          10.1 Access and correction. You may access and update much of your profile information directly in the app. You may also contact us to request access to or correction of personal data we hold about you.
        </Text>
        <Text style={styles.paragraph}>
          10.2 Deletion. You may delete your account through the Service. Upon account deletion, we remove your access and process your data as described in Section 5. You may also contact us to request deletion of your personal data, subject to applicable law and our retention needs.
        </Text>
        <Text style={styles.paragraph}>
          10.3 Objection and restriction. Where we process your data based on legitimate interests, you may object to that processing. You may also ask us to restrict processing in certain circumstances, where permitted by law.
        </Text>
        <Text style={styles.paragraph}>
          10.4 Withdrawal of consent. Where we rely on your consent, you may withdraw it at any time (e.g., by disabling push notifications or location in your device or app settings). Withdrawal does not affect the lawfulness of processing before withdrawal.
        </Text>
        <Text style={styles.paragraph}>
          10.5 Data portability. Where required by law, you may request a copy of your data in a structured, commonly used format.
        </Text>
        <Text style={styles.paragraph}>
          10.6 Complaints. If you are in the EEA or UK, you have the right to lodge a complaint with a supervisory authority in your country of residence.
        </Text>
        <Text style={styles.paragraph}>
          10.7 To exercise any of the above rights or for privacy-related questions, contact us at: [Privacy Contact Email] or [Postal Address]. We will respond in accordance with applicable law.
        </Text>

        <Text style={styles.sectionTitle}>11. Updates to This Policy</Text>
        <Text style={styles.paragraph}>
          We may update this Privacy Policy from time to time. We will post the updated policy in the app and update the “Last Updated” date. If we make material changes, we may provide additional notice (e.g., in-app or by email) where required by law or where we consider it appropriate. Your continued use of the Service after the updated policy becomes effective constitutes your acceptance of the updated policy.
        </Text>

        <Text style={styles.sectionTitle}>12. Contact</Text>
        <Text style={styles.paragraph}>
          For questions about this Privacy Policy or our privacy practices, please contact us at: Email: [Privacy Contact Email] | Address: [Postal Address]
        </Text>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    flex: 0.95,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  handleContainer: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.gray200,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
    textAlign: "center",
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  lastUpdated: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.textSecondary,
    marginBottom: 10,
  },
  bottomSpacer: {
    height: 40,
  },
});
