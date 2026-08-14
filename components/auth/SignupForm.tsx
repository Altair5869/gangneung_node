"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

// lib/user-auth.ts의 PASSWORD_MIN_LENGTH(서버 측 최종 권위)와 값을 맞춰서 클라이언트에서도
// 동일한 하한을 보여준다. lib/user-auth.ts는 bcryptjs/@upstash/redis를 import하는 서버 전용
// 모듈이라 그대로 가져오면 브라우저 번들이 깨진다(app/api/checkins/eligibility/route.ts가
// lib/ai.ts를 클라이언트에서 직접 import하지 않는 이유와 동일 원칙) — 그래서 값만 복제하고
// 서버가 최종 검증한다(요구사항 문서 8번, 클라이언트 검증은 UX용, 서버 검증이 최종).
// CheckinForm.tsx가 CHECKIN_RADIUS_M(100m)을 UI 문구에 하드코딩하는 것과 같은 패턴.
const PASSWORD_MIN_LENGTH = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FormState = "idle" | "submitting" | "error";

// 이메일/비밀번호 회원가입(요구사항 문서 2·8번). 이메일 인증 발송/비밀번호 재설정 UI는
// 2026-08-14 축소안 확정에 따라 이 폼 어디에도 노출하지 않는다.
export default function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [state, setState] = useState<FormState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function clientValidationError(): string | null {
    if (!EMAIL_RE.test(email)) return "올바른 이메일 형식이 아닙니다";
    if (password.length < PASSWORD_MIN_LENGTH) return `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다`;
    if (password !== passwordConfirm) return "비밀번호가 일치하지 않습니다";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clientError = clientValidationError();
    if (clientError) {
      setErrorMessage(clientError);
      setState("error");
      return;
    }

    setState("submitting");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, passwordConfirm }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.error ?? "회원가입에 실패했어요");
        setState("error");
        return;
      }

      // 가입 성공 직후 Credentials provider로 바로 로그인시켜 세션을 발급한다(완료 기준
      // "등록한 이메일/비밀번호로 로그인하면 세션이 생성"과 연결되는 UX — 가입 따로, 로그인
      // 따로 두 번 입력하게 하지 않음). redirect:false로 호출해 이 컴포넌트가 결과를 직접
      // 처리한다.
      const signInResult = await signIn("credentials", { email, password, redirect: false });
      if (signInResult?.error) {
        // 가입 자체는 성공했으므로 로그인 페이지로 안내(레이트리밋 등으로 자동 로그인만 실패한
        // 드문 경우).
        router.push("/login");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setErrorMessage("네트워크 오류로 회원가입에 실패했어요");
      setState("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-background border border-dashed border-border rounded-2xl p-5 space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="signup-email" className="text-xs text-foreground/60">
          이메일
        </label>
        <input
          id="signup-email"
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
        <label htmlFor="signup-password" className="text-xs text-foreground/60">
          비밀번호 ({PASSWORD_MIN_LENGTH}자 이상)
        </label>
        <input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full text-sm rounded-xl border border-border bg-background px-3 py-2.5 text-foreground focus:outline-none focus:border-primary"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="signup-password-confirm" className="text-xs text-foreground/60">
          비밀번호 확인
        </label>
        <input
          id="signup-password-confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          className="w-full text-sm rounded-xl border border-border bg-background px-3 py-2.5 text-foreground focus:outline-none focus:border-primary"
        />
      </div>

      {state === "error" && errorMessage && <p className="text-xs text-bad">{errorMessage}</p>}

      <button
        type="submit"
        disabled={state === "submitting"}
        className="w-full text-center bg-[linear-gradient(135deg,var(--color-primary-dark),var(--color-hero-glow))] text-white py-3 rounded-2xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {state === "submitting" ? "가입 중..." : "회원가입"}
      </button>

      <p className="text-xs text-foreground/50 text-center">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="text-primary font-medium hover:underline">
          로그인
        </Link>
      </p>
      <p className="text-[11px] text-foreground/40 text-center">
        같은 이메일로 Google 로그인을 이미 사용 중이라면, 이 가입은 별도 계정으로 생성됩니다.
      </p>
    </form>
  );
}
