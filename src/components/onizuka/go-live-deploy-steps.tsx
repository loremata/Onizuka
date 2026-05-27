const steps = [
  {
    title: "Supabase + Vercel",
    body: "Crea progetto Supabase (EU), bucket R2, progetto Vercel collegato al repo.",
  },
  {
    title: "Variabili ambiente",
    body: "Copia vercel-env.template in Vercel Production. Genera NEXTAUTH_SECRET e CRON_SECRET.",
  },
  {
    title: "Database",
    body: "DIRECT_URL (5432) → npm run db:deploy. DATABASE_URL pooler (6543) su Vercel.",
  },
  {
    title: "DNS Hostinger",
    body: "A @ → IP Vercel · CNAME www → cname.vercel-dns.com · SSL in Vercel Domains.",
  },
  {
    title: "Verifica",
    body: "npm run deploy:verify · /admin/go-live · cambia password demo al primo login.",
  },
];

export function GoLiveDeploySteps() {
  return (
    <ol className="list-decimal space-y-3 pl-5 text-sm text-muted-foreground">
      {steps.map((s) => (
        <li key={s.title}>
          <span className="font-medium text-foreground">{s.title}</span>
          <span className="mt-0.5 block">{s.body}</span>
        </li>
      ))}
    </ol>
  );
}
