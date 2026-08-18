import Image from 'next/image';
import Link from 'next/link';

import { AmbientOrbs } from '@/components/public/AmbientOrbs';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';

import { LoginForm } from '@/app/(public)/login/_components/LoginForm';

export default function LoginPage() {
  return (
    <Section
      ariaLabel="Ingreso a Casal Propiedades"
      className="login-page-surface relative isolate overflow-hidden py-0 sm:py-0 lg:py-0"
    >
      <AmbientOrbs className="z-0" />
      <Container className="max-w-none px-0 sm:px-0 lg:px-0">
        <div className="login-split-layout grid min-h-[calc(100svh-8rem)] md:grid-cols-2">
          <aside
            aria-label="Encontrá tu próximo hogar"
            className="login-photo-panel relative isolate hidden overflow-hidden md:order-1 md:flex"
          >
            <div className="login-photo-mask absolute -inset-x-4 -inset-y-10">
              <Image
                src="/img/login-1.webp"
                alt=""
                fill
                priority
                quality={75}
                sizes="(min-width: 768px) 50vw, 0px"
                className="login-photo-image object-cover object-[0%_100%]"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-br from-primary/55 via-primary/20 to-accent/50 mix-blend-multiply"
              />
            </div>

            <div className="relative z-10 flex w-full flex-col justify-end p-8 lg:p-14">
              <div className="max-w-lg text-primary-foreground">
                <h2 className="text-4xl leading-tight font-semibold tracking-tight lg:text-5xl">
                  Encontrá el lugar donde empieza tu próxima etapa.
                </h2>
                <p className="mt-5 max-w-md text-base leading-relaxed text-primary-foreground/80">
                  Tu próximo hogar está más cerca de lo que imaginás.
                </p>
              </div>
            </div>
          </aside>

          <div className="relative z-10 flex items-center justify-center my-4 px-4 py-16 sm:px-6 lg:order-2 lg:px-8">
            <div className=" w-full max-w-md rounded-3xl border border-border/70 p-6 shadow-xl sm:p-8">
              <header className="mb-8 space-y-2">
                <h1 className=" text-3xl font-semibold tracking-tight">Iniciar sesión</h1>
              </header>

              <LoginForm />

              <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                <span>o continuar con</span>
                <span className="h-px flex-1 bg-border" />
              </div>

              <Button type="button" variant="outline" size="lg" className="w-full">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" role="img">
                  <path
                    fill="currentColor"
                    d="M21.35 12.27c0-.71-.06-1.39-.18-2.05H12v3.88h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.7 2.91-4.2 2.91-7.22Z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 21.82c2.63 0 4.84-.87 6.45-2.33l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.7-1.72-5.47-4.03H3.28v2.53A9.75 9.75 0 0 0 12 21.82Z"
                  />
                  <path
                    fill="currentColor"
                    d="M6.53 13.93a5.86 5.86 0 0 1 0-3.75V7.65H3.28a9.82 9.82 0 0 0 0 8.81l3.25-2.53Z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 6.15c1.43 0 2.71.49 3.72 1.46l2.79-2.79C16.84 3.28 14.63 2.18 12 2.18a9.75 9.75 0 0 0-8.72 5.47l3.25 2.53C7.3 7.87 9.46 6.15 12 6.15Z"
                  />
                </svg>
                Continuar con Google
              </Button>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                ¿No tenés una cuenta?{' '}
                <Link
                  href="/registro"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Crear Cuenta
                </Link>
              </p>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
