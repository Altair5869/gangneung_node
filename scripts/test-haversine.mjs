// node scripts/test-haversine.mjs

function hypotDist(lat1, lng1, lat2, lng2) {
  return Math.hypot(lat2 - lat1, lng2 - lng1);
}

function haversineDist(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestNeighborSort(spots, distFn) {
  if (spots.length <= 2) return spots;
  const remaining = [...spots];
  const result = [remaining.splice(0, 1)[0]];
  while (remaining.length > 0) {
    const cur = result[result.length - 1];
    let nearestIdx = 0;
    let nearestDist = Infinity;
    remaining.forEach((s, i) => {
      const d = distFn(cur.lat, cur.lng, s.lat, s.lng);
      if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
    });
    result.push(remaining.splice(nearestIdx, 1)[0]);
  }
  return result;
}

// ── 테스트 케이스 설계 ────────────────────────────────────────────────────
//
// 위도 37.75°N에서 1° 경도 ≈ 88.1 km, 1° 위도 ≈ 111.3 km
// → 경도 1도는 위도 1도보다 실제로 약 21% 짧다.
// → Math.hypot은 이 차이를 무시하고 도(°) 단위를 같은 스케일로 취급한다.
//
// 아래 케이스에서 출발점(S)으로부터:
//   A (정동진 방향, 동쪽): Δlng = +0.060° → hypot=0.0600 / haversine=5.28 km
//   B (경포호 방향, 북쪽): Δlat = +0.055° → hypot=0.0550 / haversine=6.12 km
//
//   Math.hypot → B가 더 가깝다(0.055 < 0.060) → S → B → A
//   Haversine  → A가 더 가깝다(5.28 < 6.12)  → S → A → B
//                                                  ↑ 실제로 0.84 km 더 짧은 경로

const spots = [
  { id: "S", name: "안목해변 카페거리(출발)", lat: 37.7500, lng: 128.9000 },
  { id: "A", name: "정동진 해변(동쪽 5.3 km)", lat: 37.7500, lng: 128.9600 },
  { id: "B", name: "경포호(북쪽 6.1 km)",      lat: 37.8045, lng: 128.9000 },
];

const S = spots[0];
const A = spots[1];
const B = spots[2];

console.log("=== S → A 거리 ===");
console.log(`  Math.hypot : ${hypotDist(S.lat, S.lng, A.lat, A.lng).toFixed(5)} (도 단위)`);
console.log(`  Haversine  : ${haversineDist(S.lat, S.lng, A.lat, A.lng).toFixed(2)} km`);

console.log("\n=== S → B 거리 ===");
console.log(`  Math.hypot : ${hypotDist(S.lat, S.lng, B.lat, B.lng).toFixed(5)} (도 단위)`);
console.log(`  Haversine  : ${haversineDist(S.lat, S.lng, B.lat, B.lng).toFixed(2)} km`);

const oldOrder = nearestNeighborSort(spots, hypotDist);
const newOrder = nearestNeighborSort(spots, haversineDist);

const oldNames = oldOrder.map(s => s.name);
const newNames = newOrder.map(s => s.name);

console.log("\n=== 정렬 결과 비교 ===");
console.log(`  Math.hypot 기반 : ${oldNames.join(" → ")}`);
console.log(`  Haversine 기반  : ${newNames.join(" → ")}`);

// 두 경로의 실제 총 거리 계산
function totalHaversine(route) {
  let total = 0;
  for (let i = 1; i < route.length; i++)
    total += haversineDist(route[i-1].lat, route[i-1].lng, route[i].lat, route[i].lng);
  return total;
}

const oldKm = totalHaversine(oldOrder).toFixed(2);
const newKm = totalHaversine(newOrder).toFixed(2);

console.log("\n=== 실제 이동 거리 (하버사인 기준) ===");
console.log(`  Math.hypot 경로 총 거리 : ${oldKm} km`);
console.log(`  Haversine  경로 총 거리 : ${newKm} km`);

const diff = (parseFloat(oldKm) - parseFloat(newKm)).toFixed(2);
if (JSON.stringify(oldOrder.map(s=>s.id)) !== JSON.stringify(newOrder.map(s=>s.id))) {
  console.log(`\n  !! 순서 달라짐 — Haversine 경로가 ${diff} km 더 짧습니다.`);
} else {
  console.log("\n  순서 동일.");
}
