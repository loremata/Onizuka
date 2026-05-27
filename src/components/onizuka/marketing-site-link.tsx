const marketingUrl = process.env.ONIZUKA_MARKETING_URL?.trim();

export function MarketingSiteLink() {
  if (!marketingUrl) return null;
  return (
    <a
      href={marketingUrl}
      target="_blank"
      rel="noreferrer"
      className="text-xs text-muted-foreground hover:text-foreground"
    >
      Sito vetrina
    </a>
  );
}
