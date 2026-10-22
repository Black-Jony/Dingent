export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getServerApi } from "@/lib/api/server";
import { WorkspaceEntry } from "@/components/common/workspace-entry";

export default async function RootPage() {
  const lastSlug = (await cookies()).get("last_workspace_slug")?.value;
  const api = await getServerApi();

  const workspaces = await api.workspaces.list();
  if (workspaces.length > 0) {
    const workspace =
      workspaces.find((item) => item.slug === lastSlug) ?? workspaces[0]!;
    redirect(`/${workspace.slug}`);
  }

  return <WorkspaceEntry />;
}
