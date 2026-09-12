/**
 * `CreateProfileModal` — in-flow creation of AGENT business users
 * (`change: create-business-users-modal`, BR1–BR5).
 *
 * Product clarification: AGENTE (role AGENT) es un trabajador del negocio
 * al que le asignamos una propiedad para seguimiento. PROPIETARIO es un
 * hipotético cliente al que le administramos la propiedad — son dos cosas
 * distintas. Por eso este modal renderiza el formulario completo SOLO para
 * AGENT; para cualquier otro rol (hoy ADMINISTRATIVE para "Crear propietario")
 * muestra un stub vacío que se implementará en una pantalla dedicada.
 *
 * Client island owning a controlled 5-field form submitted through
 * `useActionState(createBusinessUserAction)`:
 * - Client gate: `createBusinessUserSchema.safeParse` at SUBMIT only
 *   (no debounce) — weak input never reaches the action (BR1).
 * - Server state: `fieldErrors` render under their field, `formError`
 *   renders once above the actions (BR5).
 * - Success fan-out: stable-id toast
 *   (`business-user-created-${role}`, dedupes the StrictMode
 *   double-effect) → close → `onCreated(toProfileOption(user))`
 *   (BR4, PR1). A `handledUserIdRef` guard keeps close + `onCreated`
 *   single-fire even if the effect re-runs.
 */

'use client';

import { startTransition, useActionState, useEffect, useId, useRef, useState } from 'react';

import { toast } from 'sonner';

import { createBusinessUserAction } from '@/lib/business-users/actions';
import type {
  BusinessUserFieldKey,
  CreateBusinessUserRole,
  ProfileOption,
} from '@/lib/business-users/types';
import { INITIAL_CREATE_BUSINESS_USER_STATE } from '@/lib/business-users/types';
import { toProfileOption } from '@/lib/business-users/types';
import { createBusinessUserSchema } from '@/lib/business-users/validation';

import { Dialog } from '@/components/ui/Dialog';

import { CONTROL_CLASSES, Field } from './form-fields';

const ROLE_OPTIONS: readonly { value: CreateBusinessUserRole; label: string }[] = [
  { value: 'AGENT', label: 'Agente' },
  { value: 'ADMINISTRATIVE', label: 'Administrativo' },
];

const FIELD_KEYS: readonly BusinessUserFieldKey[] = [
  'email',
  'firstName',
  'lastName',
  'password',
  'role',
];

export interface CreateProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "Crear agente" | "Crear propietario" — also the accessible name. */
  title: string;
  /** Threaded per combobox (PR3) — preselects the role field for AGENT. */
  role: CreateBusinessUserRole;
  /** Fires with the created option so the combobox can inject + select it (PR1). */
  onCreated?: (option: ProfileOption) => void;
}

export function CreateProfileModal({
  open,
  onOpenChange,
  title,
  role: initialRole,
  onCreated,
}: CreateProfileModalProps) {
  const titleId = useId();
  const formId = useId();

  const [state, formAction, isPending] = useActionState(
    createBusinessUserAction,
    INITIAL_CREATE_BUSINESS_USER_STATE,
  );

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<CreateBusinessUserRole>(initialRole);
  const [clientErrors, setClientErrors] = useState<Partial<Record<BusinessUserFieldKey, string>>>(
    {},
  );

  // BR4 fan-out. The ref guard (not just the stable toast id) keeps
  // close + onCreated single-fire under StrictMode double-effects.
  const handledUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (initialRole !== 'AGENT') return;
    if (!state?.success || !state?.user) return;
    const created = state.user;
    if (handledUserIdRef.current === created.id) return;
    handledUserIdRef.current = created.id;

    toast.success(
      `${created.firstName} ${created.lastName} (${created.email}) creado exitosamente`,
      {
        id: `business-user-created-${created.role}`,
        duration: 4000,
      },
    );
    setEmail('');
    setFirstName('');
    setLastName('');
    setPassword('');
    setRole(initialRole);
    setClientErrors({});
    onOpenChange(false);
    onCreated?.(toProfileOption(created));
  }, [initialRole, state?.success, state?.user, onOpenChange, onCreated]);

  // Propietario (hoy ADMINISTRATIVE) — stub vacío. Son dos entidades
  // distintas: el propietario es un hipotético cliente, no un worker.
  // El formulario completo queda SOLO para AGENT. El early return va
  // DESPUÉS de todos los hooks para cumplir react-hooks/rules-of-hooks.
  if (initialRole !== 'AGENT') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange} labelledBy={titleId}>
        <h2 id={titleId} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          La creación de propietarios se implementará en una pantalla dedicada.
        </p>
      </Dialog>
    );
  }

  const clearClientError = (key: BusinessUserFieldKey) => {
    setClientErrors((prev) => {
      if (prev[key] === undefined) return prev;
      const next: Partial<Record<BusinessUserFieldKey, string>> = {};
      for (const field of FIELD_KEYS) {
        if (field !== key && prev[field] !== undefined) next[field] = prev[field];
      }
      return next;
    });
  };

  const handleSubmit = () => {
    const payload = { email, firstName, lastName, password, role };
    const parsed = createBusinessUserSchema.safeParse(payload);
    if (!parsed.success) {
      const errors: Partial<Record<BusinessUserFieldKey, string>> = {};
      for (const issue of parsed.error.issues) {
        const [head] = issue.path;
        if (typeof head === 'string' && (FIELD_KEYS as readonly string[]).includes(head)) {
          const key = head as BusinessUserFieldKey;
          if (!errors[key]) errors[key] = issue.message;
        }
      }
      setClientErrors(errors);
      return;
    }
    setClientErrors({});
    startTransition(() => {
      formAction(parsed.data);
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (
      event.key === 'Enter' &&
      (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)
    ) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const errorFor = (key: BusinessUserFieldKey): string | undefined =>
    clientErrors[key] ?? state?.fieldErrors?.[key];

  const fieldId = (key: string) => `${formId}-${key}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} labelledBy={titleId}>
      <h2 id={titleId} className="text-lg font-semibold tracking-tight">
        {title}
      </h2>
      {/* Use a <div> instead of <form> to avoid invalid nested <form> inside
          the outer PropertyCreateForm's <form>. Submit is driven by button
          onClick and Enter handling. */}
      <div onKeyDown={handleKeyDown} className="mt-4 space-y-4">
        <Field id={fieldId('email')} label="Email" error={errorFor('email')} required>
          <input
            id={fieldId('email')}
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            disabled={isPending}
            onChange={(event) => {
              setEmail(event.target.value);
              clearClientError('email');
            }}
            className={CONTROL_CLASSES}
          />
        </Field>
        <Field id={fieldId('firstName')} label="Nombre" error={errorFor('firstName')} required>
          <input
            id={fieldId('firstName')}
            name="firstName"
            type="text"
            autoComplete="given-name"
            value={firstName}
            disabled={isPending}
            onChange={(event) => {
              setFirstName(event.target.value);
              clearClientError('firstName');
            }}
            className={CONTROL_CLASSES}
          />
        </Field>
        <Field id={fieldId('lastName')} label="Apellido" error={errorFor('lastName')} required>
          <input
            id={fieldId('lastName')}
            name="lastName"
            type="text"
            autoComplete="family-name"
            value={lastName}
            disabled={isPending}
            onChange={(event) => {
              setLastName(event.target.value);
              clearClientError('lastName');
            }}
            className={CONTROL_CLASSES}
          />
        </Field>
        <Field id={fieldId('password')} label="Contraseña" error={errorFor('password')} required>
          <input
            id={fieldId('password')}
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            disabled={isPending}
            onChange={(event) => {
              setPassword(event.target.value);
              clearClientError('password');
            }}
            className={CONTROL_CLASSES}
          />
        </Field>
        <Field id={fieldId('role')} label="Rol" error={errorFor('role')} required>
          <select
            id={fieldId('role')}
            name="role"
            value={role}
            disabled={isPending}
            onChange={(event) => {
              setRole(event.target.value as CreateBusinessUserRole);
              clearClientError('role');
            }}
            className={CONTROL_CLASSES}
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        {state?.formError ? (
          <p role="alert" className="text-sm text-destructive">
            {state.formError}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
            className="rounded-md border border-input px-4 py-2 text-sm transition-colors hover:bg-muted/60"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={handleSubmit}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-opacity disabled:opacity-60"
          >
            {isPending ? 'Creando…' : 'Crear'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
