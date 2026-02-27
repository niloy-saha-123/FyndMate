# FyndMate 🚀
**Tinder for finding project partners**

---

## 🚀 Quick Start for Friends

If you just joined and want to see the app running on your phone, follow these steps:

### 1. Prerequesites
- Install **Docker Desktop** (Required for the local database).
- Install **Node.js** (v18+).
- Install **Expo Go** on your phone (Available on iOS/Android).

### 2. Setup the Server (Local DB)
```bash
cd server
npm install
npx supabase start      # Starts the local database
npm run test:setup      # Creates .env.test and pushes schema
npm run db:local:seed   # Creates Alice, Bob, and other test users
npm run dev             # Starts the API server
```

### 3. Setup the Client
```bash
cd client
npm install
npx expo start --go     # Scans the QR code with your phone!
```

> [!IMPORTANT]
> Make sure your phone and laptop are on the same Wi-Fi network so the app can talk to the server!

---

## 🏗 Architecture Overview

FyndMate uses a **Supabase + Fastify Hybrid** architecture designed for rapid MVP development while maintaining flexibility for future scaling (e.g., migrating to Go).

### Responsibility Split

| Layer | Technology | Responsibilities |
|-------|------------|------------------|
| **Auth & Storage** | Supabase | User authentication, PostgreSQL hosting, image/file storage |
| **Core Logic** | Fastify (Node.js) | Swiping logic, match algorithms, feed generation, Socket.io messaging |
| **Real-time Messages** | Socket.io | Direct WebSocket connections (NOT Supabase Realtime) |
| **Database Access** | Prisma ORM | Type-safe queries against Supabase PostgreSQL |

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SUPABASE (BaaS)                              │
│  ┌─────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │  Supabase   │  │    Supabase     │  │      Supabase           │  │
│  │    Auth     │  │    Storage      │  │      PostgreSQL         │  │
│  │  (Sign up,  │  │  (Profile pics, │  │  (Users, Matches, etc.) │  │
│  │   Login)    │  │   Projects)     │  │                         │  │
│  └─────────────┘  └─────────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ JWT Token + Direct DB Connection
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     FASTIFY SERVER (Node.js)                        │
│  ┌─────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │   Auth      │  │    Business     │  │      Socket.io          │  │
│  │ Middleware  │  │     Logic       │  │     (Real-time)         │  │
│  │  (Verify    │  │  (Swiping,      │  │  (Message stream,        │  │
│  │   Supabase  │  │   Matching,     │  │   typing indicators)    │  │
│  │   tokens)   │  │   Feed)         │  │                         │  │
│  └─────────────┘  └─────────────────┘  └─────────────────────────┘  │
│                              │                                      │
│                     Prisma ORM (Type-safe DB access)                │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      MOBILE APP (React Native)                      │
│              Expo + Supabase JS SDK + Socket.io Client              │
└─────────────────────────────────────────────────────────────────────┘
```

**Why this hybrid approach?**
- **Supabase**: Fast to set up auth, storage, and hosted Postgres — no AWS configuration
- **Fastify**: Keeps complex business logic in TypeScript, easy to migrate to Go later
- **Socket.io on Fastify**: Full control over messaging logic (not limited by Supabase Realtime)

---

## Tech Stack

### Frontend (Client)
- **React Native** with **Expo** (SDK 54) - Cross-platform mobile development
- **TypeScript** - Type safety
- **Expo Router** - File-based routing
- **React Navigation** - Navigation stack
- **React Native Gesture Handler** - Swipe gestures (left/right)
- **React Native Reanimated** - Smooth animations for card swipes
- **@supabase/supabase-js** - Auth, storage, and database client
- **Socket.io-client** - Real-time messaging (connects to Fastify server)
- **React Query/TanStack Query** - API state management and caching
- **Expo Image Picker** - Profile picture upload
- **React Native Chart Kit** or **Victory Native** - GitHub activity graph visualization

### Backend (Server)
- **Node.js** with **Fastify** - High-performance REST API server
- **TypeScript** - Type safety on backend
- **Prisma ORM** - Database access layer and migrations
- **@supabase/supabase-js** - Token verification and storage uploads
- **Socket.io** - WebSocket server for real-time messaging
- **GitHub API v4 (GraphQL)** - Fetch developer activity and contributions

**Why Fastify?**
- Scalable and high-performance
- Real-time ready with Socket.io
- Mobile-friendly API design
- Built-in request/response validation (JSON Schema)
- Easy to replace with Go later if needed

### Infrastructure & Services
- **Supabase Auth** - Authentication provider (email, OAuth, magic links)
- **Supabase Storage** - Image storage (profile pictures, project screenshots)
- **Supabase PostgreSQL** - Managed database (production)
- **Socket.io** - Real-time communication (on Fastify, NOT Supabase Realtime)
- **GitHub API** - Developer activity data

---

## Dependencies Guide

### Client Dependencies (`client/package.json`)

#### Core (Always Required)

| Package | Purpose | When to Use |
|---------|---------|-------------|
| `expo` | Core Expo framework that provides build tools, native APIs, and development server | Required for any Expo project. Provides access to device features (camera, notifications, etc.) without native code |
| `react` | UI library for building component-based interfaces | Core dependency - always required |
| `react-native` | Framework for building native mobile apps using React | Core dependency - always required for mobile development |
| `expo-status-bar` | Controls the app's status bar appearance (color, visibility) | Use when you need to customize the status bar per screen (e.g., light text on dark headers) |
| `typescript` | Adds static typing to JavaScript | Development dependency - catches errors at compile time, improves IDE support |
| `@types/react` | TypeScript type definitions for React | Required when using TypeScript with React |

#### Navigation (Install When Needed)

| Package | Purpose | When to Use |
|---------|---------|-------------|
| `expo-router` | File-based routing similar to Next.js | Use for navigation - create files in `app/` folder and they become routes automatically |
| `@react-navigation/native` | Core navigation library | Required by expo-router, handles navigation state and gestures |
| `@react-navigation/bottom-tabs` | Bottom tab navigator component | Use for the main app tabs (Home, Matches, Messages, Profile) |

#### Swipe & Animations (Phase 3)

| Package | Purpose | When to Use |
|---------|---------|-------------|
| `react-native-gesture-handler` | Handles touch gestures (swipe, pan, pinch) | Use for swipeable developer cards - detects left/right swipe gestures |
| `react-native-reanimated` | High-performance animations library | Use for smooth card animations when swiping, spring effects, and transitions |

#### Data & State Management (Phase 2+)

| Package | Purpose | When to Use |
|---------|---------|-------------|
| `@tanstack/react-query` | Server state management with caching | Use for API calls - handles loading states, caching, refetching, and error states automatically |
| `axios` | HTTP client for API requests | Use for making REST API calls to the server (can also use fetch) |

#### Authentication & Supabase (Phase 1)

| Package | Purpose | When to Use |
|---------|---------|-------------|
| `@supabase/supabase-js` | Supabase client for auth, storage, and database | Use for user login/signup, uploading images, and direct database access if needed |
| `expo-secure-store` | Secure storage for sensitive data | Use to persist Supabase session tokens securely on device |

#### Real-time Messaging (Phase 4)

| Package | Purpose | When to Use |
|---------|---------|-------------|
| `socket.io-client` | WebSocket client for real-time communication | Use for instant messaging - connects to Fastify server's Socket.io for live message updates |

#### Media & Files (Phase 2)

| Package | Purpose | When to Use |
|---------|---------|-------------|
| `expo-image-picker` | Access device camera and photo library | Use when users upload profile pictures or project screenshots |

#### Charts & Visualization (Phase 5)

| Package | Purpose | When to Use |
|---------|---------|-------------|
| `react-native-chart-kit` | Charts and graphs for React Native | Use for GitHub activity heatmap/contribution graph visualization |
| `victory-native` | Alternative charting library (more customizable) | Use if react-native-chart-kit doesn't meet design needs |

---

### Server Dependencies (`server/package.json`)

#### Core Framework (Always Required)

| Package | Purpose | When to Use |
|---------|---------|-------------|
| `fastify` | High-performance web framework (faster than Express) | Core server framework - handles HTTP requests, routing, and middleware |
| `@fastify/cors` | Cross-Origin Resource Sharing plugin | Required for mobile app to communicate with server - allows requests from different origins |
| `dotenv` | Loads environment variables from `.env` file | Required for configuration - keeps secrets out of code |
| `typescript` | Static typing for JavaScript | Development dependency - type safety and better IDE support |
| `tsx` | TypeScript execution and watch mode | Development dependency - runs TypeScript directly without compiling, hot reloads on file changes |
| `@types/node` | TypeScript definitions for Node.js | Required for TypeScript to understand Node.js APIs |

#### Authentication & Supabase (Phase 1)

| Package | Purpose | When to Use |
|---------|---------|-------------|
| `@supabase/supabase-js` | Supabase client for token verification and storage | Use in auth middleware to verify JWT tokens, and in services to upload files to Supabase Storage |

#### Database (Phase 1)

| Package | Purpose | When to Use |
|---------|---------|-------------|
| `@prisma/client` | Auto-generated database client | Use for all database operations - type-safe queries, creates, updates, deletes |
| `@prisma/adapter-pg` | PostgreSQL driver adapter for Prisma 7 | Required for Prisma 7 to connect to PostgreSQL |
| `pg` | PostgreSQL client for Node.js | Required by @prisma/adapter-pg |
| `prisma` | Database toolkit (migrations, studio) | Development dependency - run `prisma migrate` for schema changes, `prisma studio` for GUI |

#### File Uploads (Phase 2)

| Package | Purpose | When to Use |
|---------|---------|-------------|
| `@fastify/multipart` | Handles multipart/form-data requests | Use when receiving file uploads (profile pictures, project images) from the app |

*Note: Files are uploaded to Supabase Storage, not AWS S3*

#### Real-time Communication (Phase 4)

| Package | Purpose | When to Use |
|---------|---------|-------------|
| `socket.io` | WebSocket server for bidirectional communication | Use for real-time messaging - sends instant message updates to connected clients |
| `@fastify/websocket` | WebSocket support for Fastify | Use as foundation for Socket.io or native WebSocket connections |

#### External APIs (Phase 2)

| Package | Purpose | When to Use |
|---------|---------|-------------|
| `@octokit/graphql` | GitHub GraphQL API client | Use to fetch GitHub profile data, contribution graphs, and repository info |

---

## Environment Variables

### Client (`client/.env`)

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_API_URL=http://localhost:3000/api
EXPO_PUBLIC_SOCKET_URL=http://localhost:3000
```

### Server (`server/.env`)

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # For admin operations

# Database (Supabase PostgreSQL)
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres

# Server
PORT=3000
NODE_ENV=development

# GitHub OAuth (optional)
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

**Database URL Notes:**
- `DATABASE_URL`: Use the **Transaction pooler** (port 6543) for Prisma queries
- `DIRECT_URL`: Use the **Session mode** (port 5432) for Prisma migrations

---

## When to Install What (By Phase)

### Phase 1: Foundation
```bash
# Client
cd client && npm install @supabase/supabase-js expo-secure-store

# Server - already installed
```

### Phase 2: Core Features
```bash
# Client
cd client && npm install expo-image-picker @tanstack/react-query axios

# Server (already installed)
# @octokit/graphql is pre-installed
```

### Phase 3: Matching System
```bash
# Client
cd client && npm install react-native-gesture-handler react-native-reanimated
```

### Phase 4: Messaging
```bash
# Client
cd client && npm install socket.io-client
```

### Phase 5: Polish
```bash
# Client
cd client && npm install react-native-chart-kit
# or
cd client && npm install victory-native
```

---

## Server Folder Architecture

| Folder | Purpose | Example |
|--------|---------|---------|
| `lib/` | Singleton instances and shared utilities | `prisma.ts` - Prisma client singleton, `supabase.ts` - Supabase client |
| `middleware/` | Request middleware (auth, validation) | `auth.middleware.ts` - verifies Supabase JWT tokens |
| `routes/` | Define API endpoints and attach controllers | `users.routes.ts` - GET /users/:id, PUT /users/:id |
| `controllers/` | Handle HTTP request/response logic | `users.controller.ts` - validates input, calls service, returns response |
| `services/` | Business logic, database operations | `matching.service.ts` - algorithm to find compatible developers |
| `schemas/` | JSON Schema for request/response validation | `users.schema.ts` - defines shape of user create/update requests |
| `utils/` | Helper functions and constants | `logger.ts` - custom logging utility |

### Data Flow

```
Request → Route → Auth Middleware → Schema Validation → Controller → Service → Database
                                                                        ↓
Response ← Controller ← Service Result ←────────────────────────────────┘
```

---

## Project Structure

```
FyndMate/
├── client/                        # Frontend (React Native/Expo)
│   ├── app/
│   │   ├── _layout.tsx            # Root layout with Supabase provider
│   │   ├── (auth)/
│   │   │   ├── login.tsx          # Login screen
│   │   │   └── _layout.tsx
│   │   ├── (tabs)/
│   │   │   ├── index.tsx          # Main swipe/matching screen
│   │   │   ├── matches.tsx        # Matches list
│   │   │   ├── messages.tsx       # Messages/conversations list
│   │   │   ├── profile.tsx        # User's own profile
│   │   │   └── _layout.tsx        # Bottom tab navigator
│   │   ├── messages/[id].tsx          # Individual message screen
│   │   └── profile/[id].tsx       # View other user's profile
│   ├── src/
│   │   ├── components/
│   │   │   ├── DeveloperCard.tsx  # Swipeable card component
│   │   │   ├── ProfileHeader.tsx  # Profile picture and basic info
│   │   │   ├── ExperienceSection.tsx
│   │   │   ├── SkillsSection.tsx
│   │   │   ├── ProjectsSection.tsx
│   │   │   ├── GitHubActivityGraph.tsx
│   │   │   ├── SwipeButtons.tsx   # Like/pass buttons
│   │   │   ├── MessageList.tsx    # Message list
│   │   │   └── MessageInput.tsx   # Message input component
│   │   ├── hooks/
│   │   │   ├── useAuth.ts         # Supabase auth hook wrapper
│   │   │   ├── useMatches.ts      # Fetch matches
│   │   │   ├── useDevelopers.ts   # Fetch developer cards
│   │   │   ├── useMessages.ts     # Message stream hook
│   │   │   ├── useSocket.ts       # Socket.io connection
│   │   │   └── useGitHubActivity.ts # GitHub API hook
│   │   ├── lib/
│   │   │   └── supabase.ts        # Supabase client singleton
│   │   ├── services/
│   │   │   ├── api.ts             # Axios instance with auth
│   │   │   ├── socket.ts          # Socket.io client setup
│   │   │   └── github.ts          # GitHub API service
│   │   ├── types/
│   │   │   ├── user.ts            # User/Developer types
│   │   │   ├── match.ts           # Match types
│   │   │   └── message.ts         # Message types
│   │   └── utils/
│   │       ├── constants.ts
│   │       └── helpers.ts
│   ├── assets/
│   ├── App.tsx
│   ├── index.ts
│   ├── app.json
│   ├── package.json
│   ├── package-lock.json
│   └── tsconfig.json
│
└── server/                         # Backend API (Node.js/Fastify)
    ├── src/
    │   ├── lib/                      # Singleton instances
    │   │   ├── prisma.ts             # Prisma client (singleton pattern)
    │   │   └── supabase.ts           # Supabase admin client
    │   ├── middleware/               # Request middleware
    │   │   └── auth.middleware.ts    # Verify Supabase JWT tokens
    │   ├── routes/                   # Route definitions
    │   │   ├── auth.routes.ts
    │   │   ├── users.routes.ts
    │   │   ├── matches.routes.ts
    │   │   ├── messages.routes.ts
    │   │   └── github.routes.ts
    │   ├── controllers/              # Request handlers
    │   │   ├── auth.controller.ts
    │   │   ├── users.controller.ts
    │   │   ├── matches.controller.ts
    │   │   ├── messages.controller.ts
    │   │   └── github.controller.ts
    │   ├── services/                 # Business logic
    │   │   ├── auth.service.ts
    │   │   ├── matching.service.ts   # Matching algorithm
    │   │   ├── github.service.ts     # GitHub API integration
    │   │   └── storage.service.ts    # Supabase Storage uploads
    │   ├── schemas/                  # Request/response validation (JSON Schema)
    │   │   ├── auth.schema.ts
    │   │   ├── users.schema.ts
    │   │   ├── matches.schema.ts
    │   │   ├── messages.schema.ts
    │   │   └── github.schema.ts
    │   ├── utils/
    │   │   ├── logger.ts
    │   │   └── constants.ts
    │   ├── app.ts                    # Fastify instance setup
    │   └── server.ts                 # Server entry point with Socket.io
    ├── generated/
    │   └── prisma/                   # Generated Prisma client (from prisma generate)
    ├── prisma/
    │   ├── schema.prisma             # Database schema
    │   └── migrations/
    ├── prisma.config.ts              # Prisma CLI configuration
    ├── .env.example
    ├── package.json
    ├── package-lock.json
    └── tsconfig.json
```

---

## API Endpoints

### Authentication (`/api/auth`)
- `POST /api/auth/callback` - Handle Supabase auth callback (sync user to DB)
- `GET /api/auth/me` - Get current user profile

### Users (`/api/users`)
- `GET /api/users/:id` - Get user profile
- `PUT /api/users/:id` - Update user profile
- `POST /api/users/:id/profile-picture` - Upload profile picture (to Supabase Storage)
- `GET /api/users/feed` - Get developers to swipe (exclude already swiped/matched)

### Matches (`/api/matches`)
- `GET /api/matches` - Get all matches for current user
- `POST /api/matches/swipe` - Swipe left (pass) or right (like)
- `GET /api/matches/:id` - Get specific match details

### Messages (`/api/messages`)
- `GET /api/messages/match/:matchId` - Get messages for a match
- `POST /api/messages` - Send message (also via Socket.io)
- `PUT /api/messages/:id/read` - Mark message as read

### GitHub (`/api/github`)
- `GET /api/github/activity/:username` - Get GitHub activity graph
- `POST /api/github/sync` - Sync GitHub data for current user

### Real-time Events (Socket.io)

#### Client → Server
- `join_match:matchId` - Join a match's room
- `send_message` - Send message: `{ matchId, content }`
- `typing` - Typing indicator: `{ matchId, isTyping }`

#### Server → Client
- `new_message` - New message received: `{ message }`
- `message_sent` - Confirmation: `{ message }`
- `user_typing` - Typing indicator: `{ userId, isTyping }`
- `match_created` - New match notification: `{ match }`

---

## Implementation Phases

### Phase 1: Foundation
1. Set up Supabase project (Auth, Database, Storage)
2. Configure Prisma with Supabase PostgreSQL
3. Create database schema and migrations
4. Set up Supabase Auth integration (client + server middleware)
5. Basic user registration/profile creation

### Phase 2: Core Features
1. Developer profile creation/editing
2. Image upload to Supabase Storage
3. GitHub OAuth integration
4. GitHub API service (fetch activity graph)
5. Developer feed API (exclude swiped users)

### Phase 3: Matching System
1. Swipe functionality (like/pass)
2. Matching algorithm
3. Matches list/view
4. Swipeable card UI component

### Phase 4: Messaging
1. Socket.io server setup (on Fastify)
2. Real-time messaging implementation
3. Message UI components
4. Message persistence
5. Read receipts

### Phase 5: Polish & Optimization
1. GitHub activity graph visualization
2. Projects section display
3. Performance optimization
4. Error handling
5. Testing
