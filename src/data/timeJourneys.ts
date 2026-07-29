import type { BodyId } from '../lib/ephemeris/bodies';

interface JourneyCopy {
  title: string;
  eyebrow: string;
  summary: string;
  precision: string;
}

export interface TimeJourney {
  id: string;
  target: BodyId;
  /** UTC scene instant. Planetary and lunar geometry is recomputed at this time. */
  date: string;
  sourceName: string;
  sourceUrl: string;
  copy: Record<'en' | 'tr', JourneyCopy>;
}

/**
 * Curated, source-linked moments. These intentionally place only bodies whose
 * ephemerides are evaluated for the selected instant; they do not fabricate a
 * historical spacecraft trajectory where the project does not ship one.
 */
export const TIME_JOURNEYS: readonly TimeJourney[] = [
  {
    id: 'apollo-11',
    target: 'moon',
    date: '1969-07-20T20:17:40Z',
    sourceName: 'NASA Apollo 11',
    sourceUrl: 'https://www.nasa.gov/mission/apollo-11/',
    copy: {
      en: {
        title: 'Apollo 11 · Tranquility Base',
        eyebrow: '20 July 1969 · Moon',
        summary: 'Set the sky to the moment Eagle landed, then fly to the Moon and open the documented Apollo 11 surface marker.',
        precision: 'Lunar and planetary geometry is recalculated for this UTC instant; the lunar-module trajectory is not rendered.'
      },
      tr: {
        title: 'Apollo 11 · Huzur Üssü',
        eyebrow: '20 Temmuz 1969 · Ay',
        summary: 'Saati Eagle’ın iniş anına ayarla; ardından Ay’a uç ve belgelenmiş Apollo 11 yüzey işaretçisini aç.',
        precision: 'Ay ve gezegen geometrisi bu UTC anı için yeniden hesaplanır; Ay modülü rotası renderlanmaz.'
      }
    }
  },
  {
    id: 'voyager-io',
    target: 'io',
    date: '1979-03-05T12:05:00Z',
    sourceName: 'NASA Voyager 1',
    sourceUrl: 'https://science.nasa.gov/mission/voyager/voyager-1/',
    copy: {
      en: {
        title: 'Voyager 1 · Jupiter encounter',
        eyebrow: '5 March 1979 · Io',
        summary: 'Visit Io in the Jupiter encounter that transformed a small moon into the first known volcanically active world beyond Earth.',
        precision: 'The system clock restores planetary and supported-moon geometry; Voyager’s historical flyby path is not inferred.'
      },
      tr: {
        title: 'Voyager 1 · Jüpiter karşılaşması',
        eyebrow: '5 Mart 1979 · Io',
        summary: 'Küçük bir uyduyu Dünya dışındaki ilk bilinen aktif volkanik dünyaya dönüştüren Jüpiter karşılaşmasında Io’yu ziyaret et.',
        precision: 'Sistem saati gezegen ve desteklenen uydu geometrisini geri kurar; Voyager’ın tarihî geçiş rotası çıkarımsanmaz.'
      }
    }
  },
  {
    id: 'cassini-enceladus',
    target: 'enceladus',
    date: '2005-07-14T00:00:00Z',
    sourceName: 'NASA Cassini · Enceladus flyby',
    sourceUrl: 'https://science.nasa.gov/missions/cassini/enceladus-flyby-july-14-2005-1/',
    copy: {
      en: {
        title: 'Cassini · Enceladus at 175 km',
        eyebrow: '14 July 2005 · Enceladus',
        summary: 'Travel to the close Cassini flyby that brought the icy moon’s active south pole into focus.',
        precision: 'Enceladus stays in its calculated Saturn-system context; the Cassini approach itself is not reconstructed as an orbit line.'
      },
      tr: {
        title: 'Cassini · Enceladus’a 175 km',
        eyebrow: '14 Temmuz 2005 · Enceladus',
        summary: 'Buzlu uydunun etkin güney kutbunu odağa taşıyan yakın Cassini geçişine git.',
        precision: 'Enceladus hesaplanmış Satürn sistemi bağlamında kalır; Cassini yaklaşımı yörünge çizgisi olarak yeniden kurgulanmaz.'
      }
    }
  },
  {
    id: 'new-horizons-pluto',
    target: 'pluto',
    date: '2015-07-14T11:49:00Z',
    sourceName: 'NASA New Horizons',
    sourceUrl: 'https://science.nasa.gov/mission/new-horizons/',
    copy: {
      en: {
        title: 'New Horizons · Pluto flyby',
        eyebrow: '14 July 2015 · Pluto',
        summary: 'Set the exact recorded close-approach instant, then fly to the New Horizons global-mosaic world and its companion Charon.',
        precision: 'Pluto and Charon positions are calculated for the selected moment; the source spacecraft remains separately labelled as a current ephemeris object.'
      },
      tr: {
        title: 'New Horizons · Plüton geçişi',
        eyebrow: '14 Temmuz 2015 · Plüton',
        summary: 'Kaydedilmiş en yakın geçiş anını ayarla; ardından New Horizons küresel mozaik dünyasına ve yoldaşı Charon’a uç.',
        precision: 'Plüton ve Charon konumları seçili an için hesaplanır; kaynak uzay aracı ayrı olarak güncel efemeris nesnesi diye etiketlenir.'
      }
    }
  },
  {
    id: 'parker-corona',
    target: 'sun',
    date: '2021-04-28T00:00:00Z',
    sourceName: 'NASA Parker Solar Probe',
    sourceUrl: 'https://www.nasa.gov/solar-system/nasa-enters-the-solar-atmosphere-for-the-first-time-bringing-new-discoveries/',
    copy: {
      en: {
        title: 'Parker · inside the solar atmosphere',
        eyebrow: '28 April 2021 · Sun',
        summary: 'Return to the perihelion passage in which Parker measured the conditions marking its first entry into the solar atmosphere.',
        precision: 'The Sun and planetary illumination are time-correct; Parker’s displayed orbit is an explicitly documented present-era model.'
      },
      tr: {
        title: 'Parker · Güneş atmosferinin içinde',
        eyebrow: '28 Nisan 2021 · Güneş',
        summary: 'Parker’ın Güneş atmosferine ilk girişini işaretleyen koşulları ölçtüğü günberi geçişine dön.',
        precision: 'Güneş ve gezegen aydınlatması zamana uygundur; Parker’ın gösterilen yörüngesi açıkça belgelenmiş güncel dönem modelidir.'
      }
    }
  },
  {
    id: 'europa-clipper',
    target: 'europa',
    date: '2024-10-14T16:06:00Z',
    sourceName: 'NASA Europa Clipper',
    sourceUrl: 'https://science.nasa.gov/europa-clipper-homepage/',
    copy: {
      en: {
        title: 'Europa Clipper · departure',
        eyebrow: '14 October 2024 · Europa',
        summary: 'Set the departure moment of NASA’s dedicated Europa mission, then enter the moon’s real Jupiter-system geometry.',
        precision: 'The journey preserves the launch timestamp and body geometry; it does not claim to draw the mission cruise trajectory.'
      },
      tr: {
        title: 'Europa Clipper · ayrılış',
        eyebrow: '14 Ekim 2024 · Europa',
        summary: 'NASA’nın Europa’ya adanmış görevinin ayrılış anını ayarla; sonra uydunun gerçek Jüpiter-sistemi geometrisine gir.',
        precision: 'Yolculuk fırlatma zaman damgasını ve cisim geometrisini korur; görev seyir rotasını çizdiğini iddia etmez.'
      }
    }
  }
];
