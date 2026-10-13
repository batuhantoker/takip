'use client';

import { useState } from 'react';
import { adminSend, useAdminData } from '@/components/site/admin/admin-api';
import { ErrorText, Input, Muted, PageTitle, Select, TABLE, TD, TH } from '@/components/site/admin/parts/admin-parts';
import type { PlansResponse } from '@/components/site/admin/admin-types';

type Spec = PlansResponse['catalogue'][number];

export default function PlansPage() {
  const { data, error, reload } = useAdminData<PlansResponse>('/plans');
  const [saving, setSaving] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const save = async (planId: string, key: string, value: string) => {
    setSaving(`${planId}:${key}`);
    setSaveError(null);
    try {
      await adminSend('PUT', `/plans/${planId}/entitlements/${key}`, { value });
      reload();
    } catch (e) {
      setSaveError(`${planId} ${key}: ${(e as Error).message}`);
    } finally {
      setSaving(null);
    }
  };

  return (
    <>
      <PageTitle title="Plans" />
      <Muted>
        What each plan includes. Changes apply to everyone on the plan at once and are recorded in the audit log. Visitors get
        &ldquo;anon&rdquo;, signed-in users &ldquo;free&rdquo; unless granted or subscribed to another.
      </Muted>
      <div className="h-4" />
      <ErrorText message={error ?? saveError} />
      {data && (
        <div className="overflow-x-auto border border-line bg-surface-1">
          <table className={TABLE}>
            <thead>
              <tr>
                <th className={TH}>Entitlement</th>
                {data.plans.map(plan => (
                  <th key={plan.id} className={TH}>{plan.name} <span className="normal-case tracking-normal">({plan.id})</span></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.catalogue.map(spec => (
                <tr key={spec.key}>
                  <td className={`${TD} font-mono text-[11px] whitespace-nowrap`}>{spec.key}</td>
                  {data.plans.map(plan => (
                    <td key={plan.id} className={TD}>
                      <Cell
                        spec={spec}
                        raw={plan.values[spec.key]}
                        busy={saving === `${plan.id}:${spec.key}`}
                        onSave={value => save(plan.id, spec.key, value)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!data && !error && <Muted>Loading…</Muted>}
    </>
  );
}

/** Values are stored as JSON scalars: true, 500, "paid". */
function Cell({ spec, raw, busy, onSave }: { spec: Spec; raw: string | undefined; busy: boolean; onSave: (value: string) => void }) {
  const current = raw === undefined ? undefined : JSON.parse(raw);
  if (spec.type === 'bool' || spec.type === 'enum') {
    const options = spec.type === 'bool' ? ['true', 'false'] : spec.values!.map(v => JSON.stringify(v));
    return (
      <Select value={raw ?? ''} disabled={busy} onChange={e => onSave(e.target.value)} className="w-28">
        {raw === undefined && <option value="">unset</option>}
        {options.map(option => <option key={option} value={option}>{String(JSON.parse(option))}</option>)}
      </Select>
    );
  }
  return (
    <Input
      key={raw}
      type="number"
      min={0}
      step={1}
      defaultValue={current ?? ''}
      disabled={busy}
      className="w-28 font-mono"
      onBlur={e => e.target.value !== '' && e.target.value !== String(current) && onSave(String(Number(e.target.value)))}
      onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  );
}
