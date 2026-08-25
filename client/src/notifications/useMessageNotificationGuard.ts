import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

/**
 * Suppresses notification banners for the thread the user is currently viewing.
 *
 * `matchId` is optional so callers can invoke this unconditionally while route
 * params are still resolving -- calling it inside an `if` would change the hook
 * order between renders and crash the screen.
 */
export function useMessageNotificationGuard(matchId: string | undefined) {
  useEffect(() => {
    if (!matchId) return;

    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const incomingMatchId =
          notification.request.content.data?.matchId;

        if (incomingMatchId === matchId) {
          return {
            shouldShowBanner: false,
            shouldShowList: false,
            shouldPlaySound: false,
            shouldSetBadge: false,
            shouldShowAlert: false,
          };
        }

        return {
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowAlert: true,
        };
      },
    });
  }, [matchId]);
}
