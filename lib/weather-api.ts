// Open-Meteo API — 강릉 (lat=37.7519, lon=128.8761), 키 불필요

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";

export interface WeatherData {
  temp: number;        // 기온 (°C)
  humidity: number;    // 습도 (%)
  windSpeed: number;   // 풍속 (m/s)
  weatherCode: number; // WMO weather code
  precipitation: number; // 강수량 (mm)
}

export async function getGangneungWeather(): Promise<WeatherData | null> {
  const url = new URL(OPEN_METEO_URL);
  url.searchParams.set("latitude", "37.7519");
  url.searchParams.set("longitude", "128.8761");
  url.searchParams.set("current", "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m");
  url.searchParams.set("timezone", "Asia/Seoul");

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 1800 } });
    if (!res.ok) return null;
    const json = await res.json();
    const c = json?.current;
    if (!c) return null;

    return {
      temp: Math.round(c.temperature_2m),
      humidity: Math.round(c.relative_humidity_2m),
      windSpeed: c.wind_speed_10m,
      weatherCode: c.weather_code,
      precipitation: c.precipitation,
    };
  } catch {
    return null;
  }
}

// WMO weather code → 텍스트/아이콘
export function weatherLabel(code: number): string {
  if (code === 0) return "맑음";
  if (code <= 3) return "구름";
  if (code <= 48) return "안개";
  if (code <= 55) return "이슬비";
  if (code <= 65) return "비";
  if (code <= 77) return "눈";
  if (code <= 82) return "소나기";
  return "뇌우";
}

export function weatherIcon(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 2) return "🌤️";
  if (code <= 3) return "☁️";
  if (code <= 48) return "🌫️";
  if (code <= 55) return "🌦️";
  if (code <= 65) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 82) return "🌧️";
  return "⛈️";
}
