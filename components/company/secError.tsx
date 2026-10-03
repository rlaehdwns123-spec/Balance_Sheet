import { isSecError } from "@/lib/sec/errors";
import SecErrorView from "./SecErrorView";

/** SEC 오류면 오류 화면, 아니면 다시 던진다 (서버 컴포넌트의 catch에서) */
export function secErrorView(err: unknown) {
  if (!isSecError(err)) throw err;
  return <SecErrorView error={{ kind: err.kind, message: err.message }} />;
}
