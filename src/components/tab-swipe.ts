import { useMemo } from 'react';
import { router, usePathname } from 'expo-router';
import { PanResponder, useWindowDimensions } from 'react-native';

export const tabRoutes = ['/', '/plan', '/private-space'] as const;

/** Only the three main tabs participate; never wrap from Personal to Home. */
export function swipeDestination(path: string, dx: number) {
  const index = tabRoutes.findIndex(route => route === path);
  return index < 0 || dx === 0 ? undefined : tabRoutes[index + (dx < 0 ? 1 : -1)];
}

export function useTabSwipe() {
  const path = usePathname();
  const { width } = useWindowDimensions();
  return useMemo(() => createTabResponder(path, width), [path, width]).panHandlers;
}

function createTabResponder(path: string, width: number) {
  let cancelled = false;
  return PanResponder.create({
    onStartShouldSetPanResponderCapture: () => {
      cancelled = false;
      return false;
    },
    onMoveShouldSetPanResponderCapture: (_event, gesture) => {
      // Leave OS edge gestures and vertical scrolling/pull-to-refresh alone.
      if (gesture.numberActiveTouches !== 1 || gesture.x0 < 24 || gesture.x0 > width - 24 ||
          (Math.abs(gesture.dy) > 10 && Math.abs(gesture.dy) > Math.abs(gesture.dx))) cancelled = true;
      return !cancelled && Math.abs(gesture.dx) > 24 &&
        Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2 && !!swipeDestination(path, gesture.dx);
    },
    onPanResponderMove: (_event, gesture) => {
      if (gesture.numberActiveTouches !== 1) cancelled = true;
    },
    onPanResponderRelease: (_event, gesture) => {
      if (cancelled || Math.abs(gesture.dx) < 56 || Math.abs(gesture.dx) <= Math.abs(gesture.dy) * 2) return;
      const destination = swipeDestination(path, gesture.dx);
      if (destination) router.navigate(destination);
    },
    onPanResponderTerminationRequest: () => true,
    onPanResponderTerminate: () => { cancelled = true; },
  });
}
