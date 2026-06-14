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

export function encodePlan(plan: SavedPlan): string {
  return btoa(encodeURIComponent(JSON.stringify(plan)));
}

export function decodePlan(encoded: string): SavedPlan | null {
  try {
    return JSON.parse(decodeURIComponent(atob(encoded))) as SavedPlan;
  } catch {
    return null;
  }
}
