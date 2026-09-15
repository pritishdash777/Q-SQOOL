import { lessonPath } from "./progress-storage";

export function safeNextPath(value: string | null | undefined): string {
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\s]/.test(value)) return "/dashboard";
  const url = new URL(value, "https://q-sqool.local");
  const pages = ["/", "/dashboard", "/learn", "/algorithms", "/composer", "/code-lab", "/projects", "/challenges", "/profile", "/playground"];
  return pages.includes(url.pathname) || lessonPath(url.pathname) !== "/learn"
    ? `${url.pathname}${url.search}${url.hash}` : "/dashboard";
}
