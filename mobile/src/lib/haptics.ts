import { Platform } from 'react-native';
import * as ExpoHaptics from 'expo-haptics';

// expo-haptics throws on web ("Haptic.selectionAsync is not available on
// web"), so this module mirrors its surface and no-ops there. Import it as
// `import * as Haptics from '.../lib/haptics'` in place of expo-haptics.
const isWeb = Platform.OS === 'web';
const noop = () => Promise.resolve();

export const ImpactFeedbackStyle = ExpoHaptics.ImpactFeedbackStyle;
export const NotificationFeedbackType = ExpoHaptics.NotificationFeedbackType;

export const selectionAsync = isWeb ? noop : ExpoHaptics.selectionAsync;
export const impactAsync = isWeb ? noop : ExpoHaptics.impactAsync;
export const notificationAsync = isWeb ? noop : ExpoHaptics.notificationAsync;

export function selectionHaptic() {
    return selectionAsync();
}

export function impactHaptic(style: ExpoHaptics.ImpactFeedbackStyle = ExpoHaptics.ImpactFeedbackStyle.Medium) {
    return impactAsync(style);
}

export function successHaptic() {
    return notificationAsync(ExpoHaptics.NotificationFeedbackType.Success);
}
