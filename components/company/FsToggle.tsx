"use client";

import Segmented from "@/components/Segmented";
import { useStatementParams } from "./useStatementParams";

export default function FsToggle() {
  const { fs, hrefWith } = useStatementParams();
  return (
    <Segmented
      label="연결/별도"
      value={fs}
      className="w-fit"
      options={[
        { value: "CFS", label: "연결", href: hrefWith({ fs: "CFS" }) },
        { value: "OFS", label: "별도", href: hrefWith({ fs: "OFS" }) },
      ]}
    />
  );
}
