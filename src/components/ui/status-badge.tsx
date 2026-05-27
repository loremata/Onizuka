import { cn } from "@/lib/utils";
import { postStatusLabelIt } from "@/lib/post-ui-labels";
import type { PostStatus } from "@prisma/client";

const statusClassName: Record<PostStatus, string> = {
  PENDING: "bg-muted text-muted-foreground",
  APPROVED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  NEEDS_REVISION: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
};

type Props = {
  status: PostStatus;
  className?: string;
};

export function StatusBadge({ status, className }: Props) {
  const classKey = statusClassName[status] ?? "bg-muted text-muted-foreground";
  const label = postStatusLabelIt[status] ?? String(status);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        classKey,
        className
      )}
    >
      {label}
    </span>
  );
}
