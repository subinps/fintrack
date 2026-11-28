import type { ReactNode } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
    return <Animated.View entering={FadeInDown.delay(delay).duration(320).springify().damping(20)}>{children}</Animated.View>;
}
