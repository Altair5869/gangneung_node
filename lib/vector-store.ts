import { Index } from "@upstash/vector";
import { embed } from "@/lib/embeddings";
import { RouteStop } from "@/types";

const EMBED_BATCH_SIZE = 50;

let cachedIndex: Index | null | undefined;

function getIndex(): Index | null {
  if (cachedIndex !== undefined) return cachedIndex;
  const url = process.env.UPSTASH_VECTOR_REST_URL;
  const token = process.env.UPSTASH_VECTOR_REST_TOKEN;
  cachedIndex = url && token ? new Index({ url, token }) : null;
  return cachedIndex;
}

export function isVectorStoreConfigured(): boolean {
  return getIndex() !== null;
}

function buildEmbeddingText(spot: RouteStop): string {
  const desc = "description" in spot ? spot.description : undefined;
  return `${spot.name} ${spot.category} ${spot.tags.join(" ")} ${desc ?? ""}`.trim();
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// 전체 코퍼스(관광공사+카카오 실시간 병합 결과)를 주기적으로(Vercel Cron) 다시 임베딩해
// Upstash Vector에 통째로 upsert한다. 코퍼스가 매 요청 실시간으로 바뀔 수 있어 완전한 실시간
// 동기화는 포기하고, "주기적 재색인" 트레이드오프를 명시적으로 택했다.
const BATCH_GAP_MS = 3000;

export async function reindexSpots(spots: RouteStop[]): Promise<number> {
  const index = getIndex();
  if (!index) throw new Error("UPSTASH_VECTOR_REST_URL/TOKEN이 설정되지 않았습니다");

  let upserted = 0;
  const batches = chunk(spots, EMBED_BATCH_SIZE);
  for (let i = 0; i < batches.length; i++) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, BATCH_GAP_MS));
    const batch = batches[i];
    const vectors = await embed(batch.map(buildEmbeddingText), "document");
    await index.upsert(
      batch.map((spot, j) => ({ id: spot.id, vector: vectors[j], metadata: { name: spot.name } }))
    );
    upserted += batch.length;
  }
  return upserted;
}

// 큐레이션 요청 시점에는 사용자 자유 텍스트 쿼리 1건만 임베딩하고, 문서 재임베딩 없이
// 사전 색인된 벡터에 대해 유사도 검색만 수행한다. 색인이 없거나(미설정) 실패하면 null을 반환해
// 호출부가 기존 실시간 재임베딩 경로로 폴백하도록 한다.
export async function queryTopK(queryText: string, k: number): Promise<string[] | null> {
  const index = getIndex();
  if (!index) return null;
  try {
    const [queryVec] = await embed([queryText], "query");
    const results = await index.query({ vector: queryVec, topK: k, includeMetadata: false });
    return results.map((r) => String(r.id));
  } catch {
    return null;
  }
}
