import VerifyStep from '@/components/site/account/app-sign-in/verify-step';

type Params = { ott?: string; return?: string; state?: string; error?: string };

export default async function AppVerifyPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { ott, return: returnTo = '/', state = '', error } = await searchParams;
  return <VerifyStep ott={ott ?? null} returnTo={returnTo} state={state} error={error ?? null} />;
}
