import Link from "next/link";

type Props = {
  companyName?: string | null;
};

export function ClientBrandMark({ companyName }: Props) {
  return (
    <Link href="/app/dashboard" className="group flex items-center gap-3">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-sm font-bold text-primary ring-1 ring-primary/30"
        aria-hidden
      >
        O
      </span>
      <span className="flex min-w-0 flex-col leading-none">
        <span className="font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors">
          Onizuka
        </span>
        <span className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {companyName ? companyName : "Portale cliente"}
        </span>
      </span>
    </Link>
  );
}
