import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useCallback, useState, type ComponentProps, type ReactNode } from 'react';

const defaultOption = '__brains_default_option__';

type SelectProps = Pick<ComponentProps<typeof SelectPrimitive.Trigger>, 'id' | 'className' | 'aria-label' | 'aria-describedby'> & {
  value: string | number;
  onValueChange: (value: string) => void;
  required?: boolean;
  children: ReactNode;
};

export function Select({ value, onValueChange, required, children, ...trigger }: SelectProps) {
  const [dialog, setDialog] = useState<HTMLDialogElement | null>(null);
  const attachTrigger = useCallback((node: HTMLButtonElement | null) => {
    setDialog(node?.closest('dialog') ?? null);
  }, []);

  return (
    <SelectPrimitive.Root
      value={String(value) || defaultOption}
      onValueChange={next => onValueChange(next === defaultOption ? '' : next)}
      required={required && value !== ''}
    >
      <SelectPrimitive.Trigger ref={attachTrigger} {...trigger} data-slot="select-trigger" aria-required={required}>
        <SelectPrimitive.Value data-slot="select-value" />
        <SelectPrimitive.Icon asChild><ChevronDown className="disclosure-icon" size={16} aria-hidden="true" /></SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal container={dialog ?? undefined}>
        <SelectPrimitive.Content data-slot="select-content" position="popper" sideOffset={6} collisionPadding={12}>
          <SelectPrimitive.ScrollUpButton data-slot="select-scroll"><ChevronUp size={16} /></SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport data-slot="select-viewport">{children}</SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton data-slot="select-scroll"><ChevronDown size={16} /></SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

export function SelectOption({ value, children }: { value: string | number; children: ReactNode }) {
  return (
    <SelectPrimitive.Item value={String(value) || defaultOption} data-slot="select-option">
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator><Check size={16} aria-hidden="true" /></SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}
