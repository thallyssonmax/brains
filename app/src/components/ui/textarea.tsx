import type { ComponentPropsWithRef } from 'react';

export function Textarea(props: ComponentPropsWithRef<'textarea'>) {
  return <textarea {...props} data-slot="textarea" />;
}
