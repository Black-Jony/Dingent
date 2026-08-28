import { SidebarData } from "@/components/layout/types";
import {
  LayoutDashboard,
  FileText,
  Bot,
  Workflow,
  Store,
  Construction,
  Cpu,
} from "lucide-react";

export const sidebarData: SidebarData = {
  user: {
    name: "admin",
    email: "admin@admin.com",
    avatar: "/avatars/shadcn.jpg",
  },
  teams: [],
  navGroups: [
    {
      title: "general",
      items: [
        {
          title: "overview",
          url: "/overview",
          icon: LayoutDashboard,
        },
        {
          title: "assistants",
          url: "/assistants",
          icon: Bot,
        },
        {
          title: "workflows",
          url: "/workflows",
          icon: Workflow,
        },
        {
          title: "plugins",
          url: "/plugins",
          icon: Store,
        },
        {
          title: "models",
          url: "/models",
          icon: Cpu,
        },
        {
          title: "market",
          url: "/market",
          icon: Store,
        },
        {
          title: "logs",
          url: "/system-logs",
          icon: FileText,
        },
        {
          title: "chatInterface",
          url: "/chat",
          icon: Construction,
        },
      ],
    },
    // {
    //   title: "Under Construction Pages",
    //   items: [
    //     {
    //       title: "Settings",
    //       icon: Settings,
    //       items: [
    //         {
    //           title: "Profile",
    //           url: "/settings",
    //           icon: UserCog,
    //         },
    //         {
    //           title: "Account",
    //           url: "/settings/account",
    //           icon: Wrench,
    //         },
    //         {
    //           title: "Appearance",
    //           url: "/settings/appearance",
    //           icon: Palette,
    //         },
    //         {
    //           title: "Notifications",
    //           url: "/settings/notifications",
    //           icon: Bell,
    //         },
    //         {
    //           title: "Display",
    //           url: "/settings/display",
    //           icon: Monitor,
    //         },
    //       ],
    //     },
    //     {
    //       title: "Help Center",
    //       url: "/help-center",
    //       icon: HelpCircle,
    //     },
    //   ],
    // },
  ],
};
