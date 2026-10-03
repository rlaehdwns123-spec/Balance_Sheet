import { ListSkeleton } from "@/components/company/Skeletons";

export default function Loading() {
  return <ListSkeleton title="최근 공시" rows={8} />;
}
