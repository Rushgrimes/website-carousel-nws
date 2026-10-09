let slides = [...document.querySelectorAll(".slide")];
const carouselCount = document.querySelector(".carousel-count");
const carouselProgress = document.querySelector("#carousel-progress-fill");
const galleryStatus = document.querySelector("#gallery-status");
let activeSlide = 0;

function showSlide(index) {
  activeSlide = (index + slides.length) % slides.length;

  slides.forEach((slide, slideIndex) => {
    const active = slideIndex === activeSlide;
    slide.classList.toggle("is-active", active);
    slide.setAttribute("aria-hidden", String(!active));
    const image = slide.querySelector("img");
    if (image?.dataset.src && (active || slideIndex === (activeSlide + 1) % slides.length)) {
      image.src = image.dataset.src;
      delete image.dataset.src;
    }
  });

  carouselCount.innerHTML = `${String(activeSlide + 1).padStart(2, "0")} <span>/</span> ${String(slides.length).padStart(2, "0")}`;
  carouselProgress.style.width = `${((activeSlide + 1) / slides.length) * 100}%`;
}

document.querySelector(".carousel-previous").addEventListener("click", () => {
  showSlide(activeSlide - 1);
});
document.querySelector(".carousel-next").addEventListener("click", () => showSlide(activeSlide + 1));
showSlide(0);

function textFromHtml(value) {
  const parsed = new DOMParser().parseFromString(value || "", "text/html");
  return parsed.body.textContent.trim().replace(/\s+/g, " ");
}

function allowedCommonsLicense(name) {
  return /^CC0$/i.test(name) ||
    /^CC BY(?:-SA)? [1-4](?:\.\d)?$/i.test(name) ||
    /^Public domain$/i.test(name);
}

function isCarFreePhoto(title, description) {
  return !/\b(?:car|cars|citro[eë]n|dolly|audi|volkswagen|polo|vehicle|van|automobile|motor(?:way|bike|car)|traffic|parking|parked|caravan|truck|bus|road|street|lane|office|houses?|loughshinny harbour|millbank|ford|bmw|volvo|fiat|toyota|honda|hyundai|kia|mercedes|range rover|land rover|suv|pickup|lorry|taxi|sedan|saloon|coupe|convertible)\b/i
    .test(`${title} ${description}`);
}

async function fetchCommonsPhotos(center) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  Object.entries({
    action: "query",
    generator: "geosearch",
    ggscoord: `${center.latitude}|${center.longitude}`,
    ggsradius: "10000",
    ggslimit: "50",
    ggsnamespace: "6",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "1400",
    format: "json",
    origin: "*",
  }).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Wikimedia Commons returned HTTP ${response.status}.`);
  const result = await response.json();
  return Object.values(result.query?.pages || [])
    .map((page) => {
      const info = page.imageinfo?.[0];
      const metadata = info?.extmetadata || {};
      const license = textFromHtml(metadata.LicenseShortName?.value);
      const description = textFromHtml(metadata.ImageDescription?.value) ||
        textFromHtml(metadata.ObjectName?.value) ||
        page.title.replace(/^File:/, "").replace(/_/g, " ");
      if (!info?.thumburl || !allowedCommonsLicense(license)) return null;
      if (!isCarFreePhoto(page.title, description)) return null;
      return {
        title: page.title.replace(/^File:/, ""),
        imageUrl: info.thumburl,
        pageUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
        description,
        artist: textFromHtml(metadata.Artist?.value) || "Unknown creator",
        license,
        licenseUrl: metadata.LicenseUrl?.value || "",
      };
    })
    .filter(Boolean);
}

function addPhotoSlide(photo, index) {
  const slide = document.createElement("article");
  slide.className = "slide";
  slide.setAttribute("aria-hidden", "true");
  slide.dataset.fileTitle = photo.title;
  const image = document.createElement("img");
  image.dataset.src = photo.imageUrl;
  image.loading = "lazy";
  image.decoding = "async";
  image.alt = photo.description;
  const shade = document.createElement("div");
  shade.className = "slide-shade";
  shade.setAttribute("aria-hidden", "true");
  const caption = document.createElement("div");
  caption.className = "slide-caption";
  const kicker = document.createElement("span");
  kicker.className = "caption-kicker";
  kicker.textContent = `RUSH & FINGAL · ${String(index + 1).padStart(2, "0")} / 54`;
  const heading = document.createElement("h2");
  heading.textContent = photo.description;
  const credit = document.createElement("p");
  credit.className = "slide-credit";
  credit.append("Photo: ", photo.artist, " · ");
  const sourceLink = document.createElement("a");
  sourceLink.href = photo.pageUrl;
  sourceLink.target = "_blank";
  sourceLink.rel = "noreferrer";
  sourceLink.textContent = "source";
  const licenseLink = document.createElement("a");
  licenseLink.href = safeLicenseLink(photo.licenseUrl) || photo.pageUrl;
  licenseLink.target = "_blank";
  licenseLink.rel = "noreferrer";
  licenseLink.textContent = photo.license;
  credit.append(sourceLink, " · ", licenseLink);
  caption.append(kicker, heading, credit);
  slide.append(image, shade, caption);
  document.querySelector(".carousel-track").append(slide);
}

async function loadAdditionalPhotos() {
  const centers = [
    { latitude: 53.5228, longitude: -6.1043 },
    { latitude: 53.55, longitude: -6.11 },
    { latitude: 53.58, longitude: -6.10 },
    { latitude: 53.57, longitude: -6.15 },
    { latitude: 53.47, longitude: -6.02 },
    { latitude: 53.61, longitude: -6.18 },
    { latitude: 53.49, longitude: -6.17 },
    { latitude: 53.49, longitude: -6.10 },
  ];
  const existingTitles = new Set(slides.map((slide) =>
    (slide.dataset.fileTitle || "").toLowerCase().replace(/_/g, " "),
  ));
  const photos = [];
  const seen = new Set(existingTitles);
  try {
    for (const center of centers) {
      if (photos.length >= 50) break;
      try {
        const candidates = await fetchCommonsPhotos(center);
        for (const photo of candidates) {
          const key = photo.title.toLowerCase().replace(/_/g, " ");
          if (seen.has(key)) continue;
          seen.add(key);
          photos.push(photo);
          if (photos.length === 50) break;
        }
      } catch (error) {
        console.error("Unable to fetch Commons photos for one local search area.", error);
      }
    }
  } finally {
    if (photos.length < 50) {
      console.warn(`Only ${photos.length} free-licensed Commons images were verified for the carousel.`);
    }
  }

  photos.forEach((photo, index) => addPhotoSlide(photo, index + 5));
  slides = [...document.querySelectorAll(".slide")];
  slides.forEach((slide, index) => {
    const title = slide.querySelector("h2")?.textContent || "Rush and Fingal";
    slide.setAttribute("aria-label", `${index + 1} of ${slides.length}: ${title}`);
    if (index >= 4) {
      slide.querySelector(".caption-kicker").textContent =
        `RUSH & FINGAL · ${String(index + 1).padStart(2, "0")} / ${slides.length}`;
    }
  });
  showSlide(activeSlide);
  const loaded = slides.length - 4;
  galleryStatus.replaceChildren();
  const mark = document.createElement("span");
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = "✳";
  galleryStatus.append(mark, ` ${loaded} additional free-licensed Rush & Fingal photos added${loaded === 50 ? "." : `; only ${loaded} of the requested 50 could be verified online.`}`);
}

loadAdditionalPhotos();

const placeName = document.querySelector("#place-name");
const updatedLabel = document.querySelector("#weather-updated");
const currentIcon = document.querySelector("#current-icon");
const currentTemp = document.querySelector("#current-temp");
const currentSummary = document.querySelector("#current-summary");
const weatherStatus = document.querySelector("#weather-status");
const forecastList = document.querySelector("#forecast-list");
const tickerCopy = document.querySelector("#weather-ticker-copy");
const tickerDuplicate = document.querySelector("#weather-ticker-duplicate");
const tickerTrack = document.querySelector("#weather-ticker-track");
const tickerViewport = document.querySelector(".weather-ticker-viewport");
const tickerToggle = document.querySelector("#weather-ticker-toggle");
const rushCenter = { latitude: 53.5228, longitude: -6.1043 };

const forecastDescriptions = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  56: "Freezing drizzle",
  57: "Heavy freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Heavy freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Light rain showers",
  81: "Rain showers",
  82: "Heavy rain showers",
  85: "Light snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Thunderstorm with heavy hail",
};

function descriptionForCode(code) {
  return forecastDescriptions[code] || "Conditions unavailable";
}

function iconForCode(code) {
  if (code >= 95) return "ϟ";
  if (code >= 71) return "❄";
  if (code >= 51 && code <= 67) return "☂";
  if (code >= 80 && code <= 86) return "☂";
  if (code === 45 || code === 48) return "≋";
  if (code >= 2) return "☁";
  return "☼";
}

function formatDay(date, index) {
  if (index === 0) return "Today";
  if (index === 1) return "Tomorrow";
  return new Intl.DateTimeFormat("en-IE", { weekday: "short" }).format(new Date(`${date}T12:00:00`));
}

function updateWeatherTicker(message, rolling = false) {
  tickerCopy.textContent = message;
  tickerTrack.classList.toggle("is-rolling", rolling);
  const duplicates = [...tickerTrack.querySelectorAll(".weather-ticker-duplicate")];
  duplicates.slice(1).forEach((duplicate) => duplicate.remove());
  tickerDuplicate.textContent = message;
  if (!rolling || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  while (tickerTrack.scrollWidth < tickerViewport.clientWidth * 2) {
    for (let copy = 0; copy < 2; copy += 1) {
      const duplicate = tickerDuplicate.cloneNode(true);
      duplicate.removeAttribute("id");
      tickerTrack.append(duplicate);
    }
  }
}

tickerToggle.addEventListener("click", () => {
  const paused = tickerTrack.classList.contains("is-paused");
  tickerToggle.textContent = paused ? "Pause banner" : "Resume banner";
  tickerTrack.classList.toggle("is-paused", !paused);
});

let tickerResizeTimer;
window.addEventListener("resize", () => {
  window.clearTimeout(tickerResizeTimer);
  tickerResizeTimer = window.setTimeout(() => {
    if (tickerTrack.classList.contains("is-rolling")) {
      updateWeatherTicker(tickerCopy.textContent, true);
    }
  }, 150);
});

const pubMapElement = document.querySelector("#pub-map-view");
const pubMapStatus = document.querySelector("#pub-map-status");
const mapRetryButton = document.querySelector("#map-retry");
const mapPanel = document.querySelector("#pub-map-panel");
const mapDescription = document.querySelector("#map-tab-description");
const pubsTab = document.querySelector("#pubs-tab");
const placesTab = document.querySelector("#places-tab");
const aisMapElement = document.querySelector("#ais-map-view");
const aisStatus = document.querySelector("#ais-status");
const aisRetryButton = document.querySelector("#ais-retry");
let mapView;
let aisMapView;
let pubGraphicsLayer;
let placesGraphicsLayer;
let aisGraphicsLayer;
let ArcGraphic;
let aisSocket;
let aisConnectedAt = 0;
let aisStatusTimer;
const aisVessels = new Map();
let placesLoaded = false;
let activeMap = "pubs";
let placesStatusMessage = "";
let placesStatusState = "success";

const savedRushPubs = [
  { name: "The Michael Collins", latitude: 53.5218348, longitude: -6.0905574 },
  { name: "The Strand", latitude: 53.522087, longitude: -6.092269 },
  { name: "The Carlyann", latitude: 53.5219157, longitude: -6.0877109 },
  { name: "The Harbour Bar", latitude: 53.5221469, longitude: -6.0824615 },
  { name: "The Yacht Bar", latitude: 53.547431, longitude: -6.101565 },
];

function setStatus(message, state = "loading") {
  weatherStatus.textContent = message;
  weatherStatus.dataset.state = state;
}

function formatTemperature(value, unit) {
  if (typeof value !== "number") return "--°";
  return `${Math.round(value)}°${unit}`;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/geo+json, application/json" },
  });
  if (!response.ok) {
    const error = new Error(`Weather service returned ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

async function loadRushWeather() {
  setStatus("Loading the Rush forecast…");
  updateWeatherTicker("Checking the latest forecast for Rush, Fingal…");
  placeName.textContent = "Rush, Fingal, Ireland";
  updatedLabel.textContent = "Open-Meteo forecast";
  currentTemp.textContent = "--°";
  currentSummary.textContent = "Loading forecast";
  forecastList.replaceChildren();

  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.search = new URLSearchParams({
      latitude: rushCenter.latitude,
      longitude: rushCenter.longitude,
      current: "temperature_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m",
      daily: "weather_code,temperature_2m_max,temperature_2m_min",
      forecast_days: "4",
      timezone: "Europe/Dublin",
    }).toString();
    const forecast = await fetchJson(url);
    const current = forecast.current;
    const daily = forecast.daily;
    if (
      typeof current?.temperature_2m !== "number" ||
      !Array.isArray(daily?.time) ||
      daily.time.length === 0
    ) {
      throw new Error("Open-Meteo returned no usable forecast for Rush.");
    }

    currentTemp.textContent = formatTemperature(current.temperature_2m, "C");
    currentSummary.textContent = descriptionForCode(current.weather_code);
    currentIcon.textContent = iconForCode(current.weather_code);
    updateWeatherTicker(
      `RUSH FORECAST · ${descriptionForCode(current.weather_code)} · ${formatTemperature(current.temperature_2m, "C")} · Feels like ${formatTemperature(current.apparent_temperature, "C")} · Wind ${Math.round(current.wind_speed_10m)} km/h`,
      true,
    );
    updatedLabel.textContent = `Forecast updated ${new Intl.DateTimeFormat("en-IE", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Dublin",
    }).format(new Date(`${current.time}:00`))} · Open-Meteo`;

    for (const [index] of daily.time.entries()) {
      const row = document.createElement("div");
      row.className = "forecast-row";

      const day = document.createElement("span");
      day.className = "forecast-day";
      day.textContent = formatDay(daily.time[index], index);

      const description = document.createElement("span");
      description.className = "forecast-description";
      description.textContent = descriptionForCode(daily.weather_code[index]);

      const temperature = document.createElement("span");
      temperature.className = "forecast-temp";
      temperature.textContent = `${Math.round(daily.temperature_2m_max[index])}° / ${Math.round(daily.temperature_2m_min[index])}°`;

      row.append(day, description, temperature);
      forecastList.append(row);
    }

    setStatus("", "success");
  } catch (error) {
    currentIcon.textContent = "◌";
    currentSummary.textContent = "Forecast unavailable";
    setStatus(`${error.message} The Rush forecast is unavailable; try again later.`, "error");
    updateWeatherTicker("Rush weather is currently unavailable. No other location's weather is shown.");
  }
}

loadRushWeather();
document.querySelector("#weather-retry").addEventListener("click", loadRushWeather);

function setMapStatus(message, state = "success") {
  pubMapStatus.textContent = message;
  pubMapStatus.dataset.state = state;
}

const savedRushPlaces = [
  {
    name: "Rush North Beach",
    latitude: 53.5259,
    longitude: -6.0859,
    description: "North Beach on Rush's coastline.",
  },
  {
    name: "Rush Harbour",
    latitude: 53.523551,
    longitude: -6.082492,
    description: "Rush Harbour and the nearby coastal path.",
  },
  {
    name: "Rush Martello Tower",
    latitude: 53.521315,
    longitude: -6.077467,
    description: "Historic Martello Tower on the Rush coast.",
  },
  {
    name: "Rush and Lusk railway station",
    latitude: 53.520478,
    longitude: -6.143851,
    description: "Rail connection serving Rush and Lusk.",
  },
];

function safeLicenseLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "creativecommons.org" ? url.href : "";
  } catch {
    return "";
  }
}

async function verifiedCommonsPhoto(tag) {
  if (!tag || !/^File:/i.test(tag.trim())) return null;
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query",
    titles: tag.trim(),
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "800",
    format: "json",
    origin: "*",
  }).toString();
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Commons returned HTTP ${response.status}.`);
  const result = await response.json();
  const page = Object.values(result.query?.pages || {})[0];
  const info = page?.imageinfo?.[0];
  const metadata = info?.extmetadata || {};
  const license = textFromHtml(metadata.LicenseShortName?.value);
  if (!info?.thumburl || !allowedCommonsLicense(license)) return null;
  return {
    url: info.thumburl,
    pageUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
    artist: textFromHtml(metadata.Artist?.value) || "Unknown creator",
    license,
    licenseUrl: safeLicenseLink(metadata.LicenseUrl?.value),
  };
}

async function makeLocationPopup(feature, includePubPhoto) {
  const attributes = feature.graphic.attributes;
  const content = document.createElement("div");
  const details = document.createElement("p");
  details.textContent = attributes.details;
  content.append(details);

  if (includePubPhoto) {
    let photo = null;
    if (attributes.wikimediaCommons) {
      try {
        photo = await verifiedCommonsPhoto(attributes.wikimediaCommons);
      } catch (error) {
        console.warn(`Unable to verify Commons photo for ${attributes.name}.`, error);
      }
    }
    if (photo) {
      const image = document.createElement("img");
      image.className = "map-popup-photo";
      image.src = photo.url;
      image.alt = `${attributes.name} photo by ${photo.artist}`;
      image.loading = "lazy";
      const credit = document.createElement("p");
      credit.className = "map-popup-credit";
      const photoLink = document.createElement("a");
      photoLink.href = photo.pageUrl;
      photoLink.target = "_blank";
      photoLink.rel = "noreferrer";
      photoLink.textContent = "Photo source";
      credit.append("Photo: ", photo.artist, " · ");
      credit.append(photoLink);
      const licenseUrl = safeLicenseLink(photo.licenseUrl);
      if (licenseUrl) {
        const licenseLink = document.createElement("a");
        licenseLink.href = licenseUrl;
        licenseLink.target = "_blank";
        licenseLink.rel = "noreferrer";
        licenseLink.textContent = photo.license;
        credit.append(" · ", licenseLink);
      } else {
        credit.append(` · ${photo.license}`);
      }
      content.append(image, credit);
    } else {
      const note = document.createElement("p");
      note.className = "map-popup-credit";
      note.textContent = "No pub-specific photo with a verified reusable license is available.";
      content.append(note);
    }
  }

  const link = document.createElement("a");
  link.href = attributes.osmUrl;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = "View on OpenStreetMap ↗";
  content.append(link);
  return content;
}

function locationGraphic(location, isPub) {
  const tags = location.tags || {};
  const address = [tags["addr:street"], tags["addr:city"]].filter(Boolean).join(", ");
  const details = isPub
    ? [
        address,
        tags.opening_hours ? `Hours: ${tags.opening_hours}` : "",
        tags.phone ? `Phone: ${tags.phone}` : "",
      ].filter(Boolean).join("\n") || "Pub in Rush"
    : location.description || [
        tags.historic && `Historic site: ${tags.historic.replace(/_/g, " ")}`,
        tags.tourism && `Visitor place: ${tags.tourism.replace(/_/g, " ")}`,
        tags.natural && `Natural feature: ${tags.natural.replace(/_/g, " ")}`,
        tags.railway && `Railway: ${tags.railway}`,
      ].filter(Boolean).join("\n") || "Place of interest near Rush";
  return new ArcGraphic({
    geometry: {
      type: "point",
      longitude: location.longitude,
      latitude: location.latitude,
    },
    attributes: {
      name: location.name,
      details,
      osmUrl: location.id
        ? `https://www.openstreetmap.org/${location.type || "node"}/${location.id}`
        : `https://www.openstreetmap.org/search?query=${encodeURIComponent(location.name)}`,
      wikimediaCommons: tags.wikimedia_commons || "",
    },
    symbol: {
      type: "simple-marker",
      style: "circle",
      color: isPub ? "#556b55" : "#b47b48",
      size: 12,
      outline: { color: "#fbfaf7", width: 2 },
    },
    popupTemplate: {
      title: "{name}",
      content: (feature) => makeLocationPopup(feature, isPub),
    },
  });
}

async function loadPubs() {
  setMapStatus("Finding pubs around Rush…", "loading");
  mapRetryButton.hidden = true;
  pubGraphicsLayer.removeAll();

  const query = [
    "[out:json][timeout:25];",
    "(",
    `nwr["amenity"="pub"](around:3000,${rushCenter.latitude},${rushCenter.longitude});`,
    ");",
    "out center;",
  ].join("");

  const endpoints = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
  ];
  const failures = [];
  let pubs;

  for (const endpoint of endpoints) {
    try {
      const url = new URL(endpoint);
      url.searchParams.set("data", query);
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      pubs = result.elements
        .map((element) => {
          const latitude = element.lat ?? element.center?.lat;
          const longitude = element.lon ?? element.center?.lon;
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return null;
          }
          return { ...element, latitude, longitude, name: element.tags?.name || element.tags?.["name:en"] || "Pub" };
        })
        .filter(Boolean);
      break;
    } catch (error) {
      failures.push(error.message);
      console.warn(`Rush pub lookup failed at ${endpoint}.`, error);
    }
  }

  const usingSavedLocations = !pubs || pubs.length === 0;
  if (usingSavedLocations) {
    pubs = savedRushPubs.map((pub) => ({
      ...pub,
      type: "node",
      tags: { amenity: "pub", name: pub.name },
    }));
  }

  pubs.forEach((pub) => pubGraphicsLayer.add(locationGraphic(pub, true)));

  await mapView.goTo({
    target: pubGraphicsLayer.graphics,
    padding: 32,
  });

  if (usingSavedLocations) {
    const failure = failures.find((message) => message.includes("403"));
    const reason = failure
      ? "Live lookup was denied (HTTP 403)"
      : failures.some((message) => message.includes("Failed to fetch"))
        ? "Live lookup is blocked by this preview's network or CORS policy"
        : "Live lookup is unavailable";
    setMapStatus(
      `Showing ${pubs.length} saved Rush pub locations. ${reason}; confirm details on OpenStreetMap.`,
      "error",
    );
    mapRetryButton.hidden = false;
    return;
  }

  setMapStatus(`${pubs.length} ${pubs.length === 1 ? "pub" : "pubs"} found around Rush. Select a marker for details.`, "success");
}

async function loadPlacesOfInterest() {
  setMapStatus("Finding Rush and Fingal places of interest…", "loading");
  mapRetryButton.hidden = true;
  placesGraphicsLayer.removeAll();
  const query = [
    "[out:json][timeout:25];(",
    `nwr["natural"="beach"](around:8000,${rushCenter.latitude},${rushCenter.longitude});`,
    `nwr["tourism"="attraction"](around:8000,${rushCenter.latitude},${rushCenter.longitude});`,
    `nwr["historic"~"castle|tower|windmill|ruins"](around:8000,${rushCenter.latitude},${rushCenter.longitude});`,
    `nwr["railway"="station"](around:8000,${rushCenter.latitude},${rushCenter.longitude});`,
    ");out center;",
  ].join("");
  const endpoints = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
  ];
  const failures = [];
  let places;
  for (const endpoint of endpoints) {
    try {
      const url = new URL(endpoint);
      url.searchParams.set("data", query);
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      places = result.elements.map((element) => ({
        ...element,
        latitude: element.lat ?? element.center?.lat,
        longitude: element.lon ?? element.center?.lon,
        name: element.tags?.name || element.tags?.["name:en"],
      })).filter((place) =>
        place.name && Number.isFinite(place.latitude) && Number.isFinite(place.longitude),
      );
      break;
    } catch (error) {
      failures.push(error.message);
      console.warn(`Rush places lookup failed at ${endpoint}.`, error);
    }
  }

  const usingSavedLocations = !places || places.length === 0;
  if (usingSavedLocations) places = savedRushPlaces.map((place) => ({ ...place, type: "node" }));
  places.forEach((place) => placesGraphicsLayer.add(locationGraphic(place, false)));
  placesLoaded = true;
  await mapView.goTo({ target: placesGraphicsLayer.graphics, padding: 32 });
  if (usingSavedLocations) {
    const failure = failures.find((message) => message.includes("403"));
    const reason = failure
      ? "Live lookup was denied (HTTP 403)"
      : failures.some((message) => message.includes("Failed to fetch"))
        ? "Live lookup is blocked by this preview's network or CORS policy"
        : "Live lookup is unavailable";
    placesStatusMessage = `Showing ${places.length} saved Rush-area places. ${reason}; confirm details on OpenStreetMap.`;
    placesStatusState = "error";
    setMapStatus(placesStatusMessage, placesStatusState);
    mapRetryButton.hidden = false;
    return;
  }
  placesStatusMessage = `${places.length} Rush and Fingal places found. Select a marker for details.`;
  placesStatusState = "success";
  setMapStatus(placesStatusMessage, placesStatusState);
}

function selectMapTab(name) {
  activeMap = name;
  const showingPubs = name === "pubs";
  pubsTab.setAttribute("aria-selected", String(showingPubs));
  pubsTab.tabIndex = showingPubs ? 0 : -1;
  pubsTab.classList.toggle("is-active", showingPubs);
  placesTab.setAttribute("aria-selected", String(!showingPubs));
  placesTab.tabIndex = showingPubs ? -1 : 0;
  placesTab.classList.toggle("is-active", !showingPubs);
  mapPanel.setAttribute("aria-labelledby", showingPubs ? "pubs-tab" : "places-tab");
  pubMapElement.setAttribute(
    "aria-label",
    showingPubs ? "Interactive map of pubs in Rush" : "Interactive map of Rush and Fingal places of interest",
  );
  mapDescription.textContent = showingPubs
    ? "Pubs in town and nearby. Select a marker for details."
    : "Beaches, heritage and local connections around Rush. Select a marker for details.";
  if (pubGraphicsLayer && placesGraphicsLayer) {
    pubGraphicsLayer.visible = showingPubs;
    placesGraphicsLayer.visible = !showingPubs;
    if (showingPubs) {
      loadPubs();
    } else if (!placesLoaded) {
      loadPlacesOfInterest();
    } else {
      setMapStatus(placesStatusMessage, placesStatusState);
      mapRetryButton.hidden = placesStatusState !== "error";
    }
  }
}

for (const [tab, name] of [[pubsTab, "pubs"], [placesTab, "places"]]) {
  tab.addEventListener("click", () => selectMapTab(name));
  tab.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const next = name === "pubs" ? placesTab : pubsTab;
      next.focus();
      selectMapTab(next === pubsTab ? "pubs" : "places");
    }
  });
}

async function initializePubMap() {
  setMapStatus("Loading the Rush map and pub locations…", "loading");
  mapRetryButton.hidden = true;

  try {
    const [{ default: Map }, { default: MapView }, { default: Basemap }, { default: WebTileLayer }, { default: GraphicsLayer }, { default: Graphic }] =
      await Promise.all([
        import("https://js.arcgis.com/4.34/@arcgis/core/Map.js"),
        import("https://js.arcgis.com/4.34/@arcgis/core/views/MapView.js"),
        import("https://js.arcgis.com/4.34/@arcgis/core/Basemap.js"),
        import("https://js.arcgis.com/4.34/@arcgis/core/layers/WebTileLayer.js"),
        import("https://js.arcgis.com/4.34/@arcgis/core/layers/GraphicsLayer.js"),
        import("https://js.arcgis.com/4.34/@arcgis/core/Graphic.js"),
      ]);
    ArcGraphic = Graphic;

    const tiles = new WebTileLayer({
      urlTemplate: "https://tile.openstreetmap.de/{level}/{col}/{row}.png",
      copyright: 'Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
      title: "OpenStreetMap",
    });
    pubGraphicsLayer = new GraphicsLayer({ title: "Pubs around Rush" });
    placesGraphicsLayer = new GraphicsLayer({ title: "Places of interest near Rush", visible: false });
    const map = new Map({
      basemap: new Basemap({
        baseLayers: [tiles],
        id: "rush-openstreetmap",
        title: "OpenStreetMap",
      }),
      layers: [pubGraphicsLayer, placesGraphicsLayer],
    });

    mapView = new MapView({
      container: pubMapElement,
      map,
      center: [rushCenter.longitude, rushCenter.latitude],
      zoom: 14,
      constraints: { minZoom: 11, maxZoom: 19 },
      popup: { dockEnabled: false },
    });
    await mapView.when();
    await loadPubs();
  } catch (error) {
    console.error("Unable to initialize the Rush pub map.", error);
    setMapStatus("The interactive map couldn't be loaded. Check your connection and try again.", "error");
    mapRetryButton.hidden = false;
  }
}

mapRetryButton.addEventListener("click", () => {
  if (!mapView) {
    initializePubMap();
  } else if (activeMap === "pubs") {
    loadPubs();
  } else {
    placesLoaded = false;
    loadPlacesOfInterest();
  }
});

const aisArea = {
  south: 53.47,
  west: -6.16,
  north: 53.58,
  east: -5.92,
};

function setAisStatus(message, state = "success") {
  aisStatus.textContent = message;
  aisStatus.dataset.state = state;
}

function updateAisConnectionStatus() {
  if (aisSocket?.readyState !== WebSocket.OPEN || aisVessels.size > 0) return;
  if (Date.now() - aisConnectedAt >= 15000) {
    setAisStatus(
      "Connected, but no recent vessel positions have been reported in this Rush coastal area. The map is empty until actual AIS data is received.",
      "empty",
    );
  } else {
    setAisStatus("Connected to Open Waters AIS. Waiting for actual vessel reports in the Rush area…", "loading");
  }
}

function addAisEvent(event) {
  if (
    event.type !== "event" ||
    !Number.isFinite(event.lat) ||
    !Number.isFinite(event.lon) ||
    event.lat < aisArea.south ||
    event.lat > aisArea.north ||
    event.lon < aisArea.west ||
    event.lon > aisArea.east
  ) {
    return;
  }

  const mmsi = String(event.mmsi || event.message?.UserID || "");
  if (!mmsi) return;
  const name = event.name || event.ship_name || event.message?.Name || `Vessel ${mmsi}`;
  const existing = aisVessels.get(mmsi);
  const seen = event.time || new Date().toISOString();
  if (existing && Date.parse(seen) < Date.parse(existing.attributes.seen)) return;
  const attributes = {
    mmsi,
    name,
    seen,
    source: event.source || "Unknown AIS source",
    station: event.station || "",
    attribution: event.attribution || "",
    license: event.license || "",
    speed: Number.isFinite(event.sog) ? `${event.sog} kn` : "",
    course: Number.isFinite(event.cog) ? `${event.cog}°` : "",
    destination: event.destination || "",
  };

  if (existing) {
    existing.geometry = { type: "point", longitude: event.lon, latitude: event.lat };
    existing.attributes = attributes;
  } else {
    const graphic = new ArcGraphic({
      geometry: { type: "point", longitude: event.lon, latitude: event.lat },
      attributes,
      symbol: {
        type: "simple-marker",
        style: "circle",
        color: "#008ca8",
        size: 11,
        outline: { color: "#fff", width: 2 },
      },
      popupTemplate: {
        title: "{name}",
        content: (feature) => {
          const vessel = feature.graphic.attributes;
          const content = document.createElement("div");
          const details = [
            `MMSI: ${vessel.mmsi}`,
            vessel.speed && `Speed: ${vessel.speed}`,
            vessel.course && `Course: ${vessel.course}`,
            vessel.destination && `Destination: ${vessel.destination}`,
            `Last AIS report: ${new Date(vessel.seen).toLocaleString()}`,
            `Reported by: ${vessel.source}`,
            vessel.station && `Station: ${vessel.station}`,
          ].filter(Boolean);
          const paragraph = document.createElement("p");
          paragraph.textContent = details.join("\n");
          content.append(paragraph);
          if (vessel.attribution) {
            const credit = document.createElement("p");
            credit.className = "map-popup-credit";
            credit.textContent = vessel.attribution;
            content.append(credit);
          }
          if (vessel.license) {
            const license = document.createElement("p");
            license.className = "map-popup-credit";
            license.textContent = `Data license: ${vessel.license}`;
            content.append(license);
          }
          return content;
        },
      },
    });
    aisVessels.set(mmsi, graphic);
    aisGraphicsLayer.add(graphic);
  }

  const received = aisVessels.size;
  setAisStatus(
    `${received} unique AIS ${received === 1 ? "vessel" : "vessels"} reported in the Rush coastal area. Positions are reception reports, not navigation data.`,
    "success",
  );
}

function closeAisStream() {
  if (aisSocket && aisSocket.readyState < WebSocket.CLOSING) {
    aisSocket.close(1000, "User requested reconnect");
  }
}

function connectAisStream() {
  closeAisStream();
  window.clearInterval(aisStatusTimer);
  aisRetryButton.hidden = true;
  if (!aisMapView || !aisGraphicsLayer) {
    setAisStatus("The vessel map is unavailable. Check your connection and try again.", "error");
    aisRetryButton.hidden = false;
    return;
  }

  aisGraphicsLayer.removeAll();
  aisVessels.clear();
  aisConnectedAt = 0;
  setAisStatus("Connecting to the public, key-free Open Waters AIS stream for Rush…", "loading");

  try {
    aisSocket = new WebSocket("wss://ais.openwaters.io/v1/stream");
  } catch (error) {
    console.error("Unable to open the Open Waters AIS stream.", error);
    setAisStatus("The live AIS stream could not be started. Check your connection and try again.", "error");
    aisRetryButton.hidden = false;
    return;
  }

  aisSocket.addEventListener("open", () => {
    aisConnectedAt = Date.now();
    aisStatusTimer = window.setInterval(updateAisConnectionStatus, 5000);
    aisSocket.send(JSON.stringify({
      type: "subscribe",
      bbox: [[aisArea.south, aisArea.west, aisArea.north, aisArea.east]],
      snapshot: true,
    }));
    setAisStatus("Connected to Open Waters AIS. Waiting for actual vessel reports in the Rush area…", "loading");
  }, { once: true });

  aisSocket.addEventListener("message", async ({ data }) => {
    try {
      const text = typeof data === "string" ? data : await data.text();
      const event = JSON.parse(text);
      if (event.type === "event") {
        addAisEvent(event);
      } else if (event.type === "error") {
        setAisStatus(`Open Waters AIS reported an error: ${event.error || "unknown error"}.`, "error");
        aisRetryButton.hidden = false;
        aisSocket.close();
      } else if (event.type === "welcome" || event.type === "ack") {
        updateAisConnectionStatus();
      }
    } catch (error) {
      console.error("Unable to process an Open Waters AIS message.", error);
      setAisStatus("A vessel-data message could not be read. The live feed remains connected.", "error");
    }
  });

  aisSocket.addEventListener("error", () => {
    setAisStatus("The Open Waters AIS stream is unavailable from this network. No vessel positions are shown.", "error");
    aisRetryButton.hidden = false;
  });

  aisSocket.addEventListener("close", (event) => {
    if (event.target !== aisSocket) return;
    window.clearInterval(aisStatusTimer);
    aisRetryButton.hidden = false;
    setAisStatus(
      `The live AIS stream disconnected${event.reason ? `: ${event.reason}` : ""}. No positions are being updated.`,
      "error",
    );
  });

}

async function initializeAisMap() {
  setAisStatus("Loading the AIS map centered on Rush and its nearby coastal waters…", "loading");
  aisRetryButton.hidden = true;
  try {
    const [{ default: Map }, { default: MapView }, { default: Basemap }, { default: WebTileLayer }, { default: GraphicsLayer }, { default: Graphic }, { default: Extent }] =
      await Promise.all([
        import("https://js.arcgis.com/4.34/@arcgis/core/Map.js"),
        import("https://js.arcgis.com/4.34/@arcgis/core/views/MapView.js"),
        import("https://js.arcgis.com/4.34/@arcgis/core/Basemap.js"),
        import("https://js.arcgis.com/4.34/@arcgis/core/layers/WebTileLayer.js"),
        import("https://js.arcgis.com/4.34/@arcgis/core/layers/GraphicsLayer.js"),
        import("https://js.arcgis.com/4.34/@arcgis/core/Graphic.js"),
        import("https://js.arcgis.com/4.34/@arcgis/core/geometry/Extent.js"),
      ]);
    ArcGraphic = Graphic;
    const tiles = new WebTileLayer({
      urlTemplate: "https://tile.openstreetmap.de/{level}/{col}/{row}.png",
      copyright: 'Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
      title: "OpenStreetMap",
    });
    aisGraphicsLayer = new GraphicsLayer({ title: "Live AIS vessels around Rush" });
    const map = new Map({
      basemap: new Basemap({
        baseLayers: [tiles],
        id: "rush-ais-openstreetmap",
        title: "OpenStreetMap",
      }),
      layers: [aisGraphicsLayer],
    });
    aisMapView = new MapView({
      container: aisMapElement,
      map,
      center: [-6.045, 53.525],
      zoom: 11,
      constraints: { minZoom: 9, maxZoom: 18 },
      popup: { dockEnabled: false },
    });
    await aisMapView.when();
    await aisMapView.goTo({
      target: new Extent({
        xmin: aisArea.west,
        ymin: aisArea.south,
        xmax: aisArea.east,
        ymax: aisArea.north,
        spatialReference: { wkid: 4326 },
      }),
    });
    connectAisStream();
  } catch (error) {
    console.error("Unable to initialize the Rush AIS map.", error);
    setAisStatus("The vessel map could not be loaded. Check your connection and try again.", "error");
    aisRetryButton.hidden = false;
  }
}

aisRetryButton.addEventListener("click", () => {
  if (!aisMapView) {
    initializeAisMap();
  } else {
    connectAisStream();
  }
});

initializePubMap();
initializeAisMap();
