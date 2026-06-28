import { getGangneungWeather, weatherLabel, weatherIcon } from "@/lib/weather-api";

export default async function WeatherWidget() {
  const weather = await getGangneungWeather();
  if (!weather) return null;

  const label = weatherLabel(weather.weatherCode);
  const icon = weatherIcon(weather.weatherCode);

  return (
    <div className="inline-flex items-center gap-3 bg-white/15 backdrop-blur-sm border border-white/20 rounded-2xl px-4 py-3 text-white">
      <span className="text-2xl leading-none">{icon}</span>
      <div>
        <p className="text-xs text-white/70 leading-none mb-1">지금 강릉 날씨</p>
        <p className="text-sm font-semibold leading-none">
          {label} {weather.temp}°C
          <span className="font-normal text-white/70 ml-2">습도 {weather.humidity}%</span>
        </p>
      </div>
    </div>
  );
}
