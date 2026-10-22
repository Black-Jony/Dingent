import { notFound } from "next/navigation";
import { isAxiosError } from "axios";

import { getServerApi } from "@/lib/api/server";
import { Header } from "@/components/layout/header";
import { ConfigDrawer } from "@/components/common/config-drawer";
import { Search } from "@/components/common/search";
import { ThemeSwitch } from "@/components/common/theme-switch";
import { ProfileDropdown } from "@/components/common/profile-dropdown";
import { LanguageSwitch } from "@/components/common/language-switch";
import { Main } from "@/components/layout/main";

export default async function DashboardAppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
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
    <>
      <Header>
        <Search />
        <div className="ms-auto flex items-center gap-4">
          <LanguageSwitch />
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown workspace={workspace} />
        </div>
      </Header>
      <Main>{children}</Main>
    </>
  );
}
