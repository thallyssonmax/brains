import type { ComponentPropsWithRef } from 'react';

export function CardSurface({ className, ...props }: ComponentPropsWithRef<'section'>) {
  return <section {...props} className={className ? 'panel ' + className : 'panel'} data-slot="card" />;
}
