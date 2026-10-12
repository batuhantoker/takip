'use client';

import { useEffect, useState } from 'react';
import { Monitor, Smartphone } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { describeDevice, timeAgo } from '@/lib/device-label';
import { FormError } from '../form-parts';
import { FALLBACK_ERROR } from '../use-form-action';
import { Row, Section, SignInAgain, SmallButton, needsFreshSignIn } from './settings-parts';

type Device = { id: string; token: string; userAgent?: string | null; ipAddress?: string | null; updatedAt: Date | string };

export default function DevicesSection({ currentId }: { currentId: string }) {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const show = ({ data, error }: Awaited<ReturnType<typeof authClient.listSessions>>) => {
    if (needsFreshSignIn(error)) setStale(true);
    else if (error) setError(error.message ?? FALLBACK_ERROR);
    else setDevices(data);
  };

  useEffect(() => {
    let live = true;
    void authClient.listSessions().then(result => {
      if (live) show(result);
    });
    return () => {
      live = false;
    };
  }, []);

  const signOut = async (token?: string) => {
    setPending(true);
    setError(null);
    const { error } = token ? await authClient.revokeSession({ token }) : await authClient.revokeOtherSessions();
    setPending(false);
    if (error) return setError(error.message ?? FALLBACK_ERROR);
    show(await authClient.listSessions());
  };

  return (
    <Section title="Devices">
      {stale && <SignInAgain />}
      <FormError message={error} />
      {devices?.map(device => {
        const label = describeDevice(device.userAgent);
        const current = device.id === currentId;
        const Icon = /iOS|Android/.test(label) ? Smartphone : Monitor;
        const detail = [current ? 'This device' : `Active ${timeAgo(device.updatedAt)}`, device.ipAddress].filter(Boolean).join(' · ');
        return (
          <Row key={device.id} icon={<Icon className="w-3.5 h-3.5 shrink-0 text-[var(--text-muted)]" aria-hidden />} label={label} detail={detail}>
            {!current && <SmallButton disabled={pending} onClick={() => signOut(device.token)}>Sign out</SmallButton>}
          </Row>
        );
      })}
      {devices && devices.length > 1 && (
        <SmallButton disabled={pending} onClick={() => signOut()} className="self-start">
          Sign out all other devices
        </SmallButton>
      )}
    </Section>
  );
}
