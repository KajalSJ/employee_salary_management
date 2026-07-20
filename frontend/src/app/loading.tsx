export default function Loading() {
  return (
    <div className="flex items-center justify-center py-24">
      <div
        className="size-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}
