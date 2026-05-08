import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { AuthenticatedLayout } from "@/components/layout/AuthenticatedLayout";
import { Toaster } from "@/components/ui/sonner";
import { isAuthenticatedPath } from "@/lib/route-access";

function useIsAuthenticatedRoute(): boolean {
  const router = useRouter();
  return isAuthenticatedPath(router.pathname);
}

export default function App({ Component, pageProps }: AppProps) {
  const useAuthenticatedLayout = useIsAuthenticatedRoute();

  useEffect(() => {
    // fetch("/api/health").catch(() => {});
  }, []);

  if (useAuthenticatedLayout) {
    return (
      <>
        <AuthenticatedLayout>
          <Component {...pageProps} />
        </AuthenticatedLayout>
        <Toaster />
      </>
    );
  }

  return (
    <>
      <Component {...pageProps} />
      <Toaster />
    </>
  );
}
