import type { ComponentPropsWithRef } from 'react';

// Adapted from shadcn/ui Input. Form attributes stay on the native input.
export function Input(props: ComponentPropsWithRef<'input'>) {
  return <input {...props} data-slot="input" />;
}
