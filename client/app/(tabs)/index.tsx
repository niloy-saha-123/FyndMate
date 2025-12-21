import { Text, StyleSheet } from 'react-native';

export default function HomeScreen() {
  return (
    <Text style = {styles.BI}>
      Hello World
    </Text>
  );
}

const styles = StyleSheet.create({
  BI:{
    color:'#000',
  }
});