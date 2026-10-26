import HandoffStep from '@/components/site/account/app-sign-in/handoff-step';

type Params = { return?: string; state?: string; error?: string };

export default async function AppHandoffPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { return: returnTo = '/', state = '', error } = await searchParams;
  return <HandoffStep returnTo={returnTo} state={state} error={error ?? null} />;
}
