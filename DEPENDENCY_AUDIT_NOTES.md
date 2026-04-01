# Dependency Audit Notes

> Generated from `depcheck` audit.  
> Action: **Do not remove yet**. Keep for manual verification.

## Client (`client/package.json`)

### Unused candidates (dependencies)
- `@react-native-google-signin/google-signin`
- `expo-auth-session`
- `expo-random`
- `expo-status-bar`
- `install`
- `lottie-react-native`

### Unused candidates (devDependencies)
- `@babel/core`
- `@expo/ngrok`
- `typescript`

### Missing package flags from depcheck (for follow-up)
- `react-native-svg`
- `@react-navigation/native`
- `@react-navigation/elements`
- `@react-navigation/bottom-tabs`

## Server (`server/package.json`)

### Unused candidates (dependencies)
- `@octokit/graphql`
- `@prisma/adapter-pg`
- `pg`

### Unused candidates (devDependencies)
- `cuid`

### Notes
- `axios` is intentionally retained and currently pinned in server:
  - `server/package.json`: `^1.13.2`
- No dependency removals have been made in this pass.
