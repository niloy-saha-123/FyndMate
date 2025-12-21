import { Stack } from 'expo-router';
import 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {

  return (
      
        <SafeAreaView style={styles.statusbar}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
        </SafeAreaView>
      
  );
}

const styles = StyleSheet.create({
  statusbar:{
    flex: 1,
    backgroundColor:'#000',
  }
});