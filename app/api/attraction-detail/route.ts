import { NextRequest, NextResponse } from "next/server";
import { getDetailIntro, getDetailInfo } from "@/lib/tourism-api";
import { normalizeOperatingInfo } from "@/lib/operating-info";

// GET /api/attraction-detail?contentId=125790&contentTypeId=12
//
// 명소 카드(MapLifeSpotCard) 클릭 시점에만 호출되는 지연 호출 전용 라우트(요구사항 문서 최상단
// 요약) — /map 최초 로드 시에는 이 라우트도, detailIntro2/detailInfo2도 전혀 호출되지 않는다
// (AC3, 사전 일괄 첨부 금지·N+1 방지). /api/spots/[id]가 lib/spot-detail.ts로 조회 로직을
// 위임하는 것과 달리, 여기는 로직이 짧아(호출 2개 분기 + 정규화) 별도 lib 파일을 만들지 않고
// 라우트에 직접 둔다.
//
// contentTypeId=14(문화시설): detailIntro2 응답 안에 usefee가 이미 있어 추가 호출이 필요 없다
// (요구사항 문서 1-2절) — getDetailIntro만 호출.
// contentTypeId=12(관광지): usefee 필드 자체가 스키마에 없어 detailInfo2를 추가로 병렬 호출해야
// 입장료를 확보할 수 있다(1-3절) — lib/spot-detail.ts의 Promise.allSettled 병렬 호출 패턴을
// 그대로 따른다(하나가 실패해도 나머지로 부분 응답).
//
// detailIntro2/detailInfo2 실패·키 미설정·0건이어도 500을 던지지 않고 { operatingInfo: null }을
// 반환한다 — attachNearbyParking/attachBeachIndex와 동일하게 "실패해도 카드는 정상 렌더링"
// 원칙을 따른다(AC6).
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const contentId = searchParams.get("contentId");
  const contentTypeId = searchParams.get("contentTypeId");

  if (!contentId || (contentTypeId !== "12" && contentTypeId !== "14")) {
    return NextResponse.json(
      { error: "contentId와 contentTypeId(12 또는 14)가 모두 필요합니다." },
      { status: 400 }
    );
  }

  try {
    if (contentTypeId === "14") {
      const introItem = await getDetailIntro(contentId, contentTypeId).catch((error) => {
        console.error("[attraction-detail] getDetailIntro(14) failed:", error);
        return null;
      });
      const operatingInfo = normalizeOperatingInfo(introItem, "14");
      return NextResponse.json({ operatingInfo });
    }

    // contentTypeId === "12": detailIntro2 + detailInfo2 병렬 호출.
    const [introResult, infoResult] = await Promise.allSettled([
      getDetailIntro(contentId, contentTypeId),
      getDetailInfo(contentId, contentTypeId),
    ]);

    if (introResult.status === "rejected") {
      console.error("[attraction-detail] getDetailIntro(12) failed:", introResult.reason);
    }
    if (infoResult.status === "rejected") {
      console.error("[attraction-detail] getDetailInfo(12) failed:", infoResult.reason);
    }

    const introItem = introResult.status === "fulfilled" ? introResult.value : null;
    const infoItems = infoResult.status === "fulfilled" ? infoResult.value : [];
    const operatingInfo = normalizeOperatingInfo(introItem, "12", infoItems);
    return NextResponse.json({ operatingInfo });
  } catch (error) {
    console.error("[attraction-detail] unexpected failure:", error);
    return NextResponse.json({ operatingInfo: null });
  }
}
