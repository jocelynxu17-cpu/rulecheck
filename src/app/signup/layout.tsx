import Link from "next/link";

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-page-gradient px-4 py-10 sm:px-6">
      <div className="mx-auto mb-8 flex max-w-md items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#B8D9FF] to-brand shadow-soft text-white">
            R
          </span>
          RuleCheck
        </Link>
        <Link href="/pricing" className="text-sm font-medium text-ink-secondary hover:text-brand-strong">
          定價
        </Link>
      </div>
      <div className="mx-auto max-w-md">{children}</div>
    </div>
  );
}
