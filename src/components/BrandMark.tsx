interface BrandMarkProps {
  readonly size: number;
  readonly className?: string;
}

/**
 * Decorative because every current use is paired with the readable NekoPath wordmark.
 * One shared source prevents the login, shell and install identities from drifting.
 */
export function BrandMark({ size, className }: BrandMarkProps) {
  return (
    <img
      alt=""
      aria-hidden="true"
      className={['brand-mark', className].filter(Boolean).join(' ')}
      decoding="async"
      height={size}
      src="/brand/nekopath-mark-v1-512.png"
      width={size}
    />
  );
}
