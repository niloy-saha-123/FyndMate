import { Text, StyleSheet } from 'react-native';

export default function Chat() {
  return (
    <Text style = {styles.BI}>
      This is the chat page
    </Text>
  );
}

const styles = StyleSheet.create({
  BI:{
    color:'#000',
  }
});