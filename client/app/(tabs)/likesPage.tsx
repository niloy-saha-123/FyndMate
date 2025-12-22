import { Text, StyleSheet } from 'react-native';

export default function likesPage() {
  return (
    <Text style = {styles.BI}>
      This is the Likes Page
    </Text>
  );
}

const styles = StyleSheet.create({
  BI:{
    color:'#000',
  }
});