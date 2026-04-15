import { useEffect, useState } from 'react';

export interface GeolocationState {
  coords: { lat: number; lng: number } | null;
  error: string | null;
  permissionDenied: boolean;
}

export function useGeolocation(): GeolocationState {
  const [state, setState] = useState<GeolocationState>({
    coords: null,
    error: null,
    permissionDenied: false,
  });

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState({
        coords: null,
        error: 'Geolocation not supported',
        permissionDenied: false,
      });
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setState({
          coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          error: null,
          permissionDenied: false,
        });
      },
      (err) => {
        const denied = err.code === err.PERMISSION_DENIED;
        setState({
          coords: null,
          error: err.message,
          permissionDenied: denied,
        });
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  return state;
}
