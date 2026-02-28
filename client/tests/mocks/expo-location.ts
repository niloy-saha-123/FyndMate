export const Accuracy = { Balanced: 0 };
export const getForegroundPermissionsAsync = async () => ({ granted: true, status: 'granted' });
export const getBackgroundPermissionsAsync = async () => ({ granted: false, status: 'denied' });
export const requestForegroundPermissionsAsync = async () => ({ granted: true, status: 'granted' });
export const requestBackgroundPermissionsAsync = async () => ({ granted: false, status: 'denied' });
export const getCurrentPositionAsync = async () => ({ coords: { latitude: 0, longitude: 0 } });
export const startLocationUpdatesAsync = async () => {};
export const stopLocationUpdatesAsync = async () => {};
export const hasStartedLocationUpdatesAsync = async () => false;
