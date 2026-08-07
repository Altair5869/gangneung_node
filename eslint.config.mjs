import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // eslint-config-next의 기본 무시 목록(.next/**, out/**, build/**, next-env.d.ts)은 그대로 두고
  // 추가 무시 목록으로 "확장"한다 — 예전엔 이 globalIgnores 배열이 기본 목록을 다시 나열해
  // "대체"하는 것처럼 보였는데, 실제로는 여기 없는 패턴은 아예 무시되지 않는다는 뜻이었다.
  // 그래서 harness 스킬 파일(.agents/**, git 추적됨)과 워크트리 산출물(.claude/**, .next 빌드
  // 산출물 포함)이 lint 대상에 그대로 걸려 47개 에러 노이즈를 만들었다(2026-08-07, 옵션 K
  // 요구사항 3). 아래 목록은 기본 목록을 유지한 채 두 패턴만 추가한 것이다.
  globalIgnores([
    // eslint-config-next 기본 무시 목록:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 이번에 추가:
    ".agents/**",
    ".claude/**",
  ]),
]);

export default eslintConfig;
