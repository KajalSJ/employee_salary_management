export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="text-sm text-muted-foreground">
      Employee detail for {id} coming soon.
    </div>
  );
}
