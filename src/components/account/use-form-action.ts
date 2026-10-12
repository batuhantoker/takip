import { useState, type FormEvent } from 'react';

export const FALLBACK_ERROR = 'Something went wrong. Try again.';

/** Runs a form's action with a busy flag. The action returns an error message, or nothing on success. */
export function useFormAction(action: (form: FormData) => Promise<string | void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      setError((await action(form)) ?? null);
    } catch {
      setError(FALLBACK_ERROR);
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, onSubmit };
}
