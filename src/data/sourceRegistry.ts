export type EvidenceClass = 'observed' | 'calculated' | 'operational' | 'reference';

export interface SourceCopy {
  en: string;
  tr: string;
}

export interface SourceRecord {
  id: string;
  evidence: EvidenceClass;
  title: string;
  provider: string;
  sourceUrl: string;
  updateModel: SourceCopy;
  scope: SourceCopy;
  limitation?: SourceCopy;
}

/**
 * The application-level evidence map. It deliberately distinguishes the
 * rendered simulation, archived observations and operational tracking data so
 * a visitor never has to infer that every item is a live NASA observation.
 */
export const SOURCE_REGISTRY: readonly SourceRecord[] = [
  {
    id: 'planetary-ephemeris',
    evidence: 'calculated',
    title: 'Planetary ephemeris',
    provider: 'astronomy-engine · VSOP87',
    sourceUrl: 'https://github.com/cosinekitty/astronomy',
    updateModel: { en: 'Recomputed for the simulation instant', tr: 'Simülasyon anı için yeniden hesaplanır' },
    scope: {
      en: 'Heliocentric solar-system positions and illumination geometry.',
      tr: 'Güneş-merkezli Güneş Sistemi konumları ve aydınlatma geometrisi.'
    }
  },
  {
    id: 'moon-ephemeris',
    evidence: 'calculated',
    title: 'Moon ephemerides',
    provider: 'JPL Horizons · published orbital elements',
    sourceUrl: 'https://ssd.jpl.nasa.gov/horizons/',
    updateModel: { en: 'Calculated at the simulation instant', tr: 'Simülasyon anında hesaplanır' },
    scope: {
      en: 'Instantaneous bearings for supported moons, with source-anchored orbital phases.',
      tr: 'Desteklenen uydular için anlık doğrultular ve kaynağa bağlı yörünge evreleri.'
    },
    limitation: {
      en: 'Some secondary moons use mean elements; their short-period perturbations are not presented as precision navigation.',
      tr: 'Bazı ikincil uydular ortalama elemanlarla hesaplanır; kısa dönemli pertürbasyonlar hassas navigasyon gibi sunulmaz.'
    }
  },
  {
    id: 'surface-assets',
    evidence: 'observed',
    title: 'Rendered surfaces and moon models',
    provider: 'NASA / USGS / JPL · Solar System Scope CC BY 4.0',
    sourceUrl: '/textures/ATTRIBUTION.md',
    updateModel: { en: 'Versioned project assets', tr: 'Sürümlü proje varlıkları' },
    scope: {
      en: 'Published global mosaics and official NASA 3D Resources models where coverage permits.',
      tr: 'Kapsamın izin verdiği yerde yayımlanmış küresel mozaikler ve resmî NASA 3D Resources modelleri.'
    },
    limitation: {
      en: 'Solar System Scope maps are NASA-derived, licensed third-party assets; they are not labelled as direct NASA imagery.',
      tr: 'Solar System Scope haritaları NASA türevlidir ve üçüncü taraf lisanslı varlıklardır; doğrudan NASA görüntüsü diye etiketlenmez.'
    }
  },
  {
    id: 'planetary-facts',
    evidence: 'reference',
    title: 'Planetary constants',
    provider: 'NASA Planetary Fact Sheet',
    sourceUrl: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/',
    updateModel: { en: 'Checked when the project data is revised', tr: 'Proje verisi yenilenirken kontrol edilir' },
    scope: {
      en: 'Radii, masses, gravity, rotation and atmosphere facts in object dossiers.',
      tr: 'Nesne dosyalarındaki yarıçap, kütle, yerçekimi, dönüş ve atmosfer bilgileri.'
    }
  },
  {
    id: 'nasa-observations',
    evidence: 'observed',
    title: 'Earth, solar and space-weather observations',
    provider: 'NASA EPIC · SDO · DONKI',
    sourceUrl: 'https://api.nasa.gov/',
    updateModel: { en: 'Server-cached, requested on demand', tr: 'Sunucu önbellekli, istek üzerine alınır' },
    scope: {
      en: 'Observed Earth and solar imagery plus solar event reports; source timestamps stay visible.',
      tr: 'Gözlemlenmiş Dünya/Güneş görüntüleri ve Güneş olay raporları; kaynak zaman damgaları görünür kalır.'
    }
  },
  {
    id: 'jpl-services',
    evidence: 'operational',
    title: 'Mission vectors and close approaches',
    provider: 'JPL Horizons · CNEOS',
    sourceUrl: 'https://ssd.jpl.nasa.gov/api.html',
    updateModel: { en: 'Bounded server requests, cached per response', tr: 'Sınırlandırılmış sunucu istekleri, yanıt bazında önbellekli' },
    scope: {
      en: 'Spacecraft state vectors and selected near-Earth-object close-approach records.',
      tr: 'Uzay aracı durum vektörleri ve seçili Dünya’ya yakın cisim geçiş kayıtları.'
    }
  },
  {
    id: 'archive-catalogues',
    evidence: 'observed',
    title: 'Exoplanet and deep-sky catalogues',
    provider: 'NASA Exoplanet Archive · NASA/IPAC NED',
    sourceUrl: 'https://exoplanetarchive.ipac.caltech.edu/docs/API_resources.html',
    updateModel: { en: 'Server-cached, fetched when the Atlas asks', tr: 'Sunucu önbellekli, Atlas istediğinde alınır' },
    scope: {
      en: 'Confirmed exoplanet records and bounded named extragalactic-object resolution.',
      tr: 'Doğrulanmış ötegezegen kayıtları ve sınırlı adlı ekstragalaktik nesne çözümleme.'
    },
    limitation: {
      en: 'The Atlas is not an all-sky download or a claim to render every galaxy.',
      tr: 'Atlas, tam gökyüzü indirmesi ya da her galaksiyi renderlama iddiası değildir.'
    }
  },
  {
    id: 'tle-tracking',
    evidence: 'operational',
    title: 'Operational satellite tracking',
    provider: 'CelesTrak TLE · SGP4',
    sourceUrl: 'https://celestrak.org/',
    updateModel: { en: 'Element age and fetch age shown beside predictions', tr: 'Eleman yaşı ve indirme yaşı tahminlerin yanında gösterilir' },
    scope: {
      en: 'ISS, Starlink and selected constellation propagation in the browser.',
      tr: 'Tarayıcı içinde ISS, Starlink ve seçili takımyıldızlarının yayılımı.'
    },
    limitation: {
      en: 'This is operational orbital data, not a NASA data service; accuracy degrades as the TLE epoch ages.',
      tr: 'Bu, NASA veri servisi değil operasyonel yörünge verisidir; TLE epoğu yaşlandıkça doğruluk azalır.'
    }
  }
];
