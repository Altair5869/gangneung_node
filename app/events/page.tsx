import { getEventList } from "@/lib/tourism-api";
import { mapTourismToEventSpot } from "@/lib/tourism-mapper";
import { EventSpot } from "@/types";
import { EventApiItem } from "@/types";

export const metadata = {
  title: "강릉 행사/축제 | 강릉 노드",
  description: "한국관광공사 공식 데이터 기반 강릉 행사 및 축제 정보",
};

function formatDate(yyyymmdd: string): string {
  if (!yyyymmdd || yyyymmdd.length < 8) return "";
  const y = yyyymmdd.slice(0, 4);
  const m = yyyymmdd.slice(4, 6).replace(/^0/, "");
  const d = yyyymmdd.slice(6, 8).replace(/^0/, "");
  return `${y}년 ${m}월 ${d}일`;
}

function getStatus(startDate: string, endDate: string): "ongoing" | "upcoming" | "ended" {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const toDate = (s: string) => {
    if (!s || s.length < 8) return null;
    return new Date(
      parseInt(s.slice(0, 4)),
      parseInt(s.slice(4, 6)) - 1,
      parseInt(s.slice(6, 8))
    );
  };
  const start = toDate(startDate);
  const end = toDate(endDate);
  if (!start) return "upcoming";
  if (end && end < today) return "ended";
  if (start <= today) return "ongoing";
  return "upcoming";
}

export default async function EventsPage() {
  let events: EventSpot[] = [];
  try {
    const items = await getEventList();
    events = (items as EventApiItem[]).map(mapTourismToEventSpot);
  } catch {}

  const ongoing = events.filter((e) => getStatus(e.startDate, e.endDate) === "ongoing");
  const upcoming = events.filter((e) => getStatus(e.startDate, e.endDate) === "upcoming");

  return (
    <div className="flex flex-col min-h-screen">
      <section className="bg-gradient-to-r from-rose-600 via-pink-500 to-fuchsia-500 py-12">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-rose-200 text-xs font-semibold tracking-widest uppercase mb-2">Events</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">강릉 행사 · 축제</h1>
          <p className="text-white/80 text-sm">
            한국관광공사 공식 OpenAPI 기반 강릉 지역 행사 및 축제 {events.length}건
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-10 w-full flex-1">
        {events.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg font-semibold mb-2">현재 등록된 행사가 없습니다</p>
            <p className="text-sm">곧 강릉의 새로운 행사 정보가 업데이트됩니다.</p>
          </div>
        ) : (
          <>
            {ongoing.length > 0 && (
              <div className="mb-10">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                  진행 중
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {ongoing.map((event) => (
                    <EventCard key={event.id} event={event} status="ongoing" />
                  ))}
                </div>
              </div>
            )}

            {upcoming.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-fuchsia-400 inline-block" />
                  예정된 행사
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {upcoming.map((event) => (
                    <EventCard key={event.id} event={event} status="upcoming" />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <p className="mt-10 text-center text-xs text-gray-400">
          본 데이터는 한국관광공사 공공 OpenAPI (KorService2 · searchFestival2 · contentTypeId=15)를 활용합니다.
        </p>
      </div>
    </div>
  );
}

function EventCard({ event, status }: { event: EventSpot; status: "ongoing" | "upcoming" }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md hover:border-rose-200 hover:-translate-y-0.5 transition-all duration-200 flex flex-col h-full">
      {event.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={event.imageUrl} alt={event.name} className="w-full h-44 object-cover" />
      ) : (
        <div className="w-full h-44 bg-gradient-to-br from-rose-100 to-fuchsia-100 flex items-center justify-center">
          <span className="text-rose-300 text-sm font-semibold">이미지 없음</span>
        </div>
      )}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-2">
          {status === "ongoing" ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 font-semibold">진행 중</span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full bg-fuchsia-50 text-fuchsia-600 font-semibold">예정</span>
          )}
        </div>
        <h3 className="font-bold text-gray-900 mb-1 leading-tight line-clamp-2">{event.name}</h3>
        {event.eventPlace && (
          <p className="text-xs text-gray-500 truncate mb-1">{event.eventPlace}</p>
        )}
        <p className="text-xs text-gray-400 truncate mb-3">{event.address || "주소 정보 없음"}</p>
        <div className="mt-auto">
          {(event.startDate || event.endDate) && (
            <p className="text-xs text-gray-500 font-medium">
              {formatDate(event.startDate)}
              {event.endDate && event.endDate !== event.startDate && (
                <> ~ {formatDate(event.endDate)}</>
              )}
            </p>
          )}
          <div className="flex gap-1.5 flex-wrap mt-2">
            {event.tags.map((tag) => (
              <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 font-medium">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
