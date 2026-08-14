"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

type FormState = "idle" | "submitting" | "error";

const GENERIC_ERROR = "이메일 또는 비밀번호가 올바르지 않습니다";
const RATE_LIMIT_ERROR = "로그인 시도가 너무 많아요. 잠시 후 다시 시도해주세요.";

// 이메일/비밀번호 로그인(요구사항 문서 4·6번). 계정 미존재/비밀번호 틀림을 구분하지 않고
// 항상 동일한 문구를 보여준다. "비밀번호를 잊으셨나요?" 링크는 2026-08-14 축소안 확정에 따라
// 의도적으로 넣지 않는다(재설정 기능 자체가 없음).
export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<FormState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage(GENERIC_ERROR);
      setState("error");
      return;
    }

    setState("submitting");
    setErrorMessage(null);
    try {
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        // auth.ts의 LoginRateLimitedError만 code:"rate_limited"로 구분한다 — 그 외 모든 실패
        // (계정 없음/비밀번호 틀림)는 code:"credentials"로 동일하게 취급해 동일 문구로 보여준다
        // (계정 존재 여부 유출 방지, 요구사항 문서 6번).
        setErrorMessage(result.code === "rate_limited" ? RATE_LIMIT_ERROR : GENERIC_ERROR);
        setState("error");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setErrorMessage("네트워크 오류로 로그인에 실패했어요");
      setState("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-background border border-dashed border-border rounded-2xl p-5 space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="login-email" className="text-xs text-foreground/60">
          이메일
        </label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full text-sm rounded-xl border border-border bg-background px-3 py-2.5 text-foreground focus:outline-none focus:border-primary"
          placeholder="you@example.com"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="login-password" className="text-xs text-foreground/60">
          비밀번호
        </label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full text-sm rounded-xl border border-border bg-background px-3 py-2.5 text-foreground focus:outline-none focus:border-primary"
        />
      </div>

      {state === "error" && errorMessage && <p className="text-xs text-bad">{errorMessage}</p>}

      <button
        type="submit"
        disabled={state === "submitting"}
        className="w-full text-center bg-[linear-gradient(135deg,var(--color-primary-dark),var(--color-hero-glow))] text-white py-3 rounded-2xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {state === "submitting" ? "로그인 중..." : "로그인"}
      </button>

      <p className="text-xs text-foreground/50 text-center">
        계정이 없으신가요?{" "}
        <Link href="/signup" className="text-primary font-medium hover:underline">
          회원가입
        </Link>
      </p>
    </form>
  );
}
