import { notFound } from "next/navigation";
import { isAxiosError } from "axios";
import { getServerApi } from "@/lib/api/server";
import Providers from "./providers";

export default async function DashboardAppLayout({
  children,
  params,
  sidebar,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
  sidebar: React.ReactNode;
}) {
  const [api, { slug }] = await Promise.all([getServerApi(), params]);
  const workspace = await api.workspaces
    .getBySlug(slug)
    .catch((error: unknown) => {
      if (isAxiosError(error) && error.response?.status === 404) return null;
      throw error;
    });

  if (!workspace) {
    return notFound();
  }

  return (
    <main>
      <Providers sidebar={sidebar}>{children}</Providers>
    </main>
  );
}
