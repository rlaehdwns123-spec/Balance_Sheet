import { ListSkeleton } from "@/components/company/Skeletons";

export default function Loading() {
  return (
    <div className="space-y-4">
      <ListSkeleton title="배당" />
      <ListSkeleton title="감사의견" />
      <ListSkeleton title="최근 공시" rows={8} />
    </div>
  );
}
