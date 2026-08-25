import type { Role } from '@/lib/auth/roles';
import { cn } from '@/lib/utils';

export interface UserBlockProps {
  /**
   * Visible display name from the resolved `AdminUser` payload.
   * `null` when the JWT carries no usable identity text (no `username`,
   * no `email`). The block hides the name row in that case — the role
   * badge alone is shown.
   */
  displayName: string | null;
  /**
   * Decoded role claim (privileged subset only — D5 fail-closed).
   *
   * Named `userRole` (not `role`) to avoid `jsx-a11y/aria-role`
   * over-eager flagging at every JSX call site — `role` is also the
   * HTML ARIA attribute and ESLint cannot tell the two apart.
   */
  userRole: Role;
  /** Optional extra classes appended to the root element. */
  className?: string;
}

/**
 * `UserBlock` — presentational identity strip used by the admin
 * Sidebar footer and the MobileNav drawer.
 *
 * - Pure / no hooks: safe to render from both Server Components and
 *   Client Components. The RSC layout passes the resolved `AdminUser`
 *   as a prop, so this component never touches cookies.
 * - `displayName === null` falls back to an empty name row (no crash,
 *   no literal "null" string). The role badge always renders — the
 *   role is the privileged-set literal, never `null`.
 * - Stable `data-testid` markers (`user-block`, `user-block-name`,
 *   `user-block-role`) so layout-level tests can target the pieces
 *   without coupling to class names.
 */
export function UserBlock({ displayName, userRole, className }: UserBlockProps) {
  return (
    <div
      data-testid="user-block"
      className={cn('flex flex-row items-center gap-2 text-sm', className)}
    >
      <span data-testid="user-block-name" className="font-medium leading-tight">
        {displayName ?? ''}
      </span>
      <span
        data-testid="user-block-role"
        className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {userRole}
      </span>
    </div>
  );
}
