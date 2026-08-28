"use client";
import { type SVGProps } from "react";
import { Root as Radio, Item } from "@radix-ui/react-radio-group";
import { CircleCheck, RotateCcw, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "../ui/sidebar";
import { Collapsible, useDirection, useLayout, useTheme } from "@/providers";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";
import { Button } from "../ui/button";
import {
  IconDir,
  IconLayoutCompact,
  IconLayoutDefault,
  IconLayoutFull,
  IconSidebarFloating,
  IconSidebarInset,
  IconSidebarSidebar,
  IconThemeDark,
  IconThemeLight,
  IconThemeSystem,
} from "@/assets/icon";
import { useTranslations } from "next-intl";

export function ConfigDrawer() {
  const t = useTranslations("ConfigDrawer");
  const { setOpen } = useSidebar();
  const { resetDir } = useDirection();
  const { resetTheme } = useTheme();
  const { resetLayout } = useLayout();

  const handleReset = () => {
    setOpen(true);
    resetDir();
    resetTheme();
    resetLayout();
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          aria-label={t("open")}
          aria-describedby="config-drawer-description"
          className="rounded-full"
        >
          <Settings aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col">
        <SheetHeader className="pb-0 text-start">
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription id="config-drawer-description">
            {t("description")}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-6 overflow-y-auto px-4">
          <ThemeConfig />
          <SidebarConfig />
          <LayoutConfig />
          <DirConfig />
        </div>
        <SheetFooter className="gap-2">
          <Button
            variant="destructive"
            onClick={handleReset}
            aria-label={t("resetAll")}
          >
            {t("reset")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function SectionTitle({
  title,
  showReset = false,
  onReset,
  className,
}: {
  title: string;
  showReset?: boolean;
  onReset?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-muted-foreground mb-2 flex items-center gap-2 text-sm font-semibold",
        className,
      )}
    >
      {title}
      {showReset && onReset && (
        <Button
          size="icon"
          variant="secondary"
          className="size-4 rounded-full"
          onClick={onReset}
        >
          <RotateCcw className="size-3" />
        </Button>
      )}
    </div>
  );
}

function RadioGroupItem({
  item,
  isTheme = false,
}: {
  item: {
    value: string;
    label: string;
    icon: (props: SVGProps<SVGSVGElement>) => React.ReactElement;
  };
  isTheme?: boolean;
}) {
  const t = useTranslations("ConfigDrawer");
  return (
    <Item
      value={item.value}
      className={cn("group outline-none", "transition duration-200 ease-in")}
      aria-label={t("selectOption", { option: item.label })}
      aria-describedby={`${item.value}-description`}
    >
      <div
        className={cn(
          "ring-border relative rounded-[6px] ring-[1px]",
          "group-data-[state=checked]:ring-primary group-data-[state=checked]:shadow-2xl",
          "group-focus-visible:ring-2",
        )}
        role="img"
        aria-hidden="false"
        aria-label={t("optionPreview", { option: item.label })}
      >
        <CircleCheck
          className={cn(
            "fill-primary size-6 stroke-white",
            "group-data-[state=unchecked]:hidden",
            "absolute top-0 right-0 translate-x-1/2 -translate-y-1/2",
          )}
          aria-hidden="true"
        />
        <item.icon
          className={cn(
            !isTheme &&
              "stroke-primary fill-primary group-data-[state=unchecked]:stroke-muted-foreground group-data-[state=unchecked]:fill-muted-foreground",
          )}
          aria-hidden="true"
        />
      </div>
      <div
        className="mt-1 text-xs"
        id={`${item.value}-description`}
        aria-live="polite"
      >
        {item.label}
      </div>
    </Item>
  );
}

function ThemeConfig() {
  const { defaultTheme, theme, setTheme } = useTheme();
  const t = useTranslations("ConfigDrawer");
  return (
    <div>
      <SectionTitle
        title={t("theme")}
        showReset={theme !== defaultTheme}
        onReset={() => setTheme(defaultTheme)}
      />
      <Radio
        value={theme}
        onValueChange={setTheme}
        className="grid w-full max-w-md grid-cols-3 gap-4"
        aria-label={t("selectTheme")}
        aria-describedby="theme-description"
      >
        {[
          {
            value: "system",
            label: t("system"),
            icon: IconThemeSystem,
          },
          {
            value: "light",
            label: t("light"),
            icon: IconThemeLight,
          },
          {
            value: "dark",
            label: t("dark"),
            icon: IconThemeDark,
          },
        ].map((item) => (
          <RadioGroupItem key={item.value} item={item} isTheme />
        ))}
      </Radio>
      <div id="theme-description" className="sr-only">
        {t("themeDescription")}
      </div>
    </div>
  );
}

function SidebarConfig() {
  const { defaultVariant, variant, setVariant } = useLayout();
  const t = useTranslations("ConfigDrawer");
  return (
    <div className="max-md:hidden">
      <SectionTitle
        title={t("sidebar")}
        showReset={defaultVariant !== variant}
        onReset={() => setVariant(defaultVariant)}
      />
      <Radio
        value={variant}
        onValueChange={setVariant}
        className="grid w-full max-w-md grid-cols-3 gap-4"
        aria-label={t("selectSidebar")}
        aria-describedby="sidebar-description"
      >
        {[
          {
            value: "inset",
            label: t("inset"),
            icon: IconSidebarInset,
          },
          {
            value: "floating",
            label: t("floating"),
            icon: IconSidebarFloating,
          },
          {
            value: "sidebar",
            label: t("standardSidebar"),
            icon: IconSidebarSidebar,
          },
        ].map((item) => (
          <RadioGroupItem key={item.value} item={item} />
        ))}
      </Radio>
      <div id="sidebar-description" className="sr-only">
        {t("sidebarDescription")}
      </div>
    </div>
  );
}

function LayoutConfig() {
  const { open, setOpen } = useSidebar();
  const { defaultCollapsible, collapsible, setCollapsible } = useLayout();
  const t = useTranslations("ConfigDrawer");

  const radioState = open ? "default" : collapsible;

  return (
    <div className="max-md:hidden">
      <SectionTitle
        title={t("layout")}
        showReset={radioState !== "default"}
        onReset={() => {
          setOpen(true);
          setCollapsible(defaultCollapsible);
        }}
      />
      <Radio
        value={radioState}
        onValueChange={(v) => {
          if (v === "default") {
            setOpen(true);
            return;
          }
          setOpen(false);
          setCollapsible(v as Collapsible);
        }}
        className="grid w-full max-w-md grid-cols-3 gap-4"
        aria-label={t("selectLayout")}
        aria-describedby="layout-description"
      >
        {[
          {
            value: "default",
            label: t("default"),
            icon: IconLayoutDefault,
          },
          {
            value: "icon",
            label: t("compact"),
            icon: IconLayoutCompact,
          },
          {
            value: "offcanvas",
            label: t("fullLayout"),
            icon: IconLayoutFull,
          },
        ].map((item) => (
          <RadioGroupItem key={item.value} item={item} />
        ))}
      </Radio>
      <div id="layout-description" className="sr-only">
        {t("layoutDescription")}
      </div>
    </div>
  );
}

function DirConfig() {
  const { defaultDir, dir, setDir } = useDirection();
  const t = useTranslations("ConfigDrawer");
  return (
    <div>
      <SectionTitle
        title={t("direction")}
        showReset={defaultDir !== dir}
        onReset={() => setDir(defaultDir)}
      />
      <Radio
        value={dir}
        onValueChange={setDir}
        className="grid w-full max-w-md grid-cols-3 gap-4"
        aria-label={t("selectDirection")}
        aria-describedby="direction-description"
      >
        {[
          {
            value: "ltr",
            label: t("leftToRight"),
            icon: (props: SVGProps<SVGSVGElement>) => (
              <IconDir dir="ltr" {...props} />
            ),
          },
          {
            value: "rtl",
            label: t("rightToLeft"),
            icon: (props: SVGProps<SVGSVGElement>) => (
              <IconDir dir="rtl" {...props} />
            ),
          },
        ].map((item) => (
          <RadioGroupItem key={item.value} item={item} />
        ))}
      </Radio>
      <div id="direction-description" className="sr-only">
        {t("directionDescription")}
      </div>
    </div>
  );
}
