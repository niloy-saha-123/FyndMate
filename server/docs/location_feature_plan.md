# Location‑in‑Profile Implementation Plan

**Goal**: Automatically capture a user’s city and country (derived from device GPS) and display it on their profile. Users can choose when the app may read their location: **Always**, **Only while the app is open**, or **Never**.

---

## 1️⃣  Database Changes (Prisma)

```prisma
model User {
  // existing fields …
  city            String?   // e.g. "San Francisco"
  country         String?   // e.g. "USA"
  latitude        Float?    // optional – kept for future use
  longitude       Float?    // optional – kept for future use
  locationSharing String    @default("whileOpen") // "always" | "whileOpen" | "never"
}
```

1. Add the columns above to `prisma/schema.prisma`.
2. Run migration:
   ```bash
   npx prisma migrate dev --name add-location-fields
   ```
3. Regenerate client:
   ```bash
   npx prisma generate
   ```

---

## 2️⃣  Backend API (Fastify)

| Method | URL | Body | Description |
|--------|-----|------|-------------|
| **PATCH** | `/users/me/location` | `{ city, country, latitude?, longitude?, locationSharing? }` | Updates the user’s location fields and the sharing preference. |
| **GET** | `/users/:id` (or `/profile/:id`) | – | Returns profile data **including** `city`/`country` only if `locationSharing` is not `"never"` (or if the requester is the same user). |

**Implementation notes**
- Use existing `authMiddleware` to get `req.user.id`.
- Validate non‑empty `city`/`country` (max 100 chars).
- If `locationSharing` changes, store the new value.
- Return the updated user object.

---

## 3️⃣  Client‑Side (React‑Native / Expo)

### 3.1 Packages
```bash
expo install expo-location
```
(If you are not on Expo, use `@react-native-community/geolocation` + `react-native-permissions`.)

### 3.2 Permission & Fetch Hook (`useLocation.ts`)
```tsx
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { updateLocationOnServer } from '@/src/services/api'; // implement this API call

export const useLocation = (userId: string) => {
  const [pref, setPref] = useState<'always' | 'whileOpen' | 'never'>('whileOpen');

  const requestPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Location permission is required to show your city/country.');
      return false;
    }
    return true;
  };

  const fetchAndSend = async () => {
    if (!(await requestPermission())) return;
    const { coords } = await Location.getCurrentPositionAsync({});
    const { latitude, longitude } = coords;

    // ---- Reverse‑geocode (OpenStreetMap Nominatim, free) ----
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
    );
    const data = await resp.json();
    const city = data.address.city || data.address.town || data.address.village || '';
    const country = data.address.country || '';

    await updateLocationOnServer({
      city,
      country,
      latitude,
      longitude,
      locationSharing: pref,
    });
  };

  // Run on app start / when preference changes
  useEffect(() => {
    if (pref === 'always' || pref === 'whileOpen') {
      fetchAndSend();
    }
  }, [pref]);

  return { pref, setPref };
};
```

### 3.3 Settings UI
Create a simple screen under `Settings → Location` with three radio buttons:
- **Always** – request location on every launch (foreground).  
- **While App Open** – request only when the app is in the foreground (default).  
- **Never** – do not request; hide location on profile.

Persist the choice locally (AsyncStorage) and also send it to the server via the same PATCH endpoint.

### 3.4 Updating When User Moves
- **Simple**: each time the app is opened (or user pulls‑to‑refresh profile) run `fetchAndSend`. If the city/country changed, the server updates the profile.
- **Optional “significant move”**: store the last latitude/longitude in AsyncStorage; compute distance (Haversine) and only call the server if distance > ~ 100 km.

---

## 4️⃣  Privacy & Legal Checklist
1. Add `NSLocationWhenInUseUsageDescription` (and optionally `NSLocationAlwaysAndWhenInUseUsageDescription`) to **Info.plist** for iOS.
2. Add `ACCESS_FINE_LOCATION` permission to **AndroidManifest.xml**.
3. Show a short modal before the first permission request explaining why the location is needed.
4. Respect the `locationSharing` flag – never return `city`/`country` when it is `"never"`.
5. All API calls must be over HTTPS (already the case).

---

## 5️⃣  Testing Strategy
| Layer | Test | Goal |
|------|------|------|
| Unit | `useLocation` hook | Permission handling, reverse‑geocode call, payload shape. |
| Integration | PATCH `/users/me/location` | DB updates correctly, respects validation, returns updated user. |
| E2E (mobile) | Simulate grant/deny, change preference, open app in a new location (mock provider). | Verify UI flow and server update. |
| Privacy | When `locationSharing = "never"` the profile endpoint omits `city`/`country`. |
| Performance | Reverse‑geocode completes within 3 s; fallback to cached city if API is slow. |

---

## 6️⃣  Roll‑out Timeline (≈ 9 weeks)
| Week | Activity |
|------|----------|
| 1 | Add DB columns, run migration, generate Prisma client. |
| 2 | Implement PATCH endpoint, update profile serializer. |
| 3 | Build `useLocation` hook and permission UI. |
| 4 | Add Settings screen for location preference. |
| 5 | Integrate reverse‑geocode (choose Nominatim or Google). |
| 6 | Write unit & integration tests, run locally. |
| 7 | QA on iOS & Android devices, test permission flows. |
| 8 | Deploy behind feature flag (`locationFeatureEnabled`). |
| 9 | Enable flag for a small user segment, monitor logs, then full rollout. |

---

## 7️⃣  Optional Future Enhancements
- Background location updates (iOS “Always” + background mode).  
- Cache reverse‑geocode results for a few hours to reduce external calls.  
- Store a simple **location history** table for travel badges.  
- Allow manual override of city/country for users who prefer a custom value.

---

**Next steps**: Review this markdown, keep or remove sections, and let me know which pieces you want to implement first. I can then create the migration, endpoint, or client hook code as needed.
