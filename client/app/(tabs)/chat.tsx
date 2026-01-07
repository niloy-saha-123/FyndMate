/**
 * @file client/app/(tabs)/chat.tsx
 * @description SKELETON SCREEN for Individual Chat Room.
 * 
 * TODO (DESIGN) - CRITICAL UI INSTRUCTIONS:
 * 1. **Message Bubbles**:
 *    - **Me (Right)**: Brand Color (e.g., Blue/Pink), White Text. Rounded corners (TopLeft, TopRight, BottomLeft).
 *    - **Other (Left)**: Grey Background, Black Text. Rounded corners (TopLeft, TopRight, BottomRight).
 * 
 * 2. **Input Bar**:
 *    - Sticky at bottom.
 *    - "Plus" icon for attachments (Photos/Gifs).
 *    - Send button should animate when text is typed.
 * 
 * 3. **Safety / Context**:
 *    - Top Bar: Show Avatar + Name.
 *    - Add a "Shield Icon" 🛡️ in top right for Report/Unmatch menu.
 *    - Show "Is Typing..." indicator (animated 3 dots).
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Button, FlatList, KeyboardAvoidingView, Platform } from 'react-native';

export default function ChatScreen() {
  const [text, setText] = useState("");
  const [messages, setMessages] = useState([
    { id: '1', text: "Hey! I saw you like hiking too!", sender: 'other', time: '10:00 AM' },
    { id: '2', text: "Yeah! I just went to Yosemite last week.", sender: 'me', time: '10:05 AM' }
  ]);

  const sendMessage = () => {
    if (!text) return;
    setMessages([...messages, { id: Date.now().toString(), text, sender: 'me', time: 'Now' }]);
    setText("");
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.sender === 'me';
    return (
      /* 
         TODO (DESIGN): BUBBLE STYLING
         - Use Flexbox to align Right (Me) or Left (Other).
         - Add timestamp in small font at bottom-right of bubble.
      */
      <View style={[
        styles.messageBubble,
        isMe ? styles.myBubble : styles.otherBubble
      ]}>
        <Text style={isMe ? styles.myText : styles.otherText}>{item.text}</Text>
        <Text style={styles.time}>{item.time}</Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.chatTitle}>Chat with Sarah</Text>
        {/* TODO (DESIGN): Shield Icon for Safety Tools */}
        <Button title="🛡️" onPress={() => alert("Open Safety Menu")} />
      </View>

      <FlatList
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
      />

      {/* 
               TODO (DESIGN): INPUT BAR 
               - Needs to look polished. Rounded input field.
               - Send button only active when text.length > 0
            */}
      <View style={styles.inputBar}>
        <Button title="+" onPress={() => { }} />
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Message..."
        />
        <Button title="Send" onPress={sendMessage} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 60 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  chatTitle: { fontSize: 18, fontWeight: 'bold' },
  messageList: { padding: 20 },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 20,
    marginBottom: 10
  },
  myBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 2
  },
  otherBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
    borderBottomLeftRadius: 2
  },
  myText: { color: 'white' },
  otherText: { color: 'black' },
  time: { fontSize: 10, marginTop: 5, alignSelf: 'flex-end', opacity: 0.7 },
  inputBar: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    alignItems: 'center',
    gap: 10
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8
  }
});
