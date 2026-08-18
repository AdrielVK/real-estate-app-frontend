import {
  Children,
  cloneElement,
  type ComponentPropsWithoutRef,
  forwardRef,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';

import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  // Base — shared layout, focus, disabled behavior.
  // `gap-2` keeps multi-content buttons (icon + label) optically balanced
  // regardless of icon size; `rounded-full` matches the v0 pill silhouette.
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-full font-medium transition-all duration-300 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          // Bosque: copper-tinted halo softens the elevation without
          // leaning on a flat drop-shadow.
          'bg-primary text-primary-foreground hover:brightness-110 shadow-[0_10px_24px_-14px_color-mix(in_oklch,var(--primary)_70%,transparent)]',
        secondary: 'bg-secondary text-secondary-foreground hover:brightness-95',
        outline: 'border border-border bg-transparent hover:bg-secondary/70',
        ghost: 'bg-transparent hover:bg-secondary/70',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-11 px-5 text-sm',
        // Icon-only — square footprint, child SVG inherits size from the
        // base gap-2 + `size-4` defaults applied by callers via lucide.
        'icon-lg': 'size-11',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export type ButtonProps = ComponentPropsWithoutRef<'button'> &
  VariantProps<typeof buttonVariants> & {
    /**
     * When `true`, render the child element instead of a `<button>` and
     * forward the button's props/ref to it. Enables `<Button asChild><a/></Button>`.
     * Uses a minimal Slot implementation via `cloneElement` — no Radix dependency.
     */
    asChild?: boolean;
  };

/**
 * `Button` — primary interactive primitive.
 *
 * - Always `type="button"` by default (form-safe).
 * - `variant` (primary | secondary | outline | ghost) and `size`
 *   (sm | md | lg | icon-lg) are exposed via `class-variance-authority`.
 * - `forwardRef` so parents (tooltips, focus managers) can attach refs.
 * - `asChild` merges button props/ref into a single child element so links,
 *   Next/Link, etc. get the visual treatment without losing semantics.
 *
 * Note on the ref type: `HTMLElement` is used so `asChild` can target any
 * element (anchor, Next/Link, etc.). The default `<button>` ref still
 * resolves to `HTMLButtonElement` at the call site via `useRef<HTMLButtonElement>`.
 */
export const Button = forwardRef<HTMLElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    asChild = false,
    className,
    type = 'button',
    children,
    ...rest
  },
  ref,
) {
  const classes = cn(buttonVariants({ variant, size }), className);

  if (asChild) {
    return (
      <Slot ref={ref} className={classes} {...rest}>
        {children}
      </Slot>
    );
  }

  return (
    <button ref={ref as React.Ref<HTMLButtonElement>} type={type} className={classes} {...rest}>
      {children}
    </button>
  );
});

// ---------------------------------------------------------------------------
// Slot — minimal `asChild` implementation.
//
// Mirrors the intent of `@radix-ui/react-slot` without pulling the runtime:
// recursively walks a single child element, merges `className` (our own
// wins via `cn`), forwards refs, and preserves event handlers from the
// parent so consumers don't need to re-wire `onClick`.
// ---------------------------------------------------------------------------

interface SlotChildProps {
  className?: string;
  ref?: React.Ref<HTMLElement>;
}

interface SlotProps {
  children: ReactNode;
  className?: string;
  // Allow any extra props to flow through to the child element (data-*
  // attributes, aria-*, event handlers, etc.) without narrowing the
  // well-typed properties above. The `unknown` index signature is
  // wider than `any` for assignability purposes and works correctly
  // with `cn` (which expects `ClassValue`).
  [key: string]: unknown;
}

const Slot = forwardRef<HTMLElement, SlotProps>(function Slot(
  { children, className, ...slotProps },
  forwardedRef,
) {
  // A `Slot` MUST have exactly one React element child — assert that
  // early so misuse fails loudly during development.
  const child = Children.only(children);
  if (!isValidElement(child)) {
    throw new Error('Button: `asChild` requires a single React element child.');
  }
  const element = child as ReactElement<SlotChildProps>;

  // Merge refs — the parent's `ref` sees the underlying DOM element, the
  // child's ref (if any) keeps working as expected.
  const mergedRef = mergeRefs(forwardedRef, element.props.ref ?? null);

  // Merge className: child first, then parent so the parent (Button) wins
  // on Tailwind conflicts via `cn` / `twMerge`. The cast widens the
  // index-signature-inferred `unknown` back to `ClassValue`.
  const mergedClassName = cn(element.props.className, className as string | undefined);

  // Strip `children` so it isn't double-applied via `{...slotProps}`.
  const { children: _children, ...rest } = slotProps;
  void _children;

  return cloneElement(element, {
    ...(rest as Record<string, unknown>),
    ...(element.props as Record<string, unknown>),
    ref: mergedRef,
    className: mergedClassName,
  });
});

function mergeRefs<T>(...refs: (React.Ref<T> | null | undefined)[]) {
  return (node: T) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === 'function') {
        ref(node);
      } else {
        // Mutable ref object — assign directly.
        (ref as React.MutableRefObject<T | null>).current = node;
      }
    }
  };
}
