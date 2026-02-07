import { motion } from 'framer-motion';
import { Card, CardProps } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

export const HoverCard = forwardRef<HTMLDivElement, CardProps & { delay?: number; disableEntryAnimation?: boolean }>(
    ({ className, children, delay = 0, disableEntryAnimation = false, ...props }, ref) => {
        return (
            <motion.div
                initial={disableEntryAnimation ? undefined : { opacity: 0, y: 20 }}
                animate={disableEntryAnimation ? undefined : { opacity: 1, y: 0 }}
                transition={disableEntryAnimation ? undefined : { duration: 0.4, delay }}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                className={cn(
                    "transition-all duration-300 hover:shadow-lg hover:shadow-primary/10",
                    className
                )}
            >
                <Card ref={ref} className="h-full border-0 bg-transparent shadow-none" {...props}>
                    {children}
                </Card>
            </motion.div>
        );
    }
);
HoverCard.displayName = "HoverCard";
