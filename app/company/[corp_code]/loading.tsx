import { ControlsSkeleton, TableSkeleton } from "@/components/company/Skeletons";

/** 재무제표 탭 로딩 (헤더·탭은 layout이 이미 그림) */
export default function Loading() {
  return (
    <div className="space-y-4">
      <ControlsSkeleton />
      <TableSkeleton />
    </div>
  );
}
