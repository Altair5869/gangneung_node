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

// 인코딩된 문자열 맨 앞 1글자로 포맷을 구분한다: "1" = gzip 압축, "0" = 비압축(폴백).
// CompressionStream 미지원 브라우저가 만든 공유 링크를, 지원 브라우저가 열 수도 있고
// 그 반대도 가능해야 하므로 "현재 브라우저의 지원 여부"가 아니라 이 마커로 분기해야 한다.
const FORMAT_COMPRESSED = "1";
const FORMAT_RAW = "0";

function bytesToBase64(bytes: Uint8Array<ArrayBuffer>): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function gzipCompress(input: string): Promise<Uint8Array<ArrayBuffer>> {
  const bytes = new TextEncoder().encode(input);
  const cs = new CompressionStream("gzip");
  const writer = cs.writable.getWriter();
  void writer.write(bytes);
  void writer.close();
  const compressed = await new Response(cs.readable).arrayBuffer();
  return new Uint8Array(compressed);
}

async function gzipDecompress(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  void writer.write(bytes);
  void writer.close();
  const decompressed = await new Response(ds.readable).arrayBuffer();
  return new TextDecoder().decode(decompressed);
}

// CompressionStream(gzip)으로 압축 후 base64url화해 공유 URL 길이를 줄인다(설계는
// docs 참고 없이 이번 버그 수정으로 도입). 구형 브라우저 등 CompressionStream이 없는
// 환경에서는 기존 비압축 방식으로 폴백해 완전히 깨지지 않게 한다.
export async function encodePlan(plan: SavedPlan): Promise<string> {
  const json = JSON.stringify(plan);
  if (typeof CompressionStream !== "undefined") {
    try {
      const compressed = await gzipCompress(json);
      return FORMAT_COMPRESSED + base64ToBase64Url(bytesToBase64(compressed));
    } catch {
      // 압축 경로 실패 시 비압축 폴백으로 진행
    }
  }
  return FORMAT_RAW + base64ToBase64Url(btoa(encodeURIComponent(json)));
}

export async function decodePlan(encoded: string): Promise<SavedPlan | null> {
  try {
    const format = encoded.charAt(0);
    const payload = encoded.slice(1);
    if (format === FORMAT_COMPRESSED) {
      if (typeof DecompressionStream === "undefined") return null;
      const bytes = base64ToBytes(base64UrlToBase64(payload));
      const json = await gzipDecompress(bytes);
      return JSON.parse(json) as SavedPlan;
    }
    if (format === FORMAT_RAW) {
      return JSON.parse(decodeURIComponent(atob(base64UrlToBase64(payload)))) as SavedPlan;
    }
    return null;
  } catch {
    return null;
  }
}
