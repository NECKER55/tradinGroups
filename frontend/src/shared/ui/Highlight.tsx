import { ReactNode, useEffect, useRef, useState } from 'react';

interface HighlightProps {
  trigger: unknown;
  duration?: number;
  className?: string;
  children: ReactNode;
}

export function Highlight({ trigger, duration = 500, className, children }: HighlightProps) {
  const [active, setActive] = useState(false);
  const previousTrigger = useRef<unknown>(trigger);

  useEffect(() => {
    if (Object.is(previousTrigger.current, trigger)) return;

    previousTrigger.current = trigger;
    setActive(true);

    const timer = window.setTimeout(() => {
      setActive(false);
    }, duration);

    return () => {
      window.clearTimeout(timer);
    };
  }, [trigger, duration]);

  return (
    <div data-highlight={active ? 'on' : 'off'} className={className}>
      {children}
    </div>
  );
}
