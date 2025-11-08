import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/40 backdrop-blur">
        <SignUp signInUrl="/sign-in" />
      </div>
    </div>
  );
}
