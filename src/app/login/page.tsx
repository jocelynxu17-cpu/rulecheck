import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-zinc-500">載入中…</div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
