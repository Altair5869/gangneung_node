// node scripts/test-weather-basetime.mjs
// lib/utils.ts의 computeWeatherBaseDateTime()과 동일한 로직을 복제해 AC2 경계 케이스 3종을
// 검증한다(scripts/test-haversine.mjs와 동일한 패턴 — 순수 로직만 떼어내 독립 실행).

const WEATHER_ANNOUNCE_HOURS = [23, 20, 17, 14, 11, 8, 5, 2];

function computeWeatherBaseDateTime(now = new Date()) {
  const effective = new Date(now.getTime() + 9 * 60 * 60 * 1000 - 10 * 60 * 1000);
  const hour = effective.getUTCHours();
  const y = effective.getUTCFullYear();
  const m = String(effective.getUTCMonth() + 1).padStart(2, "0");
  const d = String(effective.getUTCDate()).padStart(2, "0");

  const found = WEATHER_ANNOUNCE_HOURS.find((t) => hour >= t);
  if (found !== undefined) {
    return { baseDate: `${y}${m}${d}`, baseTime: `${String(found).padStart(2, "0")}00` };
  }

  const prev = new Date(effective.getTime() - 24 * 60 * 60 * 1000);
  const py = prev.getUTCFullYear();
  const pm = String(prev.getUTCMonth() + 1).padStart(2, "0");
  const pd = String(prev.getUTCDate()).padStart(2, "0");
  return { baseDate: `${py}${pm}${pd}`, baseTime: "2300" };
}

// KST 벽시계 시각을 지정해 그 시각에 해당하는 UTC Date를 만든다 (KST = UTC+9).
function kstWallClock(y, m, d, hh, mm) {
  return new Date(Date.UTC(y, m - 1, d, hh - 9, mm));
}

const cases = [
  {
    label: "(a) KST 2026-08-19 01:00 → 전날(08-18) 23:00 발표",
    now: kstWallClock(2026, 8, 19, 1, 0),
    expected: { baseDate: "20260818", baseTime: "2300" },
  },
  {
    label: "(b) KST 2026-08-19 02:00 정각 → 아직 미반영, 전날(08-18) 23:00 발표",
    now: kstWallClock(2026, 8, 19, 2, 0),
    expected: { baseDate: "20260818", baseTime: "2300" },
  },
  {
    label: "(c) KST 2026-08-19 02:10 → 반영 완료, 당일(08-19) 02:00 발표",
    now: kstWallClock(2026, 8, 19, 2, 10),
    expected: { baseDate: "20260819", baseTime: "0200" },
  },
  // 추가 회귀 케이스: 일반 시간대(자정 경계 아님)도 확인. 10분 지연 때문에 14:05는 아직
  // 14:00 발표가 반영되지 않은 시점이다 — 14:15가 돼야 14:00 발표로 전환된다.
  {
    label: "(d) KST 2026-08-19 14:15 → 당일 14:00 발표",
    now: kstWallClock(2026, 8, 19, 14, 15),
    expected: { baseDate: "20260819", baseTime: "1400" },
  },
  {
    label: "(e) KST 2026-08-19 14:09 (10분 지연 경계 직전) → 아직 11:00 발표",
    now: kstWallClock(2026, 8, 19, 14, 9),
    expected: { baseDate: "20260819", baseTime: "1100" },
  },
];

let allPass = true;
for (const c of cases) {
  const result = computeWeatherBaseDateTime(c.now);
  const pass = result.baseDate === c.expected.baseDate && result.baseTime === c.expected.baseTime;
  if (!pass) allPass = false;
  console.log(
    `${pass ? "PASS" : "FAIL"} ${c.label} → got baseDate=${result.baseDate} baseTime=${result.baseTime} (expected ${c.expected.baseDate}/${c.expected.baseTime})`
  );
}

process.exit(allPass ? 0 : 1);
