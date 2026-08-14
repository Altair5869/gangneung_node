import SignupForm from "@/components/auth/SignupForm";

export const metadata = {
  title: "회원가입 | 강릉 노드",
};

// 이메일/비밀번호 회원가입 요구사항 문서 2번. 이메일 인증 발송 UI는 2026-08-14 축소안 확정에
// 따라 넣지 않는다 — 이메일 형식 검증만 하고 즉시 가입 허용.
export default function SignupPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 py-16 w-full flex-1 space-y-5">
        <h1 className="text-xl font-bold text-foreground text-center">회원가입</h1>
        <SignupForm />
      </div>
    </div>
  );
}
