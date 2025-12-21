# FyndMate
Tinder for finding project partners

## Tech Stack

### Frontend (Client)
- **React Native** with **Expo** (SDK 54) - Cross-platform mobile development
- **TypeScript** - Type safety
- **Expo Router** - File-based routing
- **React Navigation** - Navigation stack
- **React Native Gesture Handler** - Swipe gestures (left/right)
- **React Native Reanimated** - Smooth animations for card swipes
- **Socket.io-client** - Real-time messaging
- **React Query/TanStack Query** - API state management and caching
- **Expo Image Picker** - Profile picture upload
- **React Native Chart Kit** or **Victory Native** - GitHub activity graph visualization

### Backend (Server)
- **Node.js** with **Fastify** - High-performance REST API server
- **TypeScript** - Type safety on backend
- **PostgreSQL** - Primary database (via AWS RDS or local)
- **Prisma ORM** - Database access layer and migrations
- **Socket.io** (Fastify adapter) - WebSocket server for real-time messaging
- **Auth0** - Authentication and authorization
- **JWT** - Token-based authentication
- **GitHub API v4 (GraphQL)** - Fetch developer activity and contributions
- **AWS S3** - Profile picture storage

**Why Fastify?**
- Scalable and high-performance
- Real-time ready with Socket.io adapter
- Mobile-friendly API design
- Built-in request/response validation (JSON Schema)
- Easy to replace with Go later if needed

### Infrastructure & Services
- **Auth0** - Authentication provider
- **AWS S3** - Image storage
- **AWS RDS PostgreSQL** - Managed database (production)
- **Socket.io** - Real-time communication
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

#### Real-time Messaging (Phase 4)

| Package | Purpose | When to Use |
|---------|---------|-------------|
| `socket.io-client` | WebSocket client for real-time communication | Use for instant messaging - connects to server's Socket.io for live message updates |

#### Media & Files (Phase 2)

| Package | Purpose | When to Use |
|---------|---------|-------------|
| `expo-image-picker` | Access device camera and photo library | Use when users upload profile pictures or project screenshots |

#### Charts & Visualization (Phase 5)

| Package | Purpose | When to Use |
|---------|---------|-------------|
| `react-native-chart-kit` | Charts and graphs for React Native | Use for GitHub activity heatmap/contribution graph visualization |
| `victory-native` | Alternative charting library (more customizable) | Use if react-native-chart-kit doesn't meet design needs |

#### Authentication (Phase 1)

| Package | Purpose | When to Use |
|---------|---------|-------------|
| `expo-auth-session` | OAuth authentication flows in Expo | Use for Auth0 login - handles redirect URLs and token exchange |
| `expo-secure-store` | Secure storage for sensitive data | Use to store JWT tokens securely on device (encrypted) |

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

#### Authentication & Security (Phase 1)

| Package | Purpose | When to Use |
|---------|---------|-------------|
| `@fastify/jwt` | JWT token generation and verification | Use for creating and validating access tokens after Auth0 login |
| `auth0` | Auth0 Management API client | Use for verifying Auth0 tokens and fetching user metadata from Auth0 |

#### Database (Phase 1)

| Package | Purpose | When to Use |
|---------|---------|-------------|
| `@prisma/client` | Auto-generated database client | Use for all database operations - type-safe queries, creates, updates, deletes |
| `prisma` | Database toolkit (migrations, studio) | Development dependency - run `prisma migrate` for schema changes, `prisma studio` for GUI |

#### File Uploads (Phase 2)

| Package | Purpose | When to Use |
|---------|---------|-------------|
| `@fastify/multipart` | Handles multipart/form-data requests | Use when receiving file uploads (profile pictures, project images) from the app |
| `@aws-sdk/client-s3` | AWS S3 client for file storage | Use to upload images to S3 bucket and generate access URLs |

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

## When to Install What (By Phase)

### Phase 1: Foundation
```bash
# Client - already installed
# Server - already installed
```

### Phase 2: Core Features
```bash
# Client
cd client && npm install expo-image-picker @tanstack/react-query axios

# Server (already installed)
# @aws-sdk/client-s3, @octokit/graphql are pre-installed
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
| `plugins/` | Fastify plugins that extend functionality | `prisma.plugin.ts` - decorates Fastify with Prisma client |
| `routes/` | Define API endpoints and attach controllers | `users.routes.ts` - GET /users/:id, PUT /users/:id |
| `controllers/` | Handle HTTP request/response logic | `users.controller.ts` - validates input, calls service, returns response |
| `services/` | Business logic, database operations | `matching.service.ts` - algorithm to find compatible developers |
| `schemas/` | JSON Schema for request/response validation | `users.schema.ts` - defines shape of user create/update requests |
| `utils/` | Helper functions and constants | `logger.ts` - custom logging utility |

### Data Flow

```
Request → Route → Schema Validation → Controller → Service → Database
                                                      ↓
Response ← Controller ← Service Result ←─────────────┘
```

## Project Structure

```
FyndMate/
├── client/                        # Frontend (React Native/Expo)
│   ├── app/
│   │   ├── _layout.tsx            # Root layout with Auth0 provider
│   │   ├── (auth)/
│   │   │   ├── login.tsx          # Login screen
│   │   │   └── _layout.tsx
│   │   ├── (tabs)/
│   │   │   ├── index.tsx          # Main swipe/matching screen
│   │   │   ├── matches.tsx        # Matches list
│   │   │   ├── messages.tsx       # Messages/conversations list
│   │   │   ├── profile.tsx        # User's own profile
│   │   │   └── _layout.tsx        # Bottom tab navigator
│   │   ├── chat/[id].tsx          # Individual chat screen
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
│   │   │   ├── MessageList.tsx    # Chat message list
│   │   │   └── MessageInput.tsx   # Chat input component
│   │   ├── hooks/
│   │   │   ├── useAuth.ts         # Auth0 hook wrapper
│   │   │   ├── useMatches.ts      # Fetch matches
│   │   │   ├── useDevelopers.ts   # Fetch developer cards
│   │   │   ├── useMessages.ts     # Chat messages hook
│   │   │   ├── useSocket.ts       # Socket.io connection
│   │   │   └── useGitHubActivity.ts # GitHub API hook
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
    │   ├── plugins/                  # Fastify plugins
    │   │   ├── auth.plugin.ts        # Auth0 JWT plugin
    │   │   ├── prisma.plugin.ts      # Prisma client plugin
    │   │   ├── socket.plugin.ts      # Socket.io plugin
    │   │   └── jwt.plugin.ts         # JWT utilities plugin
    │   ├── routes/                    # Route definitions
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
    │   ├── services/                  # Business logic
    │   │   ├── auth.service.ts
    │   │   ├── matching.service.ts    # Matching algorithm
    │   │   ├── github.service.ts      # GitHub API integration
    │   │   └── s3.service.ts          # AWS S3 upload
    │   ├── schemas/                   # Request/response validation (JSON Schema)
    │   │   ├── auth.schema.ts
    │   │   ├── users.schema.ts
    │   │   ├── matches.schema.ts
    │   │   ├── messages.schema.ts
    │   │   └── github.schema.ts
    │   ├── utils/
    │   │   ├── logger.ts
    │   │   └── constants.ts
    │   ├── app.ts                     # Fastify instance setup
    │   └── server.ts                  # Server entry point with Socket.io
    ├── prisma/
    │   ├── schema.prisma              # Database schema
    │   └── migrations/
    ├── .env.example
    ├── package.json
    ├── package-lock.json
    └── tsconfig.json
```

## API Endpoints

### Authentication (`/api/auth`)
- `POST /api/auth/login` - Auth0 callback handler
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Users (`/api/users`)
- `GET /api/users/:id` - Get user profile
- `PUT /api/users/:id` - Update user profile
- `POST /api/users/:id/profile-picture` - Upload profile picture
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

## Implementation Phases

### Phase 1: Foundation
1. Set up backend structure (Fastify + TypeScript)
2. Configure Prisma with PostgreSQL
3. Create database schema and migrations
4. Set up Auth0 integration (backend + frontend)
5. Basic user registration/profile creation

### Phase 2: Core Features
1. Developer profile creation/editing
2. Image upload to S3
3. GitHub OAuth integration
4. GitHub API service (fetch activity graph)
5. Developer feed API (exclude swiped users)

### Phase 3: Matching System
1. Swipe functionality (like/pass)
2. Matching algorithm
3. Matches list/view
4. Swipeable card UI component

### Phase 4: Messaging
1. Socket.io server setup
2. Real-time messaging implementation
3. Chat UI components
4. Message persistence
5. Read receipts

### Phase 5: Polish & Optimization
1. GitHub activity graph visualization
2. Projects section display
3. Performance optimization
4. Error handling
5. Testing