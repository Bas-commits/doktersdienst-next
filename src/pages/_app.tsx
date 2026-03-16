import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { AuthenticatedLayout } from "@/components/layout/AuthenticatedLayout";
import { HasuraApolloProvider } from "@/lib/hasura-apollo-provider";

const AUTHENTICATED_PATHS = [
  "/dashboard",
  "/rooster-inzien",
  "/overnames",
  "/voorkeuren",
  "/mijn-gegevens",
  "/test",
];

function useIsAuthenticatedRoute(): boolean {
  const router = useRouter();
  return AUTHENTICATED_PATHS.some((path) => router.pathname === path);
}

export default function App({ Component, pageProps }: AppProps) {
  const useAuthenticatedLayout = useIsAuthenticatedRoute();

  if (useAuthenticatedLayout) {
    return (
      <HasuraApolloProvider>
        <AuthenticatedLayout>
          <Component {...pageProps} />
        </AuthenticatedLayout>
      </HasuraApolloProvider>
    );
  }

  return <Component {...pageProps} />;
}
