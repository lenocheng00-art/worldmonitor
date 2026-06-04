export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="max-w-4xl space-y-3">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">{eyebrow}</div>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">{title}</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
      </div>
    </header>
  );
}
