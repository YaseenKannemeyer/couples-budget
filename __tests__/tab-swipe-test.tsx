import { renderHook } from '@testing-library/react-native';
import { router } from 'expo-router';
import { PanResponder, type PanResponderCallbacks, type PanResponderGestureState, type GestureResponderEvent } from 'react-native';
import { useTabSwipe } from '@/components/tab-swipe';

let mockPath = '/';
jest.mock('expo-router', () => ({ usePathname: () => mockPath, router: { navigate: jest.fn() } }));
const event = {} as GestureResponderEvent;
const gesture = (patch: Partial<PanResponderGestureState> = {}) => ({
  dx: -100, dy: 4, x0: 100, numberActiveTouches: 1, ...patch,
}) as PanResponderGestureState;
let callbacks: PanResponderCallbacks;
const createResponder = PanResponder.create;
beforeEach(() => {
  jest.clearAllMocks();
  mockPath = '/';
  jest.spyOn(PanResponder, 'create').mockImplementation(config => {
    callbacks = config;
    return createResponder(config);
  });
});
afterEach(() => jest.restoreAllMocks());

it('swipes Home → Plan → Personal and back, using the latest selected tab', async () => {
  const hook = await renderHook(() => useTabSwipe());
  for (const [from, dx, to] of [['/', -100, '/plan'], ['/plan', -100, '/private-space'],
    ['/private-space', 100, '/plan'], ['/plan', 100, '/']] as const) {
    mockPath = from;
    await hook.rerender({});
    callbacks.onStartShouldSetPanResponderCapture!(event, gesture());
    expect(callbacks.onMoveShouldSetPanResponderCapture!(event, gesture({ dx }))).toBe(true);
    callbacks.onPanResponderRelease!(event, gesture({ dx }));
    expect(router.navigate).toHaveBeenLastCalledWith(to);
  }
  expect(router.navigate).toHaveBeenCalledTimes(4);
});

it.each([
  ['/', { dx: 100 }], ['/private-space', { dx: -100 }], ['/settings', { dx: -100 }],
  ['/', { dx: -5 }], ['/', { dx: -100, dy: 200 }], ['/', { x0: 5 }],
  ['/', { numberActiveTouches: 2 }],
])('does not capture an invalid swipe on %s: %j', async (path, patch) => {
  mockPath = path;
  await renderHook(() => useTabSwipe());
  callbacks.onStartShouldSetPanResponderCapture!(event, gesture());
  expect(callbacks.onMoveShouldSetPanResponderCapture!(event, gesture(patch))).toBe(false);
});

it('does not navigate after short drags, termination, or a vertical scroll turning sideways', async () => {
  await renderHook(() => useTabSwipe());
  callbacks.onStartShouldSetPanResponderCapture!(event, gesture());
  callbacks.onPanResponderRelease!(event, gesture({ dx: -30 }));
  callbacks.onPanResponderTerminate!(event, gesture());
  callbacks.onPanResponderRelease!(event, gesture());
  callbacks.onStartShouldSetPanResponderCapture!(event, gesture());
  callbacks.onMoveShouldSetPanResponderCapture!(event, gesture({ dx: -3, dy: 30 }));
  expect(callbacks.onMoveShouldSetPanResponderCapture!(event, gesture())).toBe(false);
  callbacks.onPanResponderRelease!(event, gesture());
  expect(router.navigate).not.toHaveBeenCalled();
});
