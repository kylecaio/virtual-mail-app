import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-sm text-inkMuted">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
