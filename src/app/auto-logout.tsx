"use client";

import { useEffect, useRef } from "react";

type AutoLogoutProps = {
  action: () => Promise<void>;
  timeoutMs?: number;
};

export function AutoLogout({ action, timeoutMs = 120000 }: AutoLogoutProps) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      formRef.current?.requestSubmit();
    }, timeoutMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [timeoutMs]);

  return <form ref={formRef} action={action} className="hidden" aria-hidden="true" />;
}
