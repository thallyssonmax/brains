import { motion, useReducedMotion } from 'motion/react';
import { motionTransition } from './motion';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import type { ComponentProps } from 'react';

export function Checkbox(props: ComponentProps<typeof CheckboxPrimitive.Root>) {
  const reduced = useReducedMotion();
  return (
    <CheckboxPrimitive.Root {...props} data-slot="checkbox">
      <CheckboxPrimitive.Indicator><motion.span initial={reduced ? false : { opacity: 0, scale: .85 }} animate={{ opacity: 1, scale: 1 }} transition={motionTransition(.1)}><Check size={16} strokeWidth={2.5} aria-hidden="true" /></motion.span></CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
