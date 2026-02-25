import { cn } from "@/lib/utils";

const statusConfig = {
  PENDING: {
    label: "Pending",
    className: "bg-muted text-muted-foreground",
  },
  APPROVED: {
    label: "Approved",
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  NEEDS_REVISION: {
    label: "Needs revision",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  },
} as const;

type PostStatus = keyof typeof statusConfig;

type Props = {
  status: PostStatus;
  className?: string;
};

export function StatusBadge({ status, className }: Props) {
  const config = statusConfig[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
