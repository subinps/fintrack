import { motion, useReducedMotion } from 'framer-motion';
import { Card, CardProps } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

/**
 * Card that lifts on hover and rises in on mount.
 * Motion is transform/opacity only and is disabled for prefers-reduced-motion.
 */
export const HoverCard = forwardRef<HTMLDivElement, CardProps & { delay?: number; disableEntryAnimation?: boolean }>(
    ({ className, children, delay = 0, disableEntryAnimation = false, ...props }, ref) => {
        const reduceMotion = useReducedMotion();
        const animate = !reduceMotion && !disableEntryAnimation;

        return (
            <motion.div
                initial={animate ? { opacity: 0, y: 10 } : false}
                animate={animate ? { opacity: 1, y: 0 } : undefined}
                transition={animate ? { duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] } : undefined}
                whileHover={reduceMotion ? undefined : { y: -2, transition: { duration: 0.18, ease: 'easeOut' } }}
                className={cn(
                    'h-full transition-shadow duration-200 hover:shadow-lifted',
                    className
                )}
            >
                <Card ref={ref} className="h-full" {...props}>
                    {children}
                </Card>
            </motion.div>
        );
    }
);
HoverCard.displayName = "HoverCard";
