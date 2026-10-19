import VisitorPage from '@/components/site/admin/pages/visitor-page';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VisitorPage id={id} />;
}
