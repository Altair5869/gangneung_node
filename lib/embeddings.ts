const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-4-lite";

interface VoyageEmbeddingResponse {
  data: { embedding: number[]; index: number }[];
}

const MAX_RETRIES = 3;
const DEFAULT_RETRY_AFTER_SEC = 20;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 재색인(reindexSpots)이 코퍼스를 배치로 나눠 여러 번 연속 호출하면 Voyage 무료 티어
// 분당 요청 한도(429)에 걸릴 수 있다. Retry-After 헤더를 존중해 대기 후 재시도한다.
export async function embed(texts: string[], inputType: "query" | "document"): Promise<number[][]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new Error("VOYAGE_API_KEY가 설정되지 않았습니다");

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(VOYAGE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: texts, model: VOYAGE_MODEL, input_type: inputType }),
    });

    if (res.ok) {
      const data = (await res.json()) as VoyageEmbeddingResponse;
      return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
    }

    if (res.status === 429 && attempt < MAX_RETRIES) {
      const retryAfterSec = Number(res.headers.get("retry-after")) || DEFAULT_RETRY_AFTER_SEC;
      await sleep(retryAfterSec * 1000);
      continue;
    }

    throw new Error(`Voyage API error: ${res.status}`);
  }

  throw new Error("Voyage API error: 재시도 횟수 초과");
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
