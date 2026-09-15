import ProfilePage from "@/components/profile/ProfilePage";
import { safeNextPath } from "@/lib/navigation";

export default async function ProfileRoute({ searchParams }: {
  searchParams: Promise<{ setup?: string; next?: string }>;
}) {
  const params = await searchParams;
  return <ProfilePage setup={params.setup === "1"} nextPath={safeNextPath(params.next)} />;
}
