import React, { useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Linking,
  StyleSheet,
  Animated,
  PanResponder,
} from "react-native";
import { useRouter } from "expo-router";
import { COLORS } from "../src/theme/colors";
import { LEGAL_LINKS } from "../src/config/legalLinks";

export default function TermsScreen() {
  const router = useRouter();
  const hostedTermsUrl = LEGAL_LINKS.termsOfService;

  const translateY = useRef(new Animated.Value(0)).current;

  const openHostedTerms = async () => {
    if (!hostedTermsUrl) return;
    try {
      await Linking.openURL(hostedTermsUrl);
    } catch (error) {
      console.error('Failed to open hosted terms URL:', error);
    }
  };

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
        accessibilityLabel="Dismiss terms"
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
        <Text style={styles.title}>Terms of Service</Text>
        {hostedTermsUrl ? (
          <Pressable
            style={styles.hostedLinkButton}
            onPress={() => void openHostedTerms()}
            accessibilityRole="link"
            accessibilityLabel="Open hosted terms of service"
          >
            <Text style={styles.hostedLinkButtonText}>Open Hosted Version</Text>
          </Pressable>
        ) : null}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
        <Text style={styles.lastUpdated}>Last Updated: April 6, 2026</Text>

        <Text style={styles.sectionTitle}>1. Introduction and Acknowledgement</Text>
        <Text style={styles.paragraph}>
          1.1 These Terms of Service (“Terms”) constitute a legal agreement between you and Troupe (“Company,” “we,” “our,” or “us”) governing your access to and use of the Troupe mobile application, website, and related services (collectively, the “Service”).
        </Text>
        <Text style={styles.paragraph}>
          1.2 ACKNOWLEDGEMENT: You acknowledge that these Terms are concluded between you and the Company only, and not with Apple Inc., Google LLC, or any of their affiliates or subsidiaries. The Company, not Apple or Google, is solely responsible for the Service and the content thereof. These Terms may not provide for usage rules that conflict with the Apple Media Services Terms and Conditions (for iOS) or Google Play Terms of Service (for Android) as of the effective date.
        </Text>
        <Text style={styles.paragraph}>
          1.3 NO PARTNERSHIP: You acknowledge that you do not have a partnership with Apple or Google, and that you will not represent yourself as an employee, agent, or official representative of Apple or Google while using the Service.
        </Text>
        <Text style={styles.paragraph}>
          1.4 By creating an account, accessing, or using the Service, you agree to be bound by these Terms. If you do not agree to these Terms, you must not use the Service.
        </Text>
        <Text style={styles.paragraph}>
          1.5 We may update these Terms from time to time as described in Section 16. Your continued use of the Service after updated Terms become effective constitutes your acceptance of the updated Terms.
        </Text>

        <Text style={styles.sectionTitle}>2. Scope of License</Text>
        <Text style={styles.paragraph}>
          2.1 Subject to your compliance with these Terms, we grant you a limited, non-exclusive, non-transferable, revocable license to install and use the Service on any Apple-branded products or Android devices that you own or control, solely for your personal, non-commercial use, and as permitted by the Usage Rules set forth in the Apple Media Services Terms and Conditions (for iOS) or Google Play Terms of Service (for Android). The Service may be accessed by other accounts associated with you via Family Sharing, volume purchasing, or similar features where applicable.
        </Text>

        <Text style={styles.sectionTitle}>3. Eligibility and Accounts</Text>
        <Text style={styles.paragraph}>
          3.1 Minimum age. The Service is intended for individuals who are at least thirteen (13) years old. You may not use the Service if you are under 13. If you are between 13 and the age of majority in your jurisdiction (18 years of age in many countries), you may use the Service only with parental or guardian consent and if you have the legal capacity under applicable law to enter into these Terms.
        </Text>
        <Text style={styles.paragraph}>
          3.2 Accuracy of information. You agree to provide accurate, current, and complete information when creating your account and when providing profile information, including your name, age (via your date of birth), and other profile fields. You agree to keep such information accurate and up to date.
        </Text>
        <Text style={styles.paragraph}>
          3.3 Account security. (a) Authentication is provided via email/password and third-party sign-in (e.g., Google OAuth). Passwords are stored and managed by our authentication provider using industry-standard hashing. (b) You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account. (c) You must promptly notify us of any actual or suspected unauthorized use of your account or any other breach of security.
        </Text>
        <Text style={styles.paragraph}>
          3.4 Single user. Your account is personal to you. You may not share your account or login credentials with any other person or entity.
        </Text>
        <Text style={styles.paragraph}>
          3.5 Previous restrictions. We may prohibit you from creating a new account if your prior account has been suspended or terminated by us, as described in Section 10.
        </Text>

        <Text style={styles.sectionTitle}>4. Description of the Service</Text>
        <Text style={styles.paragraph}>
          4.1 The Service is a social and matching platform designed to help users discover and connect with others for collaborative projects or similar goals. Features include, among others: creating and editing a personal profile (name, bio, skills, interests, projects, experience, optional GitHub username, limited location information); viewing and interacting with other profiles (e.g., likes, matches, blocks, reports); one-to-one messaging between matched users; optional push notifications regarding matches and messages; and optional location-based features such as showing an approximate city/country on profiles.
        </Text>
        <Text style={styles.paragraph}>
          4.2 The specific features available to you may change over time as we improve or modify the Service.
        </Text>

        <Text style={styles.sectionTitle}>5. User Responsibilities and Acceptable Use</Text>
        <Text style={styles.paragraph}>
          5.1 General responsibilities. You are responsible for your use of the Service and for any information, text, messages, images, or other content that you submit, upload, display, or otherwise make available through the Service (“User Content”).
        </Text>
        <Text style={styles.paragraph}>
          5.2 Prohibited conduct. You agree that you will not, and will not attempt to: (a) Use the Service for any unlawful purpose or in violation of any applicable law or regulation. (b) Harass, threaten, stalk, intimidate, or abuse any other user, or encourage others to do so. (c) Transmit or promote content that is defamatory, obscene, hateful, discriminatory, pornographic, or otherwise objectionable. (d) Engage in bullying, exploitation, or behavior that is reasonably likely to cause emotional or physical harm. (e) Use the Service for fraud, scams, deceptive practices, or to solicit money or sensitive personal information from other users. (f) Infringe, misappropriate, or violate any intellectual property, privacy, publicity, or other rights of any person. (g) Send unsolicited or unauthorized commercial communications (spam). (h) Use automated scripts, bots, crawlers, or scraping tools to access, collect data from, or interact with the Service without our prior written permission. (i) Interfere with or disrupt the integrity or performance of the Service or any systems or networks connected to the Service. (j) Attempt to access accounts, data, or systems that you are not authorized to access. (k) Reverse engineer, decompile, disassemble, or otherwise attempt to derive the source code or underlying ideas of the Service, except to the extent such restriction is prohibited by applicable law.
        </Text>
        <Text style={styles.paragraph}>
          5.3 Messaging conduct. When using the messaging features, you must communicate respectfully and lawfully; not send messages that are abusive, threatening, harassing, or sexually explicit; and understand that messages may be retained (including after soft deletion) for safety, security, and legal purposes as described in the Privacy Policy.
        </Text>
        <Text style={styles.paragraph}>
          5.4 Reporting and blocking. The Service provides tools to block and report other users. Use these tools responsibly and only in good faith. Submitting knowingly false or malicious reports is prohibited.
        </Text>

        <Text style={styles.sectionTitle}>6. Location Features</Text>
        <Text style={styles.paragraph}>
          6.1 The Service may request access to your device’s location services. With your permission, the Service collects precise GPS coordinates on the server side and uses them to derive an approximate location (such as city and country) using third-party geocoding services.
        </Text>
        <Text style={styles.paragraph}>
          6.2 We do not display your raw latitude and longitude to other users. Other users may see city and country or other approximate information, subject to your location-sharing settings.
        </Text>
        <Text style={styles.paragraph}>
          6.3 You can manage your location-sharing preference within the app and via your device’s operating system settings.
        </Text>
        <Text style={styles.paragraph}>
          6.4 LOCATION DISCLAIMER: Location data may not be accurate. Your use of location-based features in this application is at your sole risk.
        </Text>

        <Text style={styles.sectionTitle}>7. Content Ownership and License</Text>
        <Text style={styles.paragraph}>
          7.1 Ownership. As between you and the Company, you retain all rights, title, and interest in and to your User Content, subject to the licenses granted in this Section 7.
        </Text>
        <Text style={styles.paragraph}>
          7.2 License to the Company. By submitting or making User Content available through the Service, you grant the Company a worldwide, non-exclusive, royalty-free, transferable, and sublicensable license to use, host, store, reproduce, modify, adapt, publish, translate, create derivative works from, distribute, and display such User Content, solely to operate, provide, maintain, and improve the Service; to show your profile and related content to other users in accordance with the Service’s functionality and your settings; to enforce these Terms and our policies and investigate abuse; and to comply with legal obligations.
        </Text>
        <Text style={styles.paragraph}>
          7.3 We do not guarantee confidentiality of any User Content.
        </Text>
        <Text style={styles.paragraph}>
          7.4 If you provide comments, suggestions, or ideas about the Service (“Feedback”), you agree that we may use such Feedback without restriction or compensation to you, and you hereby assign to us all rights in such Feedback.
        </Text>

        <Text style={styles.sectionTitle}>8. Our Rights to Moderate and Remove Content</Text>
        <Text style={styles.paragraph}>
          8.1 We are not obligated to monitor any User Content. However, we may, in our discretion, review, remove, or restrict access to User Content or accounts where we believe it is necessary or appropriate, including where User Content violates these Terms or applicable law; poses a risk to safety, security, or rights; a user has been blocked or reported; or where required by law or lawful request of authorities.
        </Text>
        <Text style={styles.paragraph}>
          8.2 We may also take technical and administrative measures to limit abusive behavior, including rate limiting, temporary restrictions, or permanent suspension of accounts, as described in Section 10.
        </Text>

        <Text style={styles.sectionTitle}>9. Security and Fraud Prevention</Text>
        <Text style={styles.paragraph}>
          9.1 The Service uses authentication tokens, session validation, and rate-limiting mechanisms (including caching and token checks via infrastructure such as Redis) to help protect accounts and the Service.
        </Text>
        <Text style={styles.paragraph}>
          9.2 We log certain technical and security-related information, including IP addresses, user agent strings, request metadata, and event logs, to maintain and secure the Service; detect and prevent fraud, unauthorized access, and abuse; investigate incidents; and comply with legal obligations.
        </Text>
        <Text style={styles.paragraph}>
          9.3 While we take reasonable steps to protect the Service, no online service can be guaranteed to be completely secure.
        </Text>

        <Text style={styles.sectionTitle}>10. Suspension and Termination</Text>
        <Text style={styles.paragraph}>
          10.1 We may suspend or terminate your access to some or all of the Service, with or without notice, if we reasonably believe you have violated these Terms or applicable law; your conduct creates risk or possible legal exposure for us, other users, or third parties; we are required to do so by law or competent authority; or we discontinue all or part of the Service.
        </Text>
        <Text style={styles.paragraph}>
          10.2 Where technically feasible and not prohibited by law, we will endeavor to take steps that are proportionate to the circumstances. We are under no obligation to provide notice or an opportunity to appeal in all cases, especially in cases of serious or repeated violations.
        </Text>
        <Text style={styles.paragraph}>
          10.3 Upon termination of your account, your right to access and use the Service immediately ceases. We may retain certain data, including User Content and logs, as described in the Privacy Policy for a reasonable period for safety, fraud prevention, and legal purposes.
        </Text>

        <Text style={styles.sectionTitle}>11. Third-Party Services</Text>
        <Text style={styles.paragraph}>
          11.1 The Service integrates with and depends on various third-party services, including third-party authentication providers (such as Google) for sign-in; geocoding providers (such as OpenStreetMap-based services) for converting GPS coordinates into city and country; and cloud infrastructure, hosting, database, and caching providers used to operate the Service.
        </Text>
        <Text style={styles.paragraph}>
          11.2 Your use of third-party services may be subject to additional terms and privacy policies of those providers. We are not responsible for third-party services beyond what is described in these Terms and our Privacy Policy.
        </Text>
        <Text style={styles.paragraph}>
          11.3 Third-Party Terms. You must comply with applicable third-party terms of agreement when using the Service (e.g., if you use Google Sign-In, you must comply with Google's Terms of Service; if the Service includes VoIP or wireless data features, you must not be in violation of your carrier's terms when using the Service).
        </Text>

        <Text style={styles.sectionTitle}>12. Intellectual Property of the Company</Text>
        <Text style={styles.paragraph}>
          12.1 All rights, title, and interest in and to the Service (excluding User Content) are and will remain the exclusive property of the Company and its licensors. This includes all software, visual interfaces, graphics, design, trademarks, logos, domain names, and other proprietary rights.
        </Text>
        <Text style={styles.paragraph}>
          12.2 Subject to your compliance with these Terms, we grant you a limited, non-exclusive, non-transferable, revocable license to install and use the Service solely for your personal, non-commercial use.
        </Text>
        <Text style={styles.paragraph}>
          12.3 You may not copy, modify, distribute, sell, lease, or otherwise exploit any part of the Service, nor may you reverse engineer or attempt to extract the source code of the software, except to the extent allowed by applicable law.
        </Text>

        <Text style={styles.sectionTitle}>12. Indemnification</Text>
        <Text style={styles.paragraph}>
          12.1 To the fullest extent permitted by applicable law, you agree to indemnify, defend, and hold harmless the Company and its affiliates, officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising out of or in connection with your access to or use of the Service; your User Content; your violation of these Terms; or your violation of any law or the rights of any third party.
        </Text>
        <Text style={styles.paragraph}>
          12.2 We reserve the right to assume the exclusive defense and control of any matter otherwise subject to indemnification by you, in which case you agree to cooperate with our defense of such claim.
        </Text>

        <Text style={styles.sectionTitle}>13. Disclaimers</Text>
        <Text style={styles.paragraph}>
          13.1 No warranty. To the fullest extent permitted by applicable law, the Service is provided “as is” and “as available” without warranties of any kind, whether express, implied, statutory, or otherwise, including implied warranties of merchantability, fitness for a particular purpose, title, and non-infringement.
        </Text>
        <Text style={styles.paragraph}>
          13.2 We do not warrant that the Service will be uninterrupted, timely, secure, or error-free; that any defects or errors will be corrected; that the Service will be compatible with your devices or operating environment; or that the information available through the Service will be accurate, complete, or reliable.
        </Text>
        <Text style={styles.paragraph}>
          13.3 You are solely responsible for your interactions with other users. We do not conduct background checks or verify user identities. Use caution and common sense in all interactions.
        </Text>
        <Text style={styles.paragraph}>
          13.4 Maintenance and Support. We are solely responsible for providing any maintenance and support services with respect to the Service, as specified in these Terms or as required under applicable law. You acknowledge that Apple and Google have no obligation whatsoever to furnish any maintenance or support services with respect to the Service.
        </Text>
        <Text style={styles.paragraph}>
          13.5 Warranty. We are solely responsible for any product warranties. In the event of any failure of the Service to conform to any applicable warranty, you may notify Apple (for iOS) or Google (for Android), and Apple or Google will refund the purchase price for the Service to you, if any was paid. To the maximum extent permitted by applicable law, Apple and Google will have no other warranty obligation whatsoever with respect to the Service.
        </Text>
        <Text style={styles.paragraph}>
          13.6 Product Claims. You acknowledge that we, not Apple or Google, are responsible for addressing any claims of yours or any third party relating to the Service or your possession or use of the Service, including product liability claims, any claim that the Service fails to conform to any applicable legal or regulatory requirement, and claims arising under consumer protection or similar legislation.
        </Text>

        <Text style={styles.sectionTitle}>14. Legal Compliance</Text>
        <Text style={styles.paragraph}>
          14.1 You represent and warrant that (i) you are not located in a country that is subject to a U.S. Government embargo, or that has been designated by the U.S. Government as a "terrorist supporting" country; and (ii) you are not listed on any U.S. Government list of prohibited or restricted parties.
        </Text>

        <Text style={styles.sectionTitle}>15. Limitation of Liability</Text>
        <Text style={styles.paragraph}>
          15.1 Nothing in these Terms is intended to exclude or limit any liability that cannot be excluded or limited under applicable law.
        </Text>
        <Text style={styles.paragraph}>
          15.2 To the fullest extent permitted by law, in no event shall the Company or its affiliates, officers, directors, employees, or agents be liable for any indirect, incidental, consequential, special, punitive, or exemplary damages, including loss of profits, business, goodwill, data, or other intangible losses, arising out of or in connection with your access to, use of, or inability to use the Service; or any damages resulting from the conduct of other users or third parties.
        </Text>
        <Text style={styles.paragraph}>
          15.3 To the fullest extent permitted by law, the total aggregate liability of the Company arising out of or relating to these Terms or the Service shall not exceed the amounts you have paid to us for use of the Service, if any, in the twelve (12) months preceding the event giving rise to the claim.
        </Text>

        <Text style={styles.sectionTitle}>16. Changes to the Service and to These Terms</Text>
        <Text style={styles.paragraph}>
          16.1 We may modify, suspend, or discontinue all or part of the Service at any time, with or without notice.
        </Text>
        <Text style={styles.paragraph}>
          16.2 We may update these Terms from time to time. When we do so, we will revise the “Last Updated” date at the top of the Terms and may provide additional notice where required by law or where we consider it appropriate.
        </Text>
        <Text style={styles.paragraph}>
          16.3 Your continued use of the Service after the effective date of updated Terms constitutes your acceptance of those Terms. If you do not agree to the updated Terms, you must stop using the Service.
        </Text>

        <Text style={styles.sectionTitle}>17. Governing Law and Dispute Resolution</Text>
        <Text style={styles.paragraph}>
          17.1 These Terms and any dispute arising out of or in connection with them or the Service shall be governed by and construed in accordance with the laws of the Province of Ontario and the federal laws of Canada applicable therein, without regard to its conflict of law rules.
        </Text>
        <Text style={styles.paragraph}>
          17.2 Any disputes arising under or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts located in Toronto, Ontario, Canada, except where applicable law provides you with mandatory rights to bring claims in other forums.
        </Text>

        <Text style={styles.sectionTitle}>18. Third-Party Beneficiary</Text>
        <Text style={styles.paragraph}>
          18.1 You acknowledge and agree that Apple, Google, and their respective subsidiaries are third-party beneficiaries of these Terms, and that upon your acceptance of these Terms, Apple and Google will have the right (and will be deemed to have accepted the right) to enforce these Terms against you as a third-party beneficiary thereof.
        </Text>

        <Text style={styles.sectionTitle}>19. Miscellaneous</Text>
        <Text style={styles.paragraph}>
          19.1 Entire agreement. These Terms constitute the entire agreement between you and the Company with respect to the Service and supersede any prior or contemporaneous agreements relating to the Service.
        </Text>
        <Text style={styles.paragraph}>
          19.2 Severability. If any provision of these Terms is held to be invalid or unenforceable, that provision will be enforced to the maximum extent permissible and the remaining provisions will remain in full force and effect.
        </Text>
        <Text style={styles.paragraph}>
          19.3 No waiver. Our failure to enforce any right or provision of these Terms shall not be deemed a waiver of such right or provision.
        </Text>
        <Text style={styles.paragraph}>
          19.4 Assignment. You may not assign or transfer these Terms or your rights and obligations under them without our prior written consent. We may assign or transfer these Terms, in whole or in part, without restriction.
        </Text>
        <Text style={styles.paragraph}>
          19.5 Developer Name and Address. For questions about these Terms, you may contact us at: Email: infotroupe1@gmail.com | Address: 58 Haynes Avenue, North York, Ontario M3J 0C1, Canada
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
  hostedLinkButton: {
    alignSelf: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 10,
    backgroundColor: COLORS.background,
  },
  hostedLinkButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primary,
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
