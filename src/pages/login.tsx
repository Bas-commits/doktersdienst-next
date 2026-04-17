import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
} from '@/components/ui/carousel';

const DEFAULT_AFTER_LOGIN_URL = '/rooster-inzien';
const BRAND_RED = '#d1262c';

type LoginCarouselSlide = {
  /** Path under `public/`, e.g. `/checkboxes.png` */
  imageSrc: string;
  imageAlt: string;
  imageWidth: number;
  imageHeight: number;
  /** Use for GIFs or when Next image optimization should be skipped */
  imageUnoptimized?: boolean;
  headline: string;
  body: string;
};

/** Edit each slide’s image path, title, and body here. */
const LOGIN_CAROUSEL_SLIDES: LoginCarouselSlide[] = [
  {
    imageSrc: '/bellen_dienstdoende.gif',
    imageAlt: '',
    imageWidth: 320,
    imageHeight: 240,
    imageUnoptimized: true,
    headline: 'WebPortal en telefooncentrale',
    body: 'Uw dienstrooster automatisch gesynchroniseerd met de telefooncentrale.',
  },
  {
    imageSrc: '/Grootgifrood.gif',
    imageAlt: '',
    imageWidth: 367,
    imageHeight: 222,
    headline: 'Rooster voorkeuren aangeven',
    body: 'Aan het begin van de planningscyclus geven deelnemers hun voorkeuren op: welke diensten ze willen, liever vermijden, of niet kunnen door vakantie of nascholing.',
  },
  {
    imageSrc: '/Overnames.gif',
    imageAlt: '',
    imageWidth: 367,
    imageHeight: 222,
    headline: 'Dienst overnemen snel onderling geregeld',
    body: 'Tot vlak voor of zelfs tijdens een dienst kunnen deelnemers een dienst (gedeeltelijk) overnemen. Na telefonisch overleg dient één van beiden een overnamevoorstel in; de ander keurt het goed en daarmee is de wissel een feit.',
  },
];

const SLIDE_COUNT = LOGIN_CAROUSEL_SLIDES.length;

function LoginPromoCarousel() {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(1);

  const recompute = useCallback((carouselApi: CarouselApi | undefined) => {
    if (!carouselApi) return;
    setCurrent(carouselApi.selectedScrollSnap() + 1);
  }, []);

  useEffect(() => {
    if (!api) return;
    recompute(api);
    const onSelect = () => recompute(api);
    api.on('select', onSelect);
    api.on('reInit', onSelect);
    return () => {
      api.off('select', onSelect);
      api.off('reInit', onSelect);
    };
  }, [api, recompute]);

  return (
    <Carousel
      setApi={setApi}
      opts={{ align: 'start', loop: true }}
      className="flex w-full max-w-lg flex-1 flex-col justify-center"
    >
      <div className="mb-8 flex items-center justify-center gap-6 text-white">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 text-white hover:bg-white/15"
          disabled={!api?.canScrollPrev()}
          onClick={() => api?.scrollPrev()}
          aria-label="Vorige slide"
        >
          <ChevronLeft className="size-8" strokeWidth={2} />
        </Button>
        <span className="min-w-[4ch] text-center text-sm font-bold tabular-nums">
          {current} / {SLIDE_COUNT}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 text-white hover:bg-white/15"
          disabled={!api?.canScrollNext()}
          onClick={() => api?.scrollNext()}
          aria-label="Volgende slide"
        >
          <ChevronRight className="size-8" strokeWidth={2} />
        </Button>
      </div>

      <CarouselContent className="ml-0">
        {LOGIN_CAROUSEL_SLIDES.map((slide, i) => (
          <CarouselItem key={`login-carousel-${i}`} className="basis-full pl-0">
            <div className="flex flex-col items-center px-15 text-center text-white ">
              <Image
                src={slide.imageSrc}
                alt={slide.imageAlt}
                width={slide.imageWidth}
                height={slide.imageHeight}
                className="m-8 w-full max-w-[480px] rounded-lg"
                priority={i === 0}
                unoptimized={slide.imageUnoptimized ?? false}
              />
        
              <h2 className="mb-4 text-2xl font-bold tracking-tight md:text-3xl">
                {slide.headline}
              </h2>
              <p className="max-w-md text-sm leading-relaxed text-white/95 md:text-base">
                {slide.body}
              </p>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const afterLoginUrl = useMemo(() => {
    const raw = router.query.callbackUrl;
    if (
      typeof raw === 'string' &&
      raw.startsWith('/') &&
      !raw.startsWith('//')
    ) {
      return raw;
    }
    return DEFAULT_AFTER_LOGIN_URL;
  }, [router.query.callbackUrl]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const { data, error: signInError } = await authClient.signIn.email(
      {
        email,
        password,
        callbackURL: afterLoginUrl,
      },
      {
        onSuccess: () => {
          router.push(afterLoginUrl);
        },
      }
    );

    setIsLoading(false);

    if (signInError) {
      setError(signInError.message ?? 'Inloggen mislukt');
      return;
    }

    if (data) {
      router.push(afterLoginUrl);
    }
  }

  return (
    <>
      <Head>
        <title>Inloggen | Doktersdienst</title>
      </Head>
      <div className="flex min-h-screen flex-col lg:min-h-0 lg:h-screen lg:flex-row">
        <main className="flex flex-1 flex-col justify-center bg-white px-6 py-10 sm:px-10 lg:overflow-y-auto lg:py-14">
          <div className="mx-auto w-full min-w-[400px] max-w-md p-5 rounded-lg border-2 border-gray-300">
            {/* <p className="mb-6 text-sm leading-relaxed text-[#d1262c]">
              Als U voor de eerste keer inlogd op deze nieuwe site, moet u met
              de link hieronder een nieuw wachtwoord aanmaken.
            </p> */}

            <div className="mb-8">
              <div className="flex justify-center items-center">
                <Image
                  src="/logo.png"
                  alt="DoktersDienst logo"
                  width={320}
                  height={80}
                  className="h-auto w-full max-w-[280px]"
                  priority
                  unoptimized={true}
                />
              </div>
        
        
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              {error && (
                <p
                  className="text-sm text-destructive"
                  role="alert"
                  data-testid="login-error"
                >
                  {error}
                </p>
              )}

              <div className="flex flex-col gap-2">
                <Label htmlFor="email" className="text-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder=""
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={isLoading}
                  className="h-10 border-neutral-300 bg-rose-50/50 md:h-11"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="password" className="text-foreground">
                  Wachtwoord
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder=""
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={isLoading}
                  className="h-10 border-neutral-300 bg-rose-50/50 md:h-11"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                data-testid="login-submit"
                className="mx-auto h-11 min-w-[200px] rounded-xl bg-linear-to-b from-[#d1262c] to-[#a81f24] px-8 text-white shadow-md hover:from-[#b92228] hover:to-[#951b20]"
              >
                {isLoading ? 'Bezig met inloggen…' : 'Inloggen'}
              </Button>
            </form>

            <p className="mt-8 text-center text-sm text-neutral-600">
              Wachtwoord vergeten of eerste keer dat u inlogt?{' '}
              <Link
                href="/signup"
                className="font-medium text-foreground underline underline-offset-2 hover:text-[#d1262c]"
              >
                Klik hier 
              </Link>{' '}
              om een nieuw wachtwoord aan te maken of te resetten
            </p>
          </div>
        </main>

        <aside
          className="flex flex-1 flex-row justify-center px-6 py-12 sm:px-10 lg:min-h-0 lg:py-10 min-w-[400px]"
          style={{ backgroundColor: BRAND_RED }}
        >
          <LoginPromoCarousel />
        </aside>
      </div>
    </>
  );
}
