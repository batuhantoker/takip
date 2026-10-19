import { useState, type FormEvent } from 'react';
import { useT } from '@/components/ui/use-t';
import { msg } from '@/lib/core/i18n/translator';

export const FALLBACK_ERROR = msg('Something went wrong. Try again.');

/** Runs a form's action with a busy flag. The action returns an error message, or nothing on success. */
export function useFormAction(action: (form: FormData) => Promise<string | void>) {
  const t = useT();
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
      setError(t(FALLBACK_ERROR));
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, onSubmit };
}
