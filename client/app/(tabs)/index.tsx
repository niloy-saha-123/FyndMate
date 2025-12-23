import { Text, StyleSheet, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style = {styles.BI}>
      <Text>
        Hello World
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  BI:{
    color:'#000',
    flex: 1,
    justifyContent:"center",
    alignItems: 'center'
  }
});