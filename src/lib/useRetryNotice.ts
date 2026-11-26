import { useEffect, useState } from 'react';

export function useRetryNotice(isActive: boolean, delayMs = 3500): boolean {
  const [showNotice, setShowNotice] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setShowNotice(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowNotice(true);
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [isActive, delayMs]);

  return showNotice;
}
