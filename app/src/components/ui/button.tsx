import type { ComponentPropsWithRef } from 'react';

export function Button({ type, ...props }: ComponentPropsWithRef<'button'>) {
  return <button {...props} type={type} data-slot="button" />;
}
