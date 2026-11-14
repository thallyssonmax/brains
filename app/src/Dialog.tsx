import { Button } from './components/ui/button';
import { motionTransition } from './components/ui/motion';
import { motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';

export function Dialog({title, children, onClose, closeLabel}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  closeLabel: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const reduced = useReducedMotion();

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    dialog.showModal();
    return () => {
      dialog.close();
      requestAnimationFrame(() => {
        if (opener?.isConnected) opener.focus({ preventScroll: true });
      });
    };
  }, []);

  return (
    <motion.dialog ref={ref} data-motion-dialog aria-labelledby={titleId}
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, transition: motionTransition(reduced ? 0 : 0.2) }}
      exit={{ opacity: 0, y: reduced ? 0 : 6, transition: motionTransition(reduced ? 0 : 0.14) }}
      onCancel={event => { event.preventDefault(); onClose(); }}>
      <div className="row">
        <h2 id={titleId}>{title}</h2>
        <Button className="dialog-close" type="button" aria-label={closeLabel} onClick={onClose}>
          <X size={20} aria-hidden="true" />
        </Button>
      </div>
      {children}
    </motion.dialog>
  );
}
