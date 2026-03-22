import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { AuthenticatedLayout } from "@/components/layout/AuthenticatedLayout";
import { Toaster } from "@/components/ui/sonner";

const AUTHENTICATED_PATHS = [
  "/dashboard",
  "/rooster-inzien",
  "/rooster-maken-secretaris",
  "/overnames",
  "/voorkeuren",
  "/mijn-gegevens",
  "/lijst-deelnemers",
  "/rollen-afmelden",
  "/waarneemgroep-gegevens",
  "/regio-toevoegen",
];

function useIsAuthenticatedRoute(): boolean {
  const router = useRouter();
  return AUTHENTICATED_PATHS.some((path) => router.pathname === path);
}

export default function App({ Component, pageProps }: AppProps) {
  const useAuthenticatedLayout = useIsAuthenticatedRoute();

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
