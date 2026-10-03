const bar = "animate-pulse rounded bg-neutral-200 dark:bg-neutral-800";

export function HeaderSkeleton() {
  return (
    <div className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800" aria-hidden>
      <div className={`h-6 w-40 ${bar}`} />
      <div className={`mt-2 h-3 w-24 ${bar}`} />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className={`h-9 ${bar}`} />
        <div className={`h-9 ${bar}`} />
        <div className={`col-span-2 h-9 ${bar}`} />
      </div>
    </div>
  );
}

export function ControlsSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      <div className={`h-10 rounded-lg ${bar}`} />
      <div className="flex justify-between">
        <div className={`h-9 w-28 rounded-lg ${bar}`} />
        <div className={`h-9 w-32 rounded-lg ${bar}`} />
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div role="status" aria-label="차트 불러오는 중" className="space-y-4">
      {[280, 340].map((h, i) => (
        <div key={i} className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
          <div className={`h-5 w-28 ${bar}`} />
          <div className={`mt-2 h-3 w-48 ${bar}`} />
          <div className="mt-4 flex items-end gap-3" style={{ height: h - 60 }}>
            {[45, 60, 40, 70, 85].map((p, j) => (
              <div key={j} className={`flex-1 ${bar}`} style={{ height: `${p}%` }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function CompareSkeleton() {
  return (
    <div role="status" aria-label="비교 데이터 불러오는 중" className="space-y-4">
      <div className={`h-10 rounded-lg ${bar}`} />
      <div className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
        <div className={`mb-4 h-5 w-20 ${bar}`} />
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="mb-4 space-y-1.5">
            <div className={`h-3 w-16 ${bar}`} />
            <div className={`h-6 ${bar}`} />
            <div className={`h-6 ${bar}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TabsSkeleton() {
  return <div className={`h-10 ${bar}`} aria-hidden />;
}

export function RatioSkeleton() {
  return (
    <div role="status" aria-label="재무비율 불러오는 중" className="space-y-4">
      <div className={`h-3 w-56 ${bar}`} />
      {[5, 4].map((items, c) => (
        <div key={c} className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
          <div className={`mb-4 h-5 w-16 ${bar}`} />
          <div className="space-y-4">
            {Array.from({ length: items }, (_, i) => (
              <div key={i}>
                <div className={`h-4 w-24 ${bar}`} />
                <div className="mt-2 grid grid-cols-5 gap-1">
                  {Array.from({ length: 5 }, (_, j) => (
                    <div key={j} className={`h-12 rounded-lg ${bar}`} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AnalysisSkeleton() {
  return (
    <div role="status" aria-label="분석 불러오는 중" className="space-y-4">
      <div className={`h-3 w-64 ${bar}`} />
      <div className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
        <div className={`h-5 w-20 ${bar}`} />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={`h-24 rounded-xl ${bar}`} />
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
        <div className={`h-5 w-24 ${bar}`} />
        <div className="mt-4 space-y-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="grid grid-cols-5 gap-1">
              {Array.from({ length: 5 }, (_, j) => (
                <div key={j} className={`h-12 rounded-lg ${bar}`} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 12 }: { rows?: number }) {
  return (
    <div role="status" aria-label="재무제표 불러오는 중">
      <div className={`mb-3 h-3 w-48 ${bar}`} />
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={`h-4 ${bar}`} style={{ width: `${6 + ((i * 37) % 4)}rem`, marginLeft: i % 4 ? "0.75rem" : 0 }} />
            <div className={`ml-auto h-4 w-16 ${bar}`} />
            <div className={`h-4 w-16 ${bar}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ListSkeleton({ title, rows = 4 }: { title: string; rows?: number }) {
  return (
    <div role="status" aria-label={`${title} 불러오는 중`} className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className={`h-5 w-20 ${bar}`} />
      <div className={`mt-2 h-3 w-40 ${bar}`} />
      <div className="mt-4 space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="space-y-1.5">
            <div className={`h-4 ${bar}`} style={{ width: `${55 + ((i * 23) % 40)}%` }} />
            <div className={`h-3 w-28 ${bar}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
