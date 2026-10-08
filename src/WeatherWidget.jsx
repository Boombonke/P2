import { useEffect, useState } from "react";
import "./WeatherWidget.css";

const INITIAL_CITY = {
  name: "Vilnius",
  admin1: "Vilniaus apskritis",
  country: "Lietuva",
  latitude: 54.6872,
  longitude: 25.2797,
};

function weatherDescription(code) {
  if (code === 0) return "Giedra";
  if ([1, 2].includes(code)) return "Mažai debesuota";
  if (code === 3) return "Debesuota";
  if ([45, 48].includes(code)) return "Rūkas";
  if ([51, 53, 55, 56, 57].includes(code)) return "Dulksna";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Lietus";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Sniegas";
  if ([95, 96, 99].includes(code)) return "Perkūnija";
  return "Orų sąlygos";
}

function pollenLevel(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "Duomenų nėra";
  if (Number(value) < 10) return "Mažai";
  if (Number(value) < 50) return "Vidutiniškai";
  return "Daug";
}

function runningAdvice(weather, pollen) {
  if (!weather) return "Orų duomenų nėra.";
  if ([95, 96, 99].includes(weather.weather_code)) return "Perkūnija – bėgimą atidėkite.";
  if (weather.wind_speed_10m >= 40 || weather.wind_gusts_10m >= 60) return "Labai vėjuota – rinkitės trumpą, nuo vėjo apsaugotą maršrutą.";
  if (weather.precipitation >= 2 || [65, 67, 82, 86].includes(weather.weather_code)) return "Prastos sąlygos – lyja arba sninga, rinkitės atsargų tempą.";
  if (weather.wind_speed_10m >= 25 || weather.precipitation > 0 || [61, 63, 71, 73, 75, 80, 81, 85].includes(weather.weather_code)) return "Bėgti galima, bet gali būti šlapia arba vėjuota.";
  if (pollen !== null && pollen >= 50) return "Oras tinkamas, bet žiedadulkių daug – jautriems žmonėms rinkitės trumpesnį bėgimą.";
  return "Sąlygos bėgimui palankios.";
}

function WeatherWidget() {
  const [query, setQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState(INITIAL_CITY);
  const [suggestions, setSuggestions] = useState([]);
  const [weather, setWeather] = useState(null);
  const [pollen, setPollen] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setSuggestions([]);
      return undefined;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ name: trimmedQuery, count: "20", language: "lt", countryCode: "LT", format: "json" });
        const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Nepavyko ieškoti miestų.");
        const data = await response.json();
        setSuggestions(data.results || []);
      } catch (searchError) {
        if (searchError.name !== "AbortError") setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadConditions() {
      setLoading(true);
      setError("");
      setWeather(null);
      setPollen(null);
      const { latitude, longitude } = selectedCity;
      const weatherParams = new URLSearchParams({
        latitude: String(latitude), longitude: String(longitude),
        current: "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m",
        wind_speed_unit: "kmh", timezone: "auto",
      });
      const pollenParams = new URLSearchParams({
        latitude: String(latitude), longitude: String(longitude),
        current: "alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,ragweed_pollen",
        domains: "cams_europe", timezone: "auto",
      });
      try {
        const [weatherResponse, pollenResponse] = await Promise.all([
          fetch(`https://api.open-meteo.com/v1/forecast?${weatherParams}`, { signal: controller.signal }),
          fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${pollenParams}`, { signal: controller.signal }),
        ]);
        if (!weatherResponse.ok) throw new Error("Nepavyko gauti orų duomenų.");
        const weatherData = await weatherResponse.json();
        setWeather(weatherData.current);
        if (pollenResponse.ok) {
          const airData = await pollenResponse.json();
          const currentPollen = airData.current || {};
          const values = [currentPollen.alder_pollen, currentPollen.birch_pollen, currentPollen.grass_pollen, currentPollen.mugwort_pollen, currentPollen.ragweed_pollen].filter((value) => value !== null && value !== undefined && Number.isFinite(Number(value)));
          if (values.length) setPollen(Math.max(...values));
        }
      } catch (loadError) {
        if (loadError.name !== "AbortError") setError(loadError.message || "Nepavyko gauti duomenų.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadConditions();
    return () => controller.abort();
  }, [selectedCity]);

  function chooseCity(city) {
    setSelectedCity(city);
    setQuery("");
    setSuggestions([]);
  }

  const advice = runningAdvice(weather, pollen);

  return (
    <section className="weather-card" aria-labelledby="weather-title">
      <header className="weather-card__header">
        <div><p className="weather-eyebrow">Lauko sąlygos</p><h2 id="weather-title">Oras ir bėgimas</h2></div>
        <span className="weather-card__city">{selectedCity.name}</span>
      </header>

      <label className="weather-search">
        <span>Pasirinkite Lietuvos miestą</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ieškoti miesto..." autoComplete="off" />
      </label>
      {query.trim().length >= 2 && <div className="weather-suggestions" role="listbox" aria-label="Miestų paieškos rezultatai">
        {searching && <p>Ieškoma...</p>}
        {!searching && suggestions.length === 0 && <p>Miestų nerasta.</p>}
        {suggestions.map((city) => <button key={city.id} type="button" role="option" aria-selected={selectedCity.id === city.id} onClick={() => chooseCity(city)}>
          <span>{city.name}</span><small>{[city.admin1, city.admin2].filter(Boolean).join(", ") || "Lietuva"}</small>
        </button>)}
      </div>}

      {loading && <p className="weather-state">Kraunami orų duomenys...</p>}
      {error && <p className="weather-error" role="alert">{error}</p>}
      {!loading && weather && <>
        <div className="weather-metrics">
          <div className="weather-metric"><span>Dabar</span><strong>{weatherDescription(weather.weather_code)}</strong><small>{Math.round(weather.temperature_2m)} °C</small></div>
          <div className="weather-metric"><span>Vėjas</span><strong>{Math.round(weather.wind_speed_10m)} km/val.</strong><small>Gūsiai iki {Math.round(weather.wind_gusts_10m)} km/val.</small></div>
          <div className="weather-metric"><span>Žiedadulkės</span><strong>{pollenLevel(pollen)}</strong><small>{pollen === null ? "Prognozė neprieinama" : `${Math.round(pollen)} grūd./m³ (didžiausia rūšis)`}</small></div>
        </div>
        <p className="weather-advice"><strong>Bėgimo sąlygos</strong><span>{advice}</span></p>
      </>}
      <p className="weather-attribution">Prognozė ir žiedadulkės: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>. Žiedadulkių reikšmė – didžiausia iš pateiktų rūšių, grūd./m³.</p>
    </section>
  );
}

export default WeatherWidget;
