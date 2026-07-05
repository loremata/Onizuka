// Avvia il workflow "Scraper aziende" su GitHub Actions via repository_dispatch.
// Best-effort: se il token non è configurato o la chiamata fallisce, ritorna false
// e il job resta comunque QUEUED (lanciabile a mano dalla tab Actions di GitHub).
//
// Env (su Vercel):
//  - GITHUB_DISPATCH_TOKEN: PAT fine-grained sul repo Onizuka, permesso "Contents: Read and write".
//  - GITHUB_DISPATCH_REPO : opzionale, default "loremata/Onizuka".

export async function triggerScraperWorkflow(payload: {
  jobId: string;
  comune: string;
  provincia: string;
}): Promise<boolean> {
  const token = process.env.GITHUB_DISPATCH_TOKEN?.trim();
  const repo = process.env.GITHUB_DISPATCH_REPO?.trim() || "loremata/Onizuka";
  if (!token) return false;

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ event_type: "scrape", client_payload: payload }),
    });
    // GitHub risponde 204 No Content in caso di successo.
    return res.status === 204;
  } catch {
    return false;
  }
}
