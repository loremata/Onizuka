import Link from "next/link";

type Props = {
  staffMode?: boolean;
};

export function AdminBrandMark({ staffMode }: Props) {
  return (
    <Link href="/admin" className="group flex items-center gap-3">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-sm font-bold text-primary ring-1 ring-primary/30"
        aria-hidden
      >
        O
      </span>
      <span className="flex flex-col leading-none">
        <span className="font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors">
          Onizuka
        </span>
        <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Business OS
        </span>
      </span>
      {staffMode ? (
        <span className="ml-1 rounded-md border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Staff
        </span>
      ) : null}
    </Link>
  );
}
