import { CurationRoute } from "@/types";

export interface SavedPlan {
  id: string;
  name: string;
  savedAt: string;
  route: CurationRoute;
}

const STORAGE_KEY = "wk_plans";

export function getPlans(): SavedPlan[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as SavedPlan[];
  } catch {
    return [];
  }
}

export function savePlan(name: string, route: CurationRoute): SavedPlan {
  const plan: SavedPlan = {
    id: `plan_${Date.now()}`,
    name,
    savedAt: new Date().toISOString(),
    route,
  };
  const plans = getPlans();
  plans.unshift(plan);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plans.slice(0, 20)));
  return plan;
}

export function deletePlan(id: string): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getPlans().filter((p) => p.id !== id)));
}

// base64 -> base64url (RFC 4648): '+'->'-', '/'->'_', '=' 패딩 제거.
// 쿼리스트링에 그대로 넣어도 안전하도록(특히 '+'가 URLSearchParams에 의해
// 공백으로 디코드되는 문제를 막기 위해) 표준 base64 대신 이 인코딩을 사용한다.
function base64ToBase64Url(base64: string): string {
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// base64url -> base64: '-'->'+', '_'->'/', 4의 배수가 되도록 '=' 패딩 복원.
// atob()는 패딩 없는 base64url 문자열을 받아들이지 않으므로 반드시 필요하다.
function base64UrlToBase64(base64Url: string): string {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (base64.length % 4)) % 4;
  return base64 + "=".repeat(padLength);
}

export function encodePlan(plan: SavedPlan): string {
  return base64ToBase64Url(btoa(encodeURIComponent(JSON.stringify(plan))));
}

export function decodePlan(encoded: string): SavedPlan | null {
  try {
    return JSON.parse(decodeURIComponent(atob(base64UrlToBase64(encoded)))) as SavedPlan;
  } catch {
    return null;
  }
}
