import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

export function useChatNotificationGuard(matchId: string) {
  useEffect(() => {
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
          };
        }

        return {
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        };
      },
    });
  }, [matchId]);
}
