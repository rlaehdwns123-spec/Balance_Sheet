import Link from "next/link";

type Option<T extends string> = { value: T; label: string; href?: string };

const itemClass = (active: boolean) =>
  `flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-center text-sm transition-colors ${
    active
      ? "bg-white font-semibold text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white"
      : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
  }`;

/** 세그먼트 컨트롤. 옵션에 href가 있으면 링크, 없으면 onChange 버튼 */
export default function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className = "",
}: {
  options: Option<T>[];
  value: T;
  onChange?: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={`flex rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800 ${className}`}>
      {options.map((opt) => {
        const active = opt.value === value;
        return opt.href ? (
          <Link
            key={opt.value}
            href={opt.href}
            scroll={false}
            aria-current={active ? "true" : undefined}
            className={itemClass(active)}
          >
            {opt.label}
          </Link>
        ) : (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange?.(opt.value)}
            className={itemClass(active)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
