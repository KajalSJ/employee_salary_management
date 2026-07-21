import { Breadcrumb, type BreadcrumbItem } from "@/components/layout/breadcrumb";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  breadcrumbs,
  action,
  className,
}: {
  title: string;
  breadcrumbs?: BreadcrumbItem[];
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2 border-b border-border pb-3", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb items={breadcrumbs} />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {action}
      </div>
    </div>
  );
}
