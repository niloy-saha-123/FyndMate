import { Text, StyleSheet, View } from 'react-native';

export default function Community() {
  return (
    <View style = {styles.BI}>
      <Text>
        This is the Community page
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