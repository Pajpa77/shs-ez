import { Capacitor, registerPlugin } from '@capacitor/core';
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

export const startCapacitorBackgroundGps = async (
  onLocation: (pos: any) => void
) => {
  if (!Capacitor.isNativePlatform()) return null;

  try {
    const watcherId = await BackgroundGeolocation.addWatcher(
      {
        backgroundMessage: 'GPS Tracking für Rettungseinsatz aktiv.',
        backgroundTitle: 'Einsatz läuft',
        requestPermissions: true,
        stale: false,
        distanceFilter: 2, // updates every 2 meters
      },
      (location, error) => {
        if (error) {
          if (error.code === 'NOT_AUTHORIZED') {
            console.warn('GPS Permission missing');
          }
          return;
        }
        if (location) {
          // Map Capacitor location format to Web Geolocation format so the rest of the app doesn't need to change
          const pos = {
            coords: {
              latitude: location.latitude,
              longitude: location.longitude,
              accuracy: location.accuracy,
              heading: location.bearing,
              speed: location.speed,
              altitude: location.altitude,
            },
            timestamp: location.time,
          };
          onLocation(pos);
        }
      }
    );
    return watcherId;
  } catch (err) {
    console.warn('Capacitor BG GPS failed:', err);
    return null;
  }
};

export const stopCapacitorBackgroundGps = async (watcherId: string) => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await BackgroundGeolocation.removeWatcher({ id: watcherId });
  } catch (err) {
    console.warn('Failed to stop Capacitor BG GPS:', err);
  }
};
