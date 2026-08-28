import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { IconGithub, IconFacebook } from "@/assets/icon";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  Form,
} from "../ui/form";
import { PasswordInput } from "./password-input";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { useTranslations } from "next-intl";
interface SignUpFormProps extends React.HTMLAttributes<HTMLFormElement> {
  // 定义接口
  api: {
    auth: {
      signup: (data: any) => Promise<any>;
    };
  };
}

export function SignUpForm({ className, api, ...props }: SignUpFormProps) {
  const t = useTranslations("Auth");
  const formSchema = z
    .object({
      email: z.email({
        error: (issue) =>
          issue.input === "" ? t("validation.emailRequired") : undefined,
      }),
      password: z
        .string()
        .min(1, t("validation.passwordRequired"))
        .min(7, t("validation.passwordLength")),
      confirmPassword: z
        .string()
        .min(1, t("validation.confirmPasswordRequired")),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("validation.passwordMismatch"),
      path: ["confirmPassword"],
    });
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true);
    const signUpPromise = api.auth.signup({
      username: "NewUser",
      email: data.email,
      password: data.password,
    });
    toast.promise(signUpPromise, {
      loading: t("toast.signingUp"),
      success: () => {
        setIsLoading(false);
        router.push("/auth/login");

        return t("toast.signUpSuccess");
      },
      error: (err) => {
        setIsLoading(false);

        return err.message || t("toast.signUpFailed");
      },
    });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn("grid gap-3", className)}
        {...props}
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("email")}</FormLabel>
              <FormControl>
                <Input placeholder="name@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("password")}</FormLabel>
              <FormControl>
                <PasswordInput placeholder="********" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("confirmPassword")}</FormLabel>
              <FormControl>
                <PasswordInput placeholder="********" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button className="mt-2" disabled={isLoading}>
          {t("createAccountButton")}
        </Button>

        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background text-muted-foreground px-2">
              {t("orContinueWith")}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="w-full"
            type="button"
            disabled={isLoading}
          >
            <IconGithub className="h-4 w-4" /> GitHub
          </Button>
          <Button
            variant="outline"
            className="w-full"
            type="button"
            disabled={isLoading}
          >
            <IconFacebook className="h-4 w-4" /> Facebook
          </Button>
        </div>
      </form>
    </Form>
  );
}
