// node scripts/test-plan-compression.mjs
//
// lib/planner-storage.ts의 encodePlan/decodePlan 압축 로직을 실제 파일과 동일한 알고리즘으로
// 재현해(scripts/test-haversine.mjs와 같은 방식 — 별도 런타임 없이 순수 node로 검증) 5스팟
// 실사용 시나리오에서 URL payload 바이트 수가 압축 전/후로 얼마나 줄어드는지 측정한다.
// verified_spots.json의 실제 description(관광공사 overview 기반)을 사용해 pm-analyst가
// 측정한 "5스팟 12,277자" 시나리오를 최대한 재현한다.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const verifiedSpots = JSON.parse(
  readFileSync(path.join(__dirname, "data", "verified_spots.json"), "utf8")
);

// ── planner-storage.ts와 동일한 인코딩 로직 (검증용 재현) ──────────────────

function base64ToBase64Url(base64) {
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return Buffer.from(binary, "binary").toString("base64");
}

async function gzipCompress(input) {
  const bytes = new TextEncoder().encode(input);
  const cs = new CompressionStream("gzip");
  const writer = cs.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const compressed = await new Response(cs.readable).arrayBuffer();
  return new Uint8Array(compressed);
}

async function encodePlanCompressed(plan) {
  const json = JSON.stringify(plan);
  const compressed = await gzipCompress(json);
  return "1" + base64ToBase64Url(bytesToBase64(compressed));
}

function encodePlanRaw(plan) {
  const json = JSON.stringify(plan);
  return "0" + base64ToBase64Url(Buffer.from(encodeURIComponent(json), "utf8").toString("base64"));
}

// ── 5스팟 실사용 시나리오 구성 (실제 verified_spots.json 데이터 사용) ──────

const spots = verifiedSpots.slice(0, 5);

const plan = {
  id: "plan_1735900000000",
  name: "강릉 오션뷰 워케이션 1박2일",
  savedAt: new Date().toISOString(),
  route: {
    spots,
    totalDuration: 8,
    description:
      "강문해변 오션뷰 카페에서 오전 작업을 시작해 도보로 이동 가능한 거리의 스팟들을 " +
      "09:00~18:00 사이에 순차 방문하는 동선입니다. 3~4시간 단위로 장소를 옮기며 " +
      "집중 작업과 휴식을 번갈아 가져가는 구성입니다.",
    tips: [
      "오전 09:00~11:00은 카페가 한산해 집중 작업에 유리합니다.",
      "점심 12:00~13:30은 혼잡할 수 있어 이 시간대를 피해 이동하는 것을 권장합니다.",
      "저녁 18:00 이후에는 일부 매장이 조용해지므로 마무리 작업에 적합합니다.",
    ],
    validationNote: "무장애 접근성 및 콘센트 보유 조건을 코드 기반으로 검증했습니다.",
  },
};

const jsonString = JSON.stringify(plan);
const jsonBytes = new TextEncoder().encode(jsonString).length;

const rawEncoded = encodePlanRaw(plan);
const compressedEncoded = await encodePlanCompressed(plan);

const rawUrl = `https://gangneung-node.example.com/planner?share=${rawEncoded}`;
const compressedUrl = `https://gangneung-node.example.com/planner?share=${compressedEncoded}`;

console.log("── 강릉 노드 /planner 공유 URL 압축 검증 (5스팟 실데이터 기준) ──");
console.log(`스팟 수: ${spots.length}`);
console.log(`원본 JSON: ${jsonString.length}자 / ${jsonBytes}바이트(UTF-8)`);
console.log("");
console.log(`[압축 전] encodePlan 출력 길이: ${rawEncoded.length}자`);
console.log(`[압축 전] 공유 URL 전체 길이:   ${rawUrl.length}자`);
console.log("");
console.log(`[압축 후] encodePlan 출력 길이: ${compressedEncoded.length}자`);
console.log(`[압축 후] 공유 URL 전체 길이:   ${compressedUrl.length}자`);
console.log("");
const ratio = (1 - compressedEncoded.length / rawEncoded.length) * 100;
console.log(`압축률: ${ratio.toFixed(1)}% 감소`);
console.log(`8KB(8192바이트) 상한 대비 압축 후 URL: ${compressedUrl.length}바이트 → ${compressedUrl.length < 8192 ? "통과" : "초과"}`);
