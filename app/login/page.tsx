import LoginForm from "@/components/auth/LoginForm";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";

export const metadata = {
  title: "로그인 | 강릉 노드",
};

// 이메일/비밀번호 회원가입 요구사항 문서 2번(UI 배치는 developer 판단): 기존 AuthButton의
// Google 원클릭 버튼은 그대로 두고(요구사항 1번), 이 라우트를 새 진입점으로 추가해 Google과
// 이메일/비밀번호 중 하나를 고를 수 있게 한다. "비밀번호를 잊으셨나요?" 링크는 축소안 확정에
// 따라 의도적으로 없음.
export default function LoginPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 py-16 w-full flex-1 space-y-5">
        <h1 className="text-xl font-bold text-foreground text-center">로그인</h1>

        <GoogleSignInButton />

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-foreground/40">또는</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <LoginForm />
      </div>
    </div>
  );
}
