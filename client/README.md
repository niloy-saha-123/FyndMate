# FyndMate Client 📱
**The mobile experience (React Native + Expo)**

---

## 🚀 Quick Start for Friends

To run the app on your phone:

### 1. Prerequisites
- Install **Node.js** (v18+).
- Install **Expo Go** on your physical phone (iOS App Store or Android Play Store).

### 2. Setup
```bash
npm install
```

### 3. Connect to the Server
By default, the app tries to connect to the server at `http://localhost:3000`. 
If you are running on your phone, you need to tell the app your laptop's local IP address.

1. Create a `.env` file:
   ```env
EXPO_PUBLIC_API_URL=http://YOUR_LAPTOP_IP:3000
EXPO_PUBLIC_SUPABASE_URL=http://YOUR_LAPTOP_IP:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
   *(You can find your laptop's IP by running `ifconfig` on Mac or `ipconfig` on Windows).*

### 4. Start Swiping!
```bash
npm start
```
- Open **Expo Go** on your phone.
- Scan the QR code printed in your terminal.

---

## 🛠 Features
- **Swipe Deck**: Tender-style card swiping for discovering project partners.
- **Real-time Messages**: Direct messaging with your matches.
- **GitHub Integration**: View developer activity and projects directly on their profiles.

## 📁 Project Structure
- `app/`: Expo Router file-based screens.
- `src/hooks/`: Custom React hooks for API and Socket.io.
- `src/services/`: API and Socket.io client setup.
- `src/components/`: Reusable UI components.

## 🤝 Need Help?
Check the [Root README](../README.md) for a full architecture overview or ask the team!
