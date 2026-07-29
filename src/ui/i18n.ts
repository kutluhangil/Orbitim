import { create } from 'zustand';
import type { BodyId, BodyKind } from '../lib/ephemeris/bodies';

export type AppLanguage = 'en' | 'tr';

const LANGUAGE_STORAGE_KEY = 'orbitim.language';

function readPersistedLanguage(): AppLanguage {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return stored === 'tr' ? 'tr' : 'en';
  } catch (cause) {
    console.warn('Orbitim could not read the saved language preference.', cause);
    return 'en';
  }
}

function persistLanguage(language: AppLanguage): void {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch (cause) {
    console.warn('Orbitim could not save the language preference.', cause);
  }
}

interface LanguageState {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
}

/**
 * Language stays on this device so a reader does not have to choose it again;
 * shared simulation links deliberately omit that reader preference.
 */
export const useLanguage = create<LanguageState>((set) => ({
  language: readPersistedLanguage(),
  setLanguage: (language) => {
    persistLanguage(language);
    set({ language });
  }
}));

const EN = {
  language: 'Language',
  english: 'English',
  turkish: 'Türkçe',
  changeLanguage: 'Change language',
  hideOrbits: 'Hide orbit lines',
  showOrbits: 'Show orbit lines',
  hideConstellations: 'Hide constellations',
  showConstellations: 'Show constellations',
  switchLight: 'Switch to light theme',
  switchDark: 'Switch to dark theme',
  cockpit: 'Scene controls',
  openCockpit: 'Open scene controls',
  closeCockpit: 'Close scene controls',
  cockpitHint: 'Modes, sky layers, appearance, language and sharing.',
  orbits: 'Orbits',
  constellations: 'Sky lines',
  appearance: 'Theme',
  solarSystem: 'Solar System',
  visitSystem: 'Visit Solar System overview',
  visitBody: 'Visit {body}',
  visitMoon: 'Visit {moon}',
  moonsOf: '{body} moons',
  showMoons: 'Show moons of {body}',
  liveEphemeris: '{count} bodies · live ephemeris',
  experienceMode: 'Experience mode',
  explore: 'Explore',
  scientific: 'Scientific',
  now: 'Now',
  exploreDescription: 'Calm navigation view',
  scientificDescription: 'Calculated lighting and event evidence',
  nowDescription: 'Return the simulation clock to current UTC',
  pauseTime: 'Pause simulated time',
  resumeTime: 'Resume simulated time',
  pause: 'Pause',
  play: 'Play',
  real: 'Real',
  liveBodies: 'Live · {count} bodies',
  solarSystemObserved: 'Solar system, observed',
  landingTitleLineOne: 'Everything up there,',
  landingTitleLineTwo: 'where it is right now.',
  landingBody: 'Thirty worlds, their rings and moons, and eleven thousand tracked satellites — placed by orbital mechanics rather than by hand. Fly to any of them and read what we know today.',
  enterSystem: 'Enter the system',
  pressEnter: 'or press Enter',
  liveReadings: 'Live readings',
  universalTime: 'Universal time',
  earthOrbitalSpeed: 'Earth orbital speed',
  rangeToMars: 'Range to Mars',
  rangeToMoon: 'Range to the Moon',
  sunlightTransit: 'Sunlight in transit',
  minutesOld: 'minutes old',
  millionKm: 'million km',
  ephemeris: 'Ephemeris',
  positionsNotAnimations: 'Positions, not animations',
  ephemerisBody: 'Every body sits where VSOP87 says it is for the instant on the clock. Scrub to 2031 and the alignment is the one the sky will hold.',
  propagation: 'Propagation',
  satellitesLive: 'Satellites from live elements',
  propagationBody: 'CelesTrak orbital elements, SGP4 propagated in your browser. Fourteen constellations, switched on and off as you like.',
  surfaces: 'Surfaces',
  surfaceTitle: 'Eight thousand pixels wide',
  surfaceBody: 'NASA-derived imagery streams in as you approach and is released as you leave. Clouds, city lights, ring shadows and all.',
  hide: 'Hide',
  details: 'Details',
  rightNow: 'Right now',
  distanceFromEarth: 'Distance from Earth',
  lightTravelTime: 'Light travel time',
  distanceFromSun: 'Distance from Sun',
  apparentMagnitude: 'Apparent magnitude',
  illuminated: 'Illuminated',
  illumination: 'Illumination',
  solarFlux: 'Solar flux',
  geometry: 'Geometry',
  computedAt: 'Computed at',
  scale: 'Scale',
  compressedDistances: 'Visual distances compressed',
  surfaceRelief: 'Surface relief',
  elevation: 'Elevation',
  coverage: 'Coverage',
  measurements: 'Measurements',
  reliefScale: 'Relief scale',
  physicalElevation: 'Physical elevation',
  factSheet: 'Fact sheet',
  equatorialRadius: 'Equatorial radius',
  mass: 'Mass',
  surfaceGravity: 'Surface gravity',
  meanTemperature: 'Mean temperature',
  axialTilt: 'Axial tilt',
  dayLength: 'Day length',
  orbitalPeriod: 'Orbital period',
  knownMoons: 'Known moons',
  atmosphere: 'Atmosphere',
  activeMissions: 'Active missions',
  exploration: 'Exploration',
  moonsInView: 'Moons in view',
  sourceFootnote: 'Positions from VSOP87 via astronomy-engine. Constants from the NASA Planetary Fact Sheet.',
  notDefined: 'not defined',
  earthFlux: 'Earth',
  star: 'Star',
  planet: 'Planet',
  dwarf: 'Dwarf planet',
  moon: 'Moon',
  calculatedEvents: 'Calculated events',
  eventHorizon: '45 d horizon · UTC',
  visitEvent: 'Visit {event} at {time}',
  skyRightNow: 'The sky right now',
  comingUp: 'Coming up',
  visitEventShort: 'Visit event',
  eventGeometryNote: 'Event geometry is calculated from the simulation ephemeris for the UTC instant on the clock.',
  jplTrajectories: 'JPL trajectories',
  refresh: 'Refresh',
  load: 'Load',
  loading: 'Loading…',
  localSky: 'Local sky',
  localCivilTime: 'Local civil time',
  topocentricHorizon: 'Topocentric ephemeris · horizon',
  observationLocation: 'Observation location',
  useDeviceLocation: 'Use device location',
  noBrightBody: 'No selected bright body is above the horizon.',
  nextIssPass: 'Next ISS pass',
  starlinkRises: 'Starlink rises',
  find: 'Find',
  scanning: 'Scanning…',
  satellites: 'Satellites',
  close: 'Close',
  rideIss: 'Ride the ISS',
  solarWeather: 'Solar weather',
  nasaReports: 'NASA DONKI · server-cached reports',
  solarImpactLedger: 'Solar impact ledger',
  last14Days: 'last 14 days',
  energeticParticles: 'Energetic particles',
  interplanetaryShocks: 'Interplanetary shocks',
  highSpeedStreams: 'High-speed streams',
  radiationBelts: 'Radiation-belt events',
  magnetopauseCrossings: 'Magnetopause crossings',
  spaceWeatherNotices: 'Research notices',
  enlilSimulations: 'WSA–Enlil simulations',
  observedReport: 'Observed event',
  reportedNotice: 'Research notice',
  modelOutput: 'Model output',
  reportCount: '{count} reports',
  sourceUnavailable: 'Source unavailable',
  solarImpactScopeNote: 'WSA–Enlil is model output. DONKI notices are preliminary NASA research reports, not NOAA forecasts.',
  refreshSolarWeather: 'Refresh NASA solar weather',
  latestFlare: 'Latest flare',
  latestCme: 'Latest CME',
  geomagneticKp: 'Geomagnetic Kp',
  loadingNasaReports: 'Loading NASA reports…',
  updated: 'Updated',
  solarVisualsNote: 'Solar visuals respond to these observed reports.',
  openNasaEyes: 'Open NASA Eyes · DSN Now ↗',
  shareView: 'Share view',
  linkCopied: 'Link copied',
  inAddressBar: 'In address bar',
  earthObservation: 'Earth observation',
  solarObservation: 'Solar observation',
  sourceImage: 'Source image; not mapped onto this simulation.',
  unavailable: 'Unavailable',
  observed: 'Observed',
  assetUpdated: 'Asset updated',
  loadingNasaImage: 'Loading the NASA source image…',
  nasaUnavailable: 'NASA source unavailable: {error}'
  ,imminent: 'imminent'
  ,tomorrow: 'tomorrow'
  ,inDays: 'in {count} days'
  ,inMonths: 'in {count} months'
  ,inYears: 'in {count} years'
  ,lit: 'lit'
  ,waxing: 'waxing'
  ,waning: 'waning'
  ,vectorsFetched: '{count} heliocentric state vectors · JPL Horizons · fetched {time} UTC'
  ,requestingLiveVectors: 'Requesting exact heliocentric state vectors from JPL Horizons.'
  ,referenceTrajectory: 'A vector is used only at its stated instant; scrubbed times retain the clearly labelled reference trajectory.'
  ,nearEarthApproaches: 'Near-Earth approaches'
  ,approachesOnDemand: 'The next six NEO approaches within 0.05 AU, requested only when opened.'
  ,nearApproachUnavailable: 'Near-approach data unavailable: {error}'
  ,noMatchingApproaches: 'No matching approaches in the requested window.'
  ,timesTdb: 'times are TDB'
  ,eventSourceNote: 'Eclipses, transits and phases from astronomy-engine, for the instant on the clock.'
  ,noReport: 'No report'
  ,speedPending: 'Speed pending'
  ,readingPending: 'Reading pending'
  ,noFlareLast14Days: 'No flare report in the last 14 days'
  ,noCmeLast14Days: 'No CME report in the last 14 days'
  ,noStormLast14Days: 'No storm report in the last 14 days'
  ,nasaTelemetryUnavailable: 'NASA telemetry unavailable: {error}'
  ,dsnStatusNote: 'Live station status remains in NASA’s dedicated interface; Orbitim does not infer DSN links.'
  ,deviceLocation: 'Device location'
  ,locationUnsupported: 'This browser does not provide device location.'
  ,locationUnavailable: 'Location unavailable: {error}'
  ,stationElementsUnavailable: 'Station elements unavailable: {error}'
  ,starlinkSearchUnavailable: 'Starlink pass search unavailable: {error}'
  ,loadingStationElements: 'Loading current station elements…'
  ,issPass: 'Rise {rise} · peak {altitude} · set {set}'
  ,noIssPass: 'No ISS pass above the horizon in the next 24 hours.'
  ,tlePredictionNote: 'TLE prediction sampled at one-minute cadence; 10° minimum altitude; times are UTC.'
  ,starlinkOnDemand: 'Runs on demand in a worker; only rises above 10° are listed.'
  ,noStarlinkRises: 'No Starlink rises above 10° in the next 12 hours.'
  ,geometricRisesNote: 'These are geometric rises, not an optical-brightness forecast.'
  ,debrisClouds: 'Debris clouds'
  ,issMissing: 'ISS (NORAD {norad}) is not in the loaded stations element set.'
  ,stationsLoadFailed: 'Could not load the stations element set: {error}'
  ,altitude: 'Altitude'
  ,speed: 'Speed'
  ,latitude: 'Latitude'
  ,longitude: 'Longitude'
  ,orbit: 'Orbit'
  ,period: 'Period'
  ,inclination: 'Inclination'
  ,eccentricity: 'Eccentricity'
  ,apogee: 'Apogee'
  ,perigee: 'Perigee'
  ,elementSet: 'Element set'
  ,noradId: 'NORAD id'
  ,epoch: 'Epoch'
  ,ageAtSimTime: 'Age at sim time'
  ,release: 'Release'
  ,rideAlong: 'Ride along'
  ,illustrationRepresentative: 'Illustration · representative of class'
  ,satellitePropagationError: 'SGP4 returned error {error} for this element set at the instant on the clock — no position can be computed for it. The orbit below is what the element set itself states.'
  ,satelliteSourceNote: 'Position and velocity propagated with SGP4 from the CelesTrak element set above. Accuracy degrades with the age of that set.'
  ,days: 'days'
  ,spacecraftIllustration: 'Representative illustration of a {group} class spacecraft'
  ,inspectSpacecraft: 'Inspect 3D model of {craft}'
  ,atlas: 'Atlas'
  ,openAtlas: 'Open Explore Atlas'
  ,dataHealth: 'Data health'
  ,openDataHealth: 'Open data health'
  ,journeys: 'Journeys'
  ,openJourneys: 'Open time journeys'
} as const;

type TranslationKey = keyof typeof EN;

const TR: Record<TranslationKey, string> = {
  language: 'Dil',
  english: 'English',
  turkish: 'Türkçe',
  changeLanguage: 'Dili değiştir',
  hideOrbits: 'Yörünge çizgilerini gizle',
  showOrbits: 'Yörünge çizgilerini göster',
  hideConstellations: 'Takımyıldızları gizle',
  showConstellations: 'Takımyıldızları göster',
  switchLight: 'Açık temaya geç',
  switchDark: 'Koyu temaya geç',
  cockpit: 'Sahne kontrolleri',
  openCockpit: 'Sahne kontrollerini aç',
  closeCockpit: 'Sahne kontrollerini kapat',
  cockpitHint: 'Modlar, gökyüzü katmanları, görünüm, dil ve paylaşım.',
  orbits: 'Yörüngeler',
  constellations: 'Gökyüzü',
  appearance: 'Tema',
  solarSystem: 'Güneş Sistemi',
  visitSystem: 'Güneş Sistemi genel görünümüne git',
  visitBody: '{body} görünümüne git',
  visitMoon: '{moon} görünümüne git',
  moonsOf: '{body} uyduları',
  showMoons: '{body} uydularını göster',
  liveEphemeris: '{count} gök cismi · canlı efemeris',
  experienceMode: 'Deneyim modu',
  explore: 'Keşfet',
  scientific: 'Bilimsel',
  now: 'Şimdi',
  exploreDescription: 'Sakin gezinme görünümü',
  scientificDescription: 'Hesaplanmış aydınlatma ve olay kanıtları',
  nowDescription: 'Simülasyon saatini güncel UTC zamanına döndür',
  pauseTime: 'Simülasyon zamanını duraklat',
  resumeTime: 'Simülasyon zamanını sürdür',
  pause: 'Duraklat',
  play: 'Oynat',
  real: 'Gerçek',
  liveBodies: 'Canlı · {count} gök cismi',
  solarSystemObserved: 'Gözlemlenen Güneş Sistemi',
  landingTitleLineOne: 'Yukarıdaki her şey,',
  landingTitleLineTwo: 'tam şu an olduğu yerde.',
  landingBody: 'Otuz dünya, halkaları ve uyduları ile on bir bin izlenen uydu — elle yerleştirmek yerine yörünge mekaniğiyle konumlandırıldı. Her birine uçun ve bugün bildiklerimizi okuyun.',
  enterSystem: 'Sisteme gir',
  pressEnter: 'veya Enter tuşuna bas',
  liveReadings: 'Canlı okumalar',
  universalTime: 'Evrensel zaman',
  earthOrbitalSpeed: 'Dünya yörünge hızı',
  rangeToMars: 'Mars uzaklığı',
  rangeToMoon: 'Ay uzaklığı',
  sunlightTransit: 'Güneş ışığı yolculuğu',
  minutesOld: 'dakika önce',
  millionKm: 'milyon km',
  ephemeris: 'Efemeris',
  positionsNotAnimations: 'Animasyon değil, konum',
  ephemerisBody: 'Her gök cismi, saatteki an için VSOP87’nin verdiği konuma yerleşir. 2031’e kaydırdığınızda hizalanma gökyüzünün alacağı hizalanmadır.',
  propagation: 'Yayılım',
  satellitesLive: 'Canlı elemanlardan uydular',
  propagationBody: 'CelesTrak yörünge elemanları tarayıcınızda SGP4 ile yayılır. On dört takımyıldızı dilediğiniz gibi açıp kapatabilirsiniz.',
  surfaces: 'Yüzeyler',
  surfaceTitle: 'Sekiz bin piksel genişliğinde',
  surfaceBody: 'Yaklaştıkça NASA kökenli görüntüler yüklenir, uzaklaştıkça bırakılır. Bulutlar, şehir ışıkları ve halka gölgeleriyle birlikte.',
  hide: 'Gizle',
  details: 'Detaylar',
  rightNow: 'Şu an',
  distanceFromEarth: 'Dünya uzaklığı',
  lightTravelTime: 'Işık yolculuk süresi',
  distanceFromSun: 'Güneş uzaklığı',
  apparentMagnitude: 'Görünür kadir',
  illuminated: 'Aydınlık kısım',
  illumination: 'Aydınlatma',
  solarFlux: 'Güneş akısı',
  geometry: 'Geometri',
  computedAt: 'Hesaplama anı',
  scale: 'Ölçek',
  compressedDistances: 'Görsel uzaklıklar sıkıştırılmıştır',
  surfaceRelief: 'Yüzey rölyefi',
  elevation: 'Yükseklik',
  coverage: 'Kapsam',
  measurements: 'Ölçümler',
  reliefScale: 'Rölyef ölçeği',
  physicalElevation: 'Fiziksel yükseklik',
  factSheet: 'Bilgi föyü',
  equatorialRadius: 'Ekvator yarıçapı',
  mass: 'Kütle',
  surfaceGravity: 'Yüzey çekimi',
  meanTemperature: 'Ortalama sıcaklık',
  axialTilt: 'Eksen eğikliği',
  dayLength: 'Gün uzunluğu',
  orbitalPeriod: 'Yörünge dönemi',
  knownMoons: 'Bilinen uydular',
  atmosphere: 'Atmosfer',
  activeMissions: 'Aktif görevler',
  exploration: 'Keşif',
  moonsInView: 'Görünen uydular',
  sourceFootnote: 'Konumlar astronomy-engine üzerinden VSOP87’den; sabitler NASA Gezegen Bilgi Föyü’nden alınır.',
  notDefined: 'tanımlı değil',
  earthFlux: 'Dünya',
  star: 'Yıldız',
  planet: 'Gezegen',
  dwarf: 'Cüce gezegen',
  moon: 'Uydu',
  calculatedEvents: 'Hesaplanmış olaylar',
  eventHorizon: '45 gün ufku · UTC',
  visitEvent: '{event} olayını {time} anında ziyaret et',
  skyRightNow: 'Şu anki gökyüzü',
  comingUp: 'Yaklaşanlar',
  visitEventShort: 'Olayı ziyaret et',
  eventGeometryNote: 'Olay geometrisi, saatteki UTC anı için simülasyon efemerisinden hesaplanır.',
  jplTrajectories: 'JPL yörüngeleri',
  refresh: 'Yenile',
  load: 'Yükle',
  loading: 'Yükleniyor…',
  localSky: 'Yerel gökyüzü',
  localCivilTime: 'Yerel sivil saat',
  topocentricHorizon: 'Toposentrik efemeris · ufuk',
  observationLocation: 'Gözlem konumu',
  useDeviceLocation: 'Cihaz konumunu kullan',
  noBrightBody: 'Seçili parlak gök cismi ufkun üzerinde değil.',
  nextIssPass: 'Sonraki ISS geçişi',
  starlinkRises: 'Starlink doğuşları',
  find: 'Bul',
  scanning: 'Taranıyor…',
  satellites: 'Uydular',
  close: 'Kapat',
  rideIss: 'ISS ile uç',
  solarWeather: 'Uzay hava durumu',
  nasaReports: 'NASA DONKI · sunucuda önbelleklenen raporlar',
  solarImpactLedger: 'Güneş etkisi günlüğü',
  last14Days: 'son 14 gün',
  energeticParticles: 'Enerjik parçacıklar',
  interplanetaryShocks: 'Gezegenlerarası şoklar',
  highSpeedStreams: 'Yüksek hızlı akışlar',
  radiationBelts: 'Radyasyon kuşağı olayları',
  magnetopauseCrossings: 'Manyetopoz geçişleri',
  spaceWeatherNotices: 'Araştırma bildirimleri',
  enlilSimulations: 'WSA–Enlil simülasyonları',
  observedReport: 'Gözlenmiş olay',
  reportedNotice: 'Araştırma bildirimi',
  modelOutput: 'Model çıktısı',
  reportCount: '{count} rapor',
  sourceUnavailable: 'Kaynak kullanılamıyor',
  solarImpactScopeNote: 'WSA–Enlil model çıktısıdır. DONKI bildirimleri NOAA tahmini değil, ön NASA araştırma raporlarıdır.',
  refreshSolarWeather: 'NASA uzay havasını yenile',
  latestFlare: 'Son parlama',
  latestCme: 'Son CME',
  geomagneticKp: 'Jeomanyetik Kp',
  loadingNasaReports: 'NASA raporları yükleniyor…',
  updated: 'Güncellendi',
  solarVisualsNote: 'Güneş görselleri bu gözlenmiş raporlara tepki verir.',
  openNasaEyes: 'NASA Eyes · DSN Now aç ↗',
  shareView: 'Görünümü paylaş',
  linkCopied: 'Bağlantı kopyalandı',
  inAddressBar: 'Adres çubuğunda',
  earthObservation: 'Dünya gözlemi',
  solarObservation: 'Güneş gözlemi',
  sourceImage: 'Kaynak görüntü; bu simülasyonun yüzeyine haritalanmaz.',
  unavailable: 'Kullanılamıyor',
  observed: 'Gözlemlendi',
  assetUpdated: 'Varlık güncellendi',
  loadingNasaImage: 'NASA kaynak görüntüsü yükleniyor…',
  nasaUnavailable: 'NASA kaynağı kullanılamıyor: {error}'
  ,imminent: 'çok yakında'
  ,tomorrow: 'yarın'
  ,inDays: '{count} gün sonra'
  ,inMonths: '{count} ay sonra'
  ,inYears: '{count} yıl sonra'
  ,lit: 'aydınlık'
  ,waxing: 'büyüyen'
  ,waning: 'küçülen'
  ,vectorsFetched: '{count} günmerkezli durum vektörü · JPL Horizons · alınma {time} UTC'
  ,requestingLiveVectors: 'JPL Horizons’dan kesin günmerkezli durum vektörleri isteniyor.'
  ,referenceTrajectory: 'Bir vektör yalnızca belirtilen anda kullanılır; kaydırılan zamanlar açıkça etiketlenmiş başvuru yörüngesini korur.'
  ,nearEarthApproaches: 'Dünya’ya yakın geçişler'
  ,approachesOnDemand: '0,05 AU içindeki sonraki altı NEO geçişi yalnızca açıldığında istenir.'
  ,nearApproachUnavailable: 'Yakın geçiş verisi kullanılamıyor: {error}'
  ,noMatchingApproaches: 'İstenen zaman penceresinde eşleşen geçiş yok.'
  ,timesTdb: 'zamanlar TDB’dir'
  ,eventSourceNote: 'Tutulmalar, geçişler ve evreler, saatteki an için astronomy-engine ile hesaplanır.'
  ,noReport: 'Rapor yok'
  ,speedPending: 'Hız bekleniyor'
  ,readingPending: 'Okuma bekleniyor'
  ,noFlareLast14Days: 'Son 14 günde parlama raporu yok'
  ,noCmeLast14Days: 'Son 14 günde CME raporu yok'
  ,noStormLast14Days: 'Son 14 günde fırtına raporu yok'
  ,nasaTelemetryUnavailable: 'NASA telemetrisi kullanılamıyor: {error}'
  ,dsnStatusNote: 'Canlı istasyon durumu NASA’nın kendi arayüzünde kalır; Orbitim DSN bağlantısı çıkarımında bulunmaz.'
  ,deviceLocation: 'Cihaz konumu'
  ,locationUnsupported: 'Bu tarayıcı cihaz konumunu sağlamıyor.'
  ,locationUnavailable: 'Konum kullanılamıyor: {error}'
  ,stationElementsUnavailable: 'İstasyon elemanları kullanılamıyor: {error}'
  ,starlinkSearchUnavailable: 'Starlink geçiş araması kullanılamıyor: {error}'
  ,loadingStationElements: 'Güncel istasyon elemanları yükleniyor…'
  ,issPass: 'Doğuş {rise} · tepe {altitude} · batış {set}'
  ,noIssPass: 'Önümüzdeki 24 saatte ufkun üzerinde ISS geçişi yok.'
  ,tlePredictionNote: 'TLE tahmini bir dakikalık örneklerle yapılır; en düşük yükseklik 10°; zamanlar UTC’dir.'
  ,starlinkOnDemand: 'İstek üzerine bir worker’da çalışır; yalnızca 10° üzerindeki doğuşlar listelenir.'
  ,noStarlinkRises: 'Önümüzdeki 12 saatte 10° üzerinde Starlink doğuşu yok.'
  ,geometricRisesNote: 'Bunlar geometrik doğuşlardır; optik parlaklık tahmini değildir.'
  ,debrisClouds: 'Enkaz bulutları'
  ,issMissing: 'ISS (NORAD {norad}) yüklenen istasyon eleman kümesinde yok.'
  ,stationsLoadFailed: 'İstasyon eleman kümesi yüklenemedi: {error}'
  ,altitude: 'Yükseklik'
  ,speed: 'Hız'
  ,latitude: 'Enlem'
  ,longitude: 'Boylam'
  ,orbit: 'Yörünge'
  ,period: 'Dönem'
  ,inclination: 'Eğiklik'
  ,eccentricity: 'Dışmerkezlik'
  ,apogee: 'Apogee'
  ,perigee: 'Perigee'
  ,elementSet: 'Eleman kümesi'
  ,noradId: 'NORAD kimliği'
  ,epoch: 'Epok'
  ,ageAtSimTime: 'Simülasyon zamanındaki yaş'
  ,release: 'Bırak'
  ,rideAlong: 'Birlikte uç'
  ,illustrationRepresentative: 'İllüstrasyon · sınıfı temsil eder'
  ,satellitePropagationError: 'SGP4, saatteki an için bu eleman kümesinde {error} hatasını verdi — konum hesaplanamaz. Aşağıdaki yörünge, eleman kümesinin belirttiği yörüngedir.'
  ,satelliteSourceNote: 'Konum ve hız, yukarıdaki CelesTrak eleman kümesinden SGP4 ile yayılır. Doğruluk, kümenin yaşıyla azalır.'
  ,days: 'gün'
  ,spacecraftIllustration: '{group} sınıfı uzay aracını temsil eden illüstrasyon'
  ,inspectSpacecraft: '{craft} 3B modelini incele'
  ,atlas: 'Atlas'
  ,openAtlas: 'Keşfet Atlasını aç'
  ,dataHealth: 'Veri sağlığı'
  ,openDataHealth: 'Veri sağlığını aç'
  ,journeys: 'Yolculuklar'
  ,openJourneys: 'Zaman yolculuklarını aç'
};

const TRANSLATIONS: Record<AppLanguage, Record<TranslationKey, string>> = { en: EN, tr: TR };

const BODY_NAMES: Record<AppLanguage, Partial<Record<BodyId, string>>> = {
  en: {},
  tr: {
    sun: 'Güneş',
    mercury: 'Merkür',
    venus: 'Venüs',
    earth: 'Dünya',
    mars: 'Mars',
    jupiter: 'Jüpiter',
    saturn: 'Satürn',
    uranus: 'Uranüs',
    neptune: 'Neptün',
    ceres: 'Ceres',
    pluto: 'Plüton',
    moon: 'Ay',
    io: 'Io',
    europa: 'Europa',
    ganymede: 'Ganymede',
    callisto: 'Callisto',
    titan: 'Titan',
    phobos: 'Phobos',
    deimos: 'Deimos',
    triton: 'Triton',
    charon: 'Charon',
    mimas: 'Mimas',
    enceladus: 'Enceladus',
    tethys: 'Tethys',
    dione: 'Dione',
    rhea: 'Rhea',
    iapetus: 'Iapetus',
    titania: 'Titania',
    oberon: 'Oberon',
    miranda: 'Miranda'
  }
};

const BODY_KINDS: Record<BodyKind, TranslationKey> = {
  star: 'star',
  planet: 'planet',
  dwarf: 'dwarf',
  moon: 'moon'
};

function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

export function translate(
  language: AppLanguage,
  key: TranslationKey,
  values: Record<string, string | number> = {}
): string {
  return interpolate(TRANSLATIONS[language][key], values);
}

export function localizedBodyName(language: AppLanguage, id: BodyId, fallback: string): string {
  return BODY_NAMES[language][id] ?? fallback;
}

export function localizedBodyKind(language: AppLanguage, kind: BodyKind): string {
  return translate(language, BODY_KINDS[kind]);
}

export function useTranslation() {
  const language = useLanguage((state) => state.language);
  return {
    language,
    t: (key: TranslationKey, values?: Record<string, string | number>) => translate(language, key, values)
  };
}
