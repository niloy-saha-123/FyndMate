import { Text, StyleSheet, View, TouchableOpacity } from "react-native";
import { supabase } from "../../src/auth/supabaseClient";
import { router } from "expo-router";

export default function HomeScreen() {
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.log("LOGOUT ERROR:", error.message);
      return;
    }

    router.replace("/login");   
  };

  return (
    <View style={styles.BI}>
      <Text>Hello World</Text>

      <TouchableOpacity style={styles.button} onPress={handleLogout}>
        <Text style={styles.buttonText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  BI: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
 gap: 20
  },
  button: {
    marginTop: 20,
    backgroundColor: "#ff3b30",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
