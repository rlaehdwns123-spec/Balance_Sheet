export default function EmptyTab({ title, description }: { title: string; description: string }) {
  return (
    <section>
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{description}</p>
      <div className="mt-6 flex h-48 items-center justify-center rounded-xl border border-dashed border-neutral-300 text-sm text-neutral-400 dark:border-neutral-700 dark:text-neutral-500">
        준비 중
      </div>
    </section>
  );
}
