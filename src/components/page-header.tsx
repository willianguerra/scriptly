import * as React from "react";
import type { LucideIcon } from "lucide-react";

type PageHeaderProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
};

export function PageHeader({ icon: Icon, title, description }: PageHeaderProps) {
  return (
    <div className="space-y-1">
      <h1 className="flex items-center gap-3 text-3xl font-semibold">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        {title}
      </h1>
      {description ? (
        <p className="text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

export default PageHeader;
