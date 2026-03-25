const LIVE_APIS_ENABLED = process.env.LIVE_APIS_ENABLED !== 'false';
const OPEN_METEO_BASE_URL = String(process.env.OPEN_METEO_BASE_URL || 'https://api.open-meteo.com').replace(/\/+$/, '');
const PVGIS_BASE_URL = String(process.env.PVGIS_BASE_URL || 'https://re.jrc.ec.europa.eu/api/v5_3').replace(/\/+$/, '');
const ENTSOE_BASE_URL = String(process.env.ENTSOE_BASE_URL || 'https://web-api.tp.entsoe.eu/api').replace(/\/+$/, '');
const ENTSOE_API_TOKEN = String(process.env.ENTSOE_API_TOKEN || '').trim();
const ENTSOE_BIDDING_ZONE = String(process.env.ENTSOE_BIDDING_ZONE || '10YFR-RTE------C').trim();
const ENTSOE_MARKET_TIMEZONE = String(process.env.ENTSOE_MARKET_TIMEZONE || 'Europe/Paris').trim();
const LIVE_REQUEST_TIMEOUT_MS = Math.max(2000, Number(process.env.LIVE_REQUEST_TIMEOUT_MS || 10000));
const LIVE_WEATHER_CACHE_TTL_MS = Math.max(60000, Number(process.env.LIVE_WEATHER_CACHE_TTL_MS || 10 * 60 * 1000));
const LIVE_PVGIS_CACHE_TTL_MS = Math.max(60000, Number(process.env.LIVE_PVGIS_CACHE_TTL_MS || 7 * 24 * 60 * 60 * 1000));
const LIVE_MARKET_CACHE_TTL_MS = Math.max(60000, Number(process.env.LIVE_MARKET_CACHE_TTL_MS || 60 * 60 * 1000));

const liveCache = new Map();

const SITE_LIVE_CONFIG = {
  S01: { latitude: 45.764043, longitude: 4.835659, tilt: 25, azimuth: 0, timezone: 'Europe/Paris' },
  S02: { latitude: 44.837789, longitude: -0.57918, tilt: 20, azimuth: 5, timezone: 'Europe/Paris' },
  S03: { latitude: 45.188529, longitude: 5.724524, tilt: 30, azimuth: -10, timezone: 'Europe/Paris' },
  S04: { latitude: 43.604652, longitude: 1.444209, tilt: 15, azimuth: 0, timezone: 'Europe/Paris' },
  S05: { latitude: 43.710173, longitude: 7.261953, tilt: 22, azimuth: 10, timezone: 'Europe/Paris' },
  S06: { latitude: 45.284757, longitude: 5.88294, tilt: 30, azimuth: 0, timezone: 'Europe/Paris' },
  P01: { latitude: 48.447, longitude: 1.489, tilt: 22, azimuth: 0, timezone: 'Europe/Paris' },
  P02: { latitude: 43.6456, longitude: 0.5887, tilt: 24, azimuth: 0, timezone: 'Europe/Paris' },
  P03: { latitude: 45.764043, longitude: 4.835659, tilt: 18, azimuth: -5, timezone: 'Europe/Paris' },
  P04: { latitude: 43.183, longitude: 3.004, tilt: 24, azimuth: 0, timezone: 'Europe/Paris' },
  P05: { latitude: 42.699, longitude: 9.45, tilt: 25, azimuth: 5, timezone: 'Europe/Paris' },
  'IND-001': { latitude: 45.697, longitude: 4.885, tilt: 12, azimuth: 0, timezone: 'Europe/Paris' },
  'RES-001': { latitude: 43.6119, longitude: 3.8772, tilt: 30, azimuth: 0, timezone: 'Europe/Paris' },
  'Usine Métallurgie Rhône': { latitude: 45.697, longitude: 4.885, tilt: 12, azimuth: 0, timezone: 'Europe/Paris' },
  'Résidence Dupuis': { latitude: 43.6119, longitude: 3.8772, tilt: 30, azimuth: 0, timezone: 'Europe/Paris' },
};

const WEATHER_CODE_LABELS = {
  0: 'Ciel degage',
  1: 'Peu nuageux',
  2: 'Partiellement nuageux',
  3: 'Couvert',
  45: 'Brouillard',
  48: 'Brouillard givrant',
  51: 'Bruine legere',
  53: 'Bruine moderee',
  55: 'Bruine dense',
  61: 'Pluie legere',
  63: 'Pluie moderee',
  65: 'Pluie forte',
  66: 'Pluie verglaçante legere',
  67: 'Pluie verglaçante forte',
  71: 'Neige legere',
  73: 'Neige moderee',
  75: 'Neige forte',
  77: 'Grains de neige',
  80: 'Averses legeres',
  81: 'Averses moderees',
  82: 'Averses fortes',
  85: 'Averses de neige legeres',
  86: 'Averses de neige fortes',
  95: 'Orage',
  96: 'Orage avec grele legere',
  99: 'Orage avec forte grele',
};

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function asNumber(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value, digits = 1) {
  const parsed = asNumber(value, 0);
  const factor = 10 ** digits;
  return Math.round(parsed * factor) / factor;
}

function average(values, digits = 1) {
  const filtered = values.filter(value => Number.isFinite(value));
  if (!filtered.length) return 0;
  return round(filtered.reduce((sum, value) => sum + value, 0) / filtered.length, digits);
}

function formatEnergy(valueKwh) {
  const value = asNumber(valueKwh, 0);
  if (value >= 1000) return `${round(value / 1000, 1)} MWh`;
  return `${round(value, 1)} kWh`;
}

function findConfigCandidate(site) {
  const keys = [site?.id, site?.siteCode, site?.name].filter(Boolean);
  for (const key of keys) {
    if (SITE_LIVE_CONFIG[key]) return SITE_LIVE_CONFIG[key];
  }
  return null;
}

function resolveSiteConfig(site) {
  const fallback = findConfigCandidate(site);
  const latitude = asNumber(site?.coordinates?.latitude ?? fallback?.latitude);
  const longitude = asNumber(site?.coordinates?.longitude ?? fallback?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return {
    latitude,
    longitude,
    tilt: asNumber(site?.orientation?.tilt ?? fallback?.tilt, 30),
    azimuth: asNumber(site?.orientation?.azimuth ?? fallback?.azimuth, 0),
    timezone: site?.timezone || fallback?.timezone || 'Europe/Paris',
  };
}

function getSitesForRole(dashboardData, role) {
  const sites = dashboardData?.sites || {};
  if (role === 'installateur') {
    return (sites.installateur || []).map(site => ({ site }));
  }
  if (role === 'fonds') {
    return (sites.fonds || []).map(site => ({ site }));
  }
  if (role === 'industriel' && sites.industriel) {
    return [{ site: sites.industriel }];
  }
  if (role === 'particulier' && sites.particulier) {
    return [{ site: sites.particulier }];
  }
  return [];
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LIVE_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'NukunuSolar/1.0' },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LIVE_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'NukunuSolar/1.0' },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function withCache(cacheKey, ttlMs, loader) {
  const now = Date.now();
  const cached = liveCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const pending = Promise.resolve().then(loader);
  liveCache.set(cacheKey, { expiresAt: now + ttlMs, value: pending });

  try {
    const value = await pending;
    liveCache.set(cacheKey, { expiresAt: Date.now() + ttlMs, value });
    return value;
  } catch (error) {
    liveCache.delete(cacheKey);
    throw error;
  }
}

function getTimeZoneParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

function getEntsoePeriodBounds(timeZone) {
  const now = new Date();
  const parts = getTimeZoneParts(now, timeZone);
  const start = `${parts.year}${parts.month}${parts.day}0000`;
  const nextDay = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + 1));
  const nextParts = getTimeZoneParts(nextDay, timeZone);
  const end = `${nextParts.year}${nextParts.month}${nextParts.day}0000`;
  return { start, end, dateKey: parts.dateKey };
}

function parseResolutionMinutes(resolution) {
  const hourMatch = String(resolution || '').match(/PT(\d+)H/);
  if (hourMatch) return Number(hourMatch[1]) * 60;
  const minuteMatch = String(resolution || '').match(/PT(\d+)M/);
  if (minuteMatch) return Number(minuteMatch[1]);
  return 60;
}

function parseEntsoePricesXml(xml, timeZone, targetDateKey) {
  const periods = [...String(xml || '').matchAll(/<Period>([\s\S]*?)<\/Period>/g)].map(match => match[1]);
  const hourlyBuckets = new Map(Array.from({ length: 24 }, (_, hour) => [hour, []]));

  periods.forEach(periodXml => {
    const startIso = periodXml.match(/<start>([^<]+)<\/start>/)?.[1];
    const resolution = periodXml.match(/<resolution>([^<]+)<\/resolution>/)?.[1] || 'PT60M';
    const resolutionMinutes = parseResolutionMinutes(resolution);
    if (!startIso) return;

    [...periodXml.matchAll(/<Point>([\s\S]*?)<\/Point>/g)].forEach(pointMatch => {
      const pointXml = pointMatch[1];
      const position = Number(pointXml.match(/<position>([^<]+)<\/position>/)?.[1]);
      const price = asNumber(pointXml.match(/<price\.amount>([^<]+)<\/price\.amount>/)?.[1]);
      if (!Number.isFinite(position) || !Number.isFinite(price)) return;

      const slotDate = new Date(startIso);
      slotDate.setUTCMinutes(slotDate.getUTCMinutes() + ((position - 1) * resolutionMinutes));
      const parts = getTimeZoneParts(slotDate, timeZone);
      if (parts.dateKey !== targetDateKey) return;
      hourlyBuckets.get(parts.hour)?.push(price);
    });
  });

  return Array.from({ length: 24 }, (_, hour) => {
    const bucket = hourlyBuckets.get(hour) || [];
    const averagePrice = bucket.length
      ? round(bucket.reduce((sum, value) => sum + value, 0) / bucket.length, 2)
      : null;
    return { hour, price: averagePrice };
  });
}

async function fetchEntsoeMarketPrices() {
  if (!ENTSOE_API_TOKEN) {
    return {
      status: 'disabled',
      source: 'ENTSO-E Transparency Platform',
      reason: 'ENTSOE_API_TOKEN absent',
      targetDate: getEntsoePeriodBounds(ENTSOE_MARKET_TIMEZONE).dateKey,
      prices: null,
    };
  }

  const { start, end, dateKey } = getEntsoePeriodBounds(ENTSOE_MARKET_TIMEZONE);
  const params = new URLSearchParams({
    securityToken: ENTSOE_API_TOKEN,
    documentType: 'A44',
    in_Domain: ENTSOE_BIDDING_ZONE,
    out_Domain: ENTSOE_BIDDING_ZONE,
    periodStart: start,
    periodEnd: end,
  });

  try {
    const xml = await withCache(
      `entsoe:${ENTSOE_BIDDING_ZONE}:${dateKey}`,
      LIVE_MARKET_CACHE_TTL_MS,
      () => fetchText(`${ENTSOE_BASE_URL}?${params.toString()}`)
    );
    const prices = parseEntsoePricesXml(xml, ENTSOE_MARKET_TIMEZONE, dateKey);
    const usablePoints = prices.filter(point => Number.isFinite(point.price));
    if (!usablePoints.length) {
      return {
        status: 'error',
        source: 'ENTSO-E Transparency Platform',
        reason: 'Aucun prix exploitable renvoyé par ENTSO-E',
        targetDate: dateKey,
        prices: null,
      };
    }

    return {
      status: 'ok',
      source: 'ENTSO-E Transparency Platform',
      targetDate: dateKey,
      updatedAt: new Date().toISOString(),
      zone: ENTSOE_BIDDING_ZONE,
      prices: prices.map(point => ({
        hour: point.hour,
        price: Number.isFinite(point.price) ? point.price : usablePoints[usablePoints.length - 1].price,
      })),
    };
  } catch (error) {
    console.warn(`[live] marche ENTSO-E indisponible: ${error.message}`);
    return {
      status: 'error',
      source: 'ENTSO-E Transparency Platform',
      reason: error.message,
      targetDate: dateKey,
      prices: null,
    };
  }
}

async function fetchOpenMeteo(site, config) {
  const params = new URLSearchParams({
    latitude: String(config.latitude),
    longitude: String(config.longitude),
    timezone: config.timezone,
    forecast_days: '2',
    tilt: String(config.tilt),
    azimuth: String(config.azimuth),
    current: 'temperature_2m,cloud_cover,wind_speed_10m,weather_code,shortwave_radiation,global_tilted_irradiance',
    hourly: 'global_tilted_irradiance',
    daily: 'sunrise,sunset,precipitation_probability_max',
  });

  return withCache(
    `open-meteo:${site.id || site.name}:${config.latitude}:${config.longitude}:${config.tilt}:${config.azimuth}`,
    LIVE_WEATHER_CACHE_TTL_MS,
    () => fetchJson(`${OPEN_METEO_BASE_URL}/v1/forecast?${params.toString()}`)
  );
}

async function fetchPvgis(site, config) {
  const peakPower = Math.max(1, asNumber(site?.power, 1));
  const params = new URLSearchParams({
    lat: String(config.latitude),
    lon: String(config.longitude),
    peakpower: String(peakPower),
    loss: '14',
    angle: String(config.tilt),
    aspect: String(config.azimuth),
    outputformat: 'json',
  });

  return withCache(
    `pvgis:${site.id || site.name}:${config.latitude}:${config.longitude}:${peakPower}:${config.tilt}:${config.azimuth}`,
    LIVE_PVGIS_CACHE_TTL_MS,
    () => fetchJson(`${PVGIS_BASE_URL}/PVcalc?${params.toString()}`)
  );
}

function getMonthAverage(pvgisPayload) {
  const monthly = pvgisPayload?.outputs?.monthly?.fixed || [];
  const currentMonth = new Date().getMonth() + 1;
  return monthly.find(item => item.month === currentMonth) || null;
}

function extractHourlyBlock(weatherPayload, targetDate) {
  const timeValues = weatherPayload?.hourly?.time || [];
  const radiationValues = weatherPayload?.hourly?.global_tilted_irradiance || [];
  const hours = Array.from({ length: 24 }, () => 0);

  timeValues.forEach((timeValue, index) => {
    if (!String(timeValue).startsWith(targetDate)) return;
    const hour = Number(String(timeValue).slice(11, 13));
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) return;
    hours[hour] = asNumber(radiationValues[index], 0);
  });

  return hours;
}

function buildSiteLive(site, config, weatherPayload, pvgisPayload) {
  const todayDate = weatherPayload?.daily?.time?.[0] || null;
  const tomorrowDate = weatherPayload?.daily?.time?.[1] || todayDate;
  const todayRadiationHours = todayDate ? extractHourlyBlock(weatherPayload, todayDate) : Array.from({ length: 24 }, () => 0);
  const tomorrowRadiationHours = tomorrowDate ? extractHourlyBlock(weatherPayload, tomorrowDate) : Array.from({ length: 24 }, () => 0);
  const todayRadiationKwhM2 = round(todayRadiationHours.reduce((sum, value) => sum + value, 0) / 1000, 2);
  const tomorrowRadiationKwhM2 = round(tomorrowRadiationHours.reduce((sum, value) => sum + value, 0) / 1000, 2);
  const current = weatherPayload?.current || {};
  const monthAverage = getMonthAverage(pvgisPayload);
  const totalYield = pvgisPayload?.outputs?.totals?.fixed || {};
  const referenceRadiation = asNumber(monthAverage?.['H(i)_d'], 0);
  const referenceDailyYield = asNumber(monthAverage?.E_d, asNumber(site?.production_day, 0));

  const estimateEnergy = radiationKwhM2 => {
    if (referenceRadiation > 0 && referenceDailyYield > 0 && radiationKwhM2 > 0) {
      return round(referenceDailyYield * (radiationKwhM2 / referenceRadiation), 1);
    }
    return round(referenceDailyYield, 1);
  };

  const forecastTodayKwh = estimateEnergy(todayRadiationKwhM2);
  const forecastTomorrowKwh = estimateEnergy(tomorrowRadiationKwhM2);
  const tomorrowRadiationSum = tomorrowRadiationHours.reduce((sum, value) => sum + value, 0);
  const hourlyProduction = tomorrowRadiationSum > 0
    ? tomorrowRadiationHours.map(value => round(forecastTomorrowKwh * (value / tomorrowRadiationSum), 2))
    : null;

  return {
    status: 'ok',
    source: 'Open-Meteo + PVGIS',
    updatedAt: new Date().toISOString(),
    observedAt: current.time || null,
    weatherCode: asNumber(current.weather_code, 0),
    weatherLabel: WEATHER_CODE_LABELS[asNumber(current.weather_code, 0)] || 'Conditions variables',
    temperatureC: round(current.temperature_2m, 1),
    cloudCoverPct: round(current.cloud_cover, 0),
    windSpeedKmh: round(current.wind_speed_10m, 1),
    irradianceNowWm2: round(current.global_tilted_irradiance ?? current.shortwave_radiation ?? 0, 0),
    todayPlaneRadiationKwhM2: todayRadiationKwhM2,
    tomorrowPlaneRadiationKwhM2: tomorrowRadiationKwhM2,
    forecastTodayKwh,
    forecastTodayLabel: formatEnergy(forecastTodayKwh),
    forecastTomorrowKwh,
    forecastTomorrowLabel: formatEnergy(forecastTomorrowKwh),
    sunrise: weatherPayload?.daily?.sunrise?.[1] || weatherPayload?.daily?.sunrise?.[0] || null,
    sunset: weatherPayload?.daily?.sunset?.[1] || weatherPayload?.daily?.sunset?.[0] || null,
    precipitationProbabilityMax: round(weatherPayload?.daily?.precipitation_probability_max?.[1] ?? weatherPayload?.daily?.precipitation_probability_max?.[0] ?? 0, 0),
    annualYieldKwh: round(totalYield.E_y, 0),
    monthlyAverageDailyKwh: round(referenceDailyYield, 1),
    hourLabels: Array.from({ length: 24 }, (_, hour) => `${hour}h`),
    hourlyProduction,
    providers: {
      openMeteo: {
        name: 'Open-Meteo Forecast API',
        cacheMinutes: Math.round(LIVE_WEATHER_CACHE_TTL_MS / 60000),
      },
      pvgis: {
        name: 'PVGIS 5.3',
        cacheHours: Math.round(LIVE_PVGIS_CACHE_TTL_MS / 3600000),
      },
    },
    coordinates: {
      latitude: config.latitude,
      longitude: config.longitude,
    },
    orientation: {
      tilt: config.tilt,
      azimuth: config.azimuth,
    },
  };
}

function buildUnavailableSiteLive(config, reason) {
  return {
    status: 'unavailable',
    source: 'Open-Meteo + PVGIS',
    updatedAt: new Date().toISOString(),
    reason,
    coordinates: config ? { latitude: config.latitude, longitude: config.longitude } : null,
    orientation: config ? { tilt: config.tilt, azimuth: config.azimuth } : null,
  };
}

function buildProfileSummary(liveSites, existingForecast) {
  if (!liveSites.length) {
    return {
      source: 'Open-Meteo + PVGIS',
      updatedAt: new Date().toISOString(),
      sitesSynced: 0,
      forecastLabel: existingForecast || 'n/a',
      hourlyProduction: null,
      hourLabels: Array.from({ length: 24 }, (_, hour) => `${hour}h`),
    };
  }

  const forecastTomorrowKwh = round(liveSites.reduce((sum, site) => sum + asNumber(site.forecastTomorrowKwh, 0), 0), 1);
  const hourlyProduction = Array.from({ length: 24 }, (_, hour) => {
    return round(liveSites.reduce((sum, site) => sum + asNumber(site.hourlyProduction?.[hour], 0), 0), 2);
  });
  const timestamps = liveSites
    .map(site => site.updatedAt)
    .filter(Boolean)
    .sort((left, right) => String(right).localeCompare(String(left)));

  return {
    source: 'Open-Meteo + PVGIS',
    updatedAt: timestamps[0] || new Date().toISOString(),
    sitesSynced: liveSites.length,
    forecastKwh: forecastTomorrowKwh,
    forecastLabel: formatEnergy(forecastTomorrowKwh),
    averageTemperatureC: average(liveSites.map(site => asNumber(site.temperatureC)), 1),
    averageCloudCoverPct: average(liveSites.map(site => asNumber(site.cloudCoverPct)), 0),
    averageIrradianceWm2: average(liveSites.map(site => asNumber(site.irradianceNowWm2)), 0),
    currentWeatherLabel: liveSites[0]?.weatherLabel || 'Conditions variables',
    hourLabels: Array.from({ length: 24 }, (_, hour) => `${hour}h`),
    hourlyProduction,
  };
}

function buildProviderSummary(providerName, results, key, enabled) {
  if (!enabled) {
    return {
      name: providerName,
      status: 'disabled',
      successfulSites: 0,
      totalSites: results.length,
    };
  }

  const successfulSites = results.filter(result => Boolean(result[key])).length;
  return {
    name: providerName,
    status: successfulSites === results.length ? 'ok' : successfulSites > 0 ? 'partial' : 'error',
    successfulSites,
    totalSites: results.length,
  };
}

async function hydrateSite(site) {
  const config = resolveSiteConfig(site);
  if (!config) {
    return {
      site,
      config: null,
      weather: null,
      pvgis: null,
      live: buildUnavailableSiteLive(null, 'Coordonnees indisponibles pour ce site.'),
    };
  }

  const [weatherResult, pvgisResult] = await Promise.allSettled([
    fetchOpenMeteo(site, config),
    fetchPvgis(site, config),
  ]);

  const weather = weatherResult.status === 'fulfilled' ? weatherResult.value : null;
  const pvgis = pvgisResult.status === 'fulfilled' ? pvgisResult.value : null;

  if (!weather || !pvgis) {
    const reason = [
      weather ? null : `meteo indisponible (${weatherResult.reason?.message || 'erreur reseau'})`,
      pvgis ? null : `modele solaire indisponible (${pvgisResult.reason?.message || 'erreur reseau'})`,
    ].filter(Boolean).join(' ; ');

    console.warn(`[live] ${site.name || site.id || 'site'}: ${reason}`);

    return {
      site,
      config,
      weather,
      pvgis,
      live: buildUnavailableSiteLive(config, reason),
    };
  }

  return {
    site,
    config,
    weather,
    pvgis,
    live: buildSiteLive(site, config, weather, pvgis),
  };
}

async function decorateDashboardData(dashboardData, role) {
  const payload = clone(dashboardData);
  const siteRefs = getSitesForRole(payload, role);

  if (!siteRefs.length) {
    payload.live = {
      enabled: LIVE_APIS_ENABLED,
      updatedAt: new Date().toISOString(),
      role,
      providers: {},
    };
    return payload;
  }

  if (!LIVE_APIS_ENABLED) {
    siteRefs.forEach(({ site }) => {
      site.live = buildUnavailableSiteLive(resolveSiteConfig(site), 'Synchronisation live desactivee par configuration.');
    });
    payload.live = {
      enabled: false,
      updatedAt: new Date().toISOString(),
      role,
      providers: {
        openMeteo: buildProviderSummary('Open-Meteo Forecast API', siteRefs, 'weather', false),
        pvgis: buildProviderSummary('PVGIS 5.3', siteRefs, 'pvgis', false),
      },
    };
    return payload;
  }

  const results = await Promise.all(siteRefs.map(({ site }) => hydrateSite(site)));
  const liveSites = [];
  const marketLive = await fetchEntsoeMarketPrices();

  results.forEach(result => {
    result.site.live = result.live;
    if (result.live?.coordinates) result.site.coordinates = result.live.coordinates;
    if (result.live?.orientation) result.site.orientation = result.live.orientation;
    if (result.live?.status === 'ok') liveSites.push(result.live);
  });

  const optimisation = payload.optimisation || {};
  const existingForecast = (optimisation.forecast || {})[role];
  const profileSummary = buildProfileSummary(liveSites, existingForecast);

  payload.optimisation = {
    ...optimisation,
    epexHours: marketLive.status === 'ok' && Array.isArray(marketLive.prices)
      ? marketLive.prices
      : (optimisation.epexHours || []),
    forecast: {
      ...(optimisation.forecast || {}),
      [role]: profileSummary.forecastLabel,
    },
    marketLive,
    liveProfiles: {
      ...(optimisation.liveProfiles || {}),
      [role]: profileSummary,
    },
  };

  payload.live = {
    enabled: true,
    updatedAt: new Date().toISOString(),
    role,
    providers: {
      openMeteo: buildProviderSummary('Open-Meteo Forecast API', results, 'weather', true),
      pvgis: buildProviderSummary('PVGIS 5.3', results, 'pvgis', true),
      entsoe: {
        name: 'ENTSO-E Transparency Platform',
        status: marketLive.status,
        targetDate: marketLive.targetDate,
        reason: marketLive.reason || null,
      },
    },
  };

  return payload;
}

function getLiveHealthSummary() {
  return {
    enabled: LIVE_APIS_ENABLED,
    requestTimeoutMs: LIVE_REQUEST_TIMEOUT_MS,
    providers: {
      openMeteo: {
        name: 'Open-Meteo Forecast API',
        baseUrl: OPEN_METEO_BASE_URL,
        cacheTtlMs: LIVE_WEATHER_CACHE_TTL_MS,
      },
      pvgis: {
        name: 'PVGIS 5.3',
        baseUrl: PVGIS_BASE_URL,
        cacheTtlMs: LIVE_PVGIS_CACHE_TTL_MS,
      },
      entsoe: {
        name: 'ENTSO-E Transparency Platform',
        baseUrl: ENTSOE_BASE_URL,
        cacheTtlMs: LIVE_MARKET_CACHE_TTL_MS,
        configured: Boolean(ENTSOE_API_TOKEN),
        zone: ENTSOE_BIDDING_ZONE,
        timeZone: ENTSOE_MARKET_TIMEZONE,
      },
    },
  };
}

module.exports = {
  decorateDashboardData,
  getLiveHealthSummary,
};
