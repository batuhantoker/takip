import SignInStep from '@/components/site/account/app-sign-in/sign-in-step';

type Params = { provider?: string; return?: string; state?: string };

export default async function AppSignInPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { provider = '', return: returnTo = '/', state = '' } = await searchParams;
  return <SignInStep provider={provider} returnTo={returnTo} state={state} />;
}
