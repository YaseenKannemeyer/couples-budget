import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
/** Start conservatively, then track the live OS preference. */
export function useReducedMotionPreference() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (live) setReduced(value); }).catch(() => undefined);
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { live = false; listener.remove(); };
  }, []);
  return reduced;
}
