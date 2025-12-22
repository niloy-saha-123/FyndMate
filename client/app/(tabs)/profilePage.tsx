import { Text, StyleSheet } from 'react-native';

export default function ProfilePage() {
  return (
    <Text style = {styles.BI}>
      This is the Profile page
    </Text>
  );
}

const styles = StyleSheet.create({
  BI:{
    color:'#000',
  }
});