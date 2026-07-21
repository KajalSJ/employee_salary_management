import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-lg border border-border p-6">
        <div className="mb-6 flex flex-col gap-1 text-center">
          <h1 className="text-lg font-semibold">ACME HR</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to manage employee salary data.
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
