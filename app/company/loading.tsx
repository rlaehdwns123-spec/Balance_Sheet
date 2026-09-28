import { ControlsSkeleton, HeaderSkeleton, TableSkeleton, TabsSkeleton } from "@/components/company/Skeletons";

/** 검색 → 회사 첫 진입 시 (기업개황을 불러오는 동안 layout 전체) */
export default function Loading() {
  return (
    <div className="space-y-4">
      <HeaderSkeleton />
      <TabsSkeleton />
      <ControlsSkeleton />
      <TableSkeleton />
    </div>
  );
}
