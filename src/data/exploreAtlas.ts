import type { AppLanguage } from '../ui/i18n';

export type AtlasChapter = 'system' | 'worlds' | 'galaxies' | 'evidence';
export type AtlasEvidence = 'observed' | 'derived' | 'planned';

interface AtlasText {
  title: string;
  eyebrow: string;
  summary: string;
  detail: string;
  facts: readonly string[];
}

export interface AtlasEntry {
  id: string;
  chapter: AtlasChapter;
  evidence: AtlasEvidence;
  distance: string;
  source: { label: string; url: string };
  en: AtlasText;
  tr: AtlasText;
}

/**
 * Phase-one entries are editorial, not a pretend database. Each chapter has a
 * primary source; later archive phases replace the planned cards with live,
 * versioned data rather than claiming an offline list is current.
 */
export const ATLAS_ENTRIES: readonly AtlasEntry[] = [
  {
    id: 'system-now', chapter: 'system', evidence: 'derived', distance: '0–40 AU',
    source: { label: 'NASA Solar System Exploration', url: 'https://science.nasa.gov/solar-system/' },
    en: { title: 'The system, now', eyebrow: 'A moving neighbourhood', summary: 'Start with the place whose geometry changes while you watch.', detail: 'Orbitim keeps the local system separate from the atlas: its bodies are placed from the simulation clock, not arranged as a static diagram.', facts: ['Live ephemeris scene', 'Visual distance compression is labelled', 'Return here whenever a chapter needs a home'] },
    tr: { title: 'Sistem, şu an', eyebrow: 'Hareket eden bir mahalle', summary: 'İzlerken geometrisi değişen yerden başlayın.', detail: 'Orbitim yerel sistemi atlasın geri kalanından ayrı tutar: gök cisimleri durağan bir şemaya değil, simülasyon saatine göre yerleşir.', facts: ['Canlı efemeris sahnesi', 'Görsel uzaklık sıkıştırması açıkça etiketlenir', 'Bölümler için her zaman dönülecek başlangıç noktası'] }
  },
  {
    id: 'sun', chapter: 'system', evidence: 'observed', distance: '8.3 light-min',
    source: { label: 'NASA Sun', url: 'https://science.nasa.gov/sun/' },
    en: { title: 'Our star', eyebrow: 'The light source', summary: 'Every illuminated surface in the scene begins with the Sun.', detail: 'This chapter links visible lighting to a physical source. It does not turn simulated texture detail into a solar observation.', facts: ['Solar illumination has a stated geometry', 'Observed solar cards stay separate from the render', 'Time is shown in UTC'] },
    tr: { title: 'Yıldızımız', eyebrow: 'Işığın kaynağı', summary: 'Sahnede aydınlanan her yüzey Güneş ile başlar.', detail: 'Bu bölüm görünen aydınlatmayı fiziksel bir kaynağa bağlar. Simüle edilmiş doku detayını Güneş gözlemi gibi sunmaz.', facts: ['Güneş aydınlatmasının geometrisi belirtilir', 'Gözlemlenmiş Güneş kartları renderdan ayrıdır', 'Zaman UTC olarak gösterilir'] }
  },
  {
    id: 'earth', chapter: 'system', evidence: 'observed', distance: '1 AU',
    source: { label: 'NASA Earth', url: 'https://science.nasa.gov/earth/' },
    en: { title: 'A living reference', eyebrow: 'Earth and its atmosphere', summary: 'The one world where a rendered globe can meet continual observation.', detail: 'Earth is the reference scale for comparisons, but observation products and the scene’s animated cloud shell remain visibly distinct layers.', facts: ['Independent cloud layer', 'Observation timestamps are retained', 'Earth-scale comparisons begin here'] },
    tr: { title: 'Yaşayan referans', eyebrow: 'Dünya ve atmosferi', summary: 'Render edilmiş kürenin sürekli gözlemle buluşabildiği tek dünya.', detail: 'Dünya karşılaştırmaların referans ölçeğidir; ancak gözlem ürünleri ile sahnenin hareketli bulut kabuğu görünür biçimde ayrı katmanlar olarak kalır.', facts: ['Bağımsız bulut katmanı', 'Gözlem zaman damgaları korunur', 'Dünya ölçeğindeki karşılaştırmalar burada başlar'] }
  },
  {
    id: 'mars', chapter: 'system', evidence: 'observed', distance: 'Variable',
    source: { label: 'NASA Mars', url: 'https://science.nasa.gov/mars/' },
    en: { title: 'A measured surface', eyebrow: 'Mars at close range', summary: 'A world where missions, terrain and landing sites share one context.', detail: 'Mission markers lead to their own reading cards so the globe stays navigable. Surface relief is called out as measured terrain, not invented detail.', facts: ['Mission markers open local reading cards', 'MOLA terrain source is named in Scientific mode', 'No far-side site is implied to be visible'] },
    tr: { title: 'Ölçülmüş bir yüzey', eyebrow: 'Yakından Mars', summary: 'Görevlerin, arazinin ve iniş noktalarının tek bağlamda buluştuğu dünya.', detail: 'Görev işaretleri, kürenin gezilebilir kalması için kendi okuma kartlarına açılır. Yüzey rölyefi uydurma detay olarak değil, ölçülmüş arazi olarak belirtilir.', facts: ['Görev işaretleri yerel okuma kartları açar', 'Bilimsel modda MOLA arazi kaynağı belirtilir', 'Uzak yüzdeki bir noktanın görünür olduğu ima edilmez'] }
  },
  {
    id: 'small-body-search', chapter: 'system', evidence: 'observed', distance: 'Object search',
    source: { label: 'JPL Small-Body Database', url: 'https://ssd-api.jpl.nasa.gov/doc/sbdb.html' },
    en: { title: 'Small-body intelligence', eyebrow: 'Live, bounded search', summary: 'Read a known asteroid or comet record without turning the scene into an unbounded point cloud.', detail: 'The JPL Small-Body Database is requested through a bounded server route. It reports orbit, physical fields and supplied Earth approach records as data, not as a visibility or impact forecast.', facts: ['One named body at a time', 'JPL source timestamp retained', 'No fake all-asteroid render'] },
    tr: { title: 'Küçük cisim zekâsı', eyebrow: 'Canlı, sınırlı arama', summary: 'Sahneyi sınırsız nokta bulutuna çevirmeden bilinen bir asteroit veya kuyrukluyıldız kaydını okuyun.', detail: 'JPL Küçük Cisim Veritabanı, sınırlandırılmış sunucu rotası üzerinden istenir. Yörüngeyi, fiziksel alanları ve sağlanan Dünya yaklaşım kayıtlarını görünürlük ya da çarpışma tahmini olarak değil, veri olarak verir.', facts: ['Her seferinde bir adlandırılmış cisim', 'JPL kaynak zaman damgası korunur', 'Sahte tüm-asteroit renderı yok'] }
  },
  {
    id: 'confirmed-exoplanets', chapter: 'worlds', evidence: 'observed', distance: 'Light-years',
    source: { label: 'NASA Exoplanet Catalog', url: 'https://science.nasa.gov/exoplanets/exoplanet-catalog/' },
    en: { title: 'Confirmed worlds', eyebrow: 'Live archive', summary: 'Search confirmed NASA Exoplanet Archive records without mistaking missing measurements for estimates.', detail: 'The catalogue is fetched from NASA’s Exoplanet Archive as a time-stamped server snapshot. Search, filters and pagination use that one named source; missing archive values remain unreported.', facts: ['NASA Archive data, not hand-maintained rows', 'All published discovery methods retained', 'Unknown values remain unknown'] },
    tr: { title: 'Doğrulanmış dünyalar', eyebrow: 'Canlı arşiv', summary: 'Eksik ölçümleri tahmin sanmadan doğrulanmış NASA Exoplanet Archive kayıtlarında arayın.', detail: 'Katalog, NASA Exoplanet Archive’dan zaman damgalı bir sunucu anlık görüntüsü olarak alınır. Arama, filtreler ve sayfalama bu tek adlandırılmış kaynağı kullanır; eksik arşiv değerleri bildirilmemiş olarak kalır.', facts: ['Elle güncellenen satırlar değil, NASA Arşiv verisi', 'Yayınlanmış tüm keşif yöntemleri korunur', 'Bilinmeyen değerler bilinmeyen olarak kalır'] }
  },
  {
    id: 'other-suns', chapter: 'worlds', evidence: 'planned', distance: '4.24 ly+',
    source: { label: 'NASA Exoplanets', url: 'https://science.nasa.gov/exoplanets/' },
    en: { title: 'Other suns', eyebrow: 'Host stars', summary: 'A planet makes sense only with the star that warms and tugs it.', detail: 'System pages will begin with the host star, then show orbital measurements and discovery evidence before any interpretive planet render.', facts: ['Star-first system structure', 'Measurements before artwork', 'Distances shown in light-years, not AU'] },
    tr: { title: 'Başka güneşler', eyebrow: 'Ev sahibi yıldızlar', summary: 'Bir gezegen ancak onu ısıtan ve çeken yıldızla birlikte anlamlıdır.', detail: 'Sistem sayfaları ev sahibi yıldızla başlayacak; yorumlayıcı bir gezegen renderından önce yörünge ölçümlerini ve keşif kanıtlarını gösterecek.', facts: ['Yıldız merkezli sistem yapısı', 'Sanat eserinden önce ölçümler', 'Uzaklıklar AU değil ışık yılıyla gösterilir'] }
  },
  {
    id: 'habitable-zone', chapter: 'worlds', evidence: 'derived', distance: 'System-relative',
    source: { label: 'NASA Habitable Zone', url: 'https://science.nasa.gov/exoplanets/habitable-zone/' },
    en: { title: 'The habitable zone', eyebrow: 'A useful boundary, not a promise', summary: 'A first filter for where liquid surface water could be possible.', detail: 'The atlas will show this as an orbital calculation around a star, never as proof of an ocean, biology or an Earth-like surface.', facts: ['System-relative calculation', 'Not evidence of life', 'Planet and star uncertainties stay visible'] },
    tr: { title: 'Yaşanabilir bölge', eyebrow: 'Yararlı bir sınır, vaat değil', summary: 'Sıvı yüzey suyunun mümkün olabileceği yer için ilk filtre.', detail: 'Atlas bunu bir yıldız etrafındaki yörünge hesabı olarak gösterecek; asla okyanus, yaşam ya da Dünya benzeri yüzey kanıtı olarak değil.', facts: ['Sisteme göre hesaplanır', 'Yaşam kanıtı değildir', 'Gezegen ve yıldız belirsizlikleri görünür kalır'] }
  },
  {
    id: 'galaxy-kinds', chapter: 'galaxies', evidence: 'observed', distance: 'Thousands–billions ly',
    source: { label: 'NASA Galaxy Types', url: 'https://science.nasa.gov/universe/galaxies/types/' },
    en: { title: 'Galaxy kinds', eyebrow: 'Shapes carry history', summary: 'Spiral, elliptical, lenticular, irregular and active are observations—not decoration.', detail: 'The deep-sky chapter begins with classifications that help a visitor read what a galaxy image can, and cannot, tell them.', facts: ['Observed morphology', 'Classification is not a complete origin story', 'Images retain mission and credit'] },
    tr: { title: 'Galaksi türleri', eyebrow: 'Biçimler tarih taşır', summary: 'Sarmal, eliptik, merceksi, düzensiz ve aktif türler süsleme değil, gözlemdir.', detail: 'Derin uzay bölümü, ziyaretçinin bir galaksi görüntüsünün ne söyleyip ne söyleyemeyeceğini okumasına yardım eden sınıflandırmalarla başlar.', facts: ['Gözlemlenmiş morfoloji', 'Sınıflandırma tam bir köken hikâyesi değildir', 'Görüntüler görev ve kredi bilgisini korur'] }
  },
  {
    id: 'nearby-galaxies', chapter: 'galaxies', evidence: 'observed', distance: 'Local Universe',
    source: { label: 'NASA Galaxies Gallery', url: 'https://science.nasa.gov/gallery/universe-galaxies/' },
    en: { title: 'The nearby universe', eyebrow: 'Curated deep sky', summary: 'Read a small, credited gallery before pretending to map everything.', detail: 'This first galaxy release uses named objects with a NASA image, distance context and both science and image-record links—not an unbounded wall of thumbnails.', facts: ['Curated named objects', 'Every thumbnail names its image credit', 'Distance and redshift lookup follow later'] },
    tr: { title: 'Yakın evren', eyebrow: 'Kürasyonlu derin uzay', summary: 'Her şeyi haritaladığını iddia etmeden önce küçük ve kredili bir galeriyi okuyun.', detail: 'Bu ilk galaksi sürümü, sınırsız küçük görsel duvarı yerine NASA görseli, uzaklık bağlamı ile bilim ve görsel-kayıt bağlantıları olan adlandırılmış nesneler kullanır.', facts: ['Kürasyonlu adlandırılmış nesneler', 'Her küçük görsel, görüntü kredisini belirtir', 'Uzaklık ve kırmızıya kayma araması sonraki fazda gelir'] }
  },
  {
    id: 'deep-sky-search', chapter: 'galaxies', evidence: 'observed', distance: 'Object search',
    source: { label: 'NASA/IPAC NED API', url: 'https://ned.ipac.caltech.edu/Docs::API/' },
    en: { title: 'Find a deep-sky object', eyebrow: 'Live, bounded search', summary: 'Resolve a known object name with a source rather than a synthetic result.', detail: 'The current NASA/IPAC NED API runs behind a server route with one-name queries and a small cache. It is an object resolver, not a promise to load the observable universe.', facts: ['Name-based object lookup', 'Current NED API and source timestamp', 'No “all galaxies” claim'] },
    tr: { title: 'Bir derin uzay nesnesi bul', eyebrow: 'Canlı, sınırlı arama', summary: 'Bilinen bir nesne adını sentetik sonuç yerine kaynakla çözümleyin.', detail: 'Güncel NASA/IPAC NED API, tek ad sorguları ve küçük önbelleği olan bir sunucu rotası arkasında çalışır. Bu bir nesne çözücüsüdür; gözlemlenebilir evreni yükleme sözü değildir.', facts: ['Ada dayalı nesne araması', 'Güncel NED API ve kaynak zaman damgası', '“Tüm galaksiler” iddiası yok'] }
  },
  {
    id: 'mission-eyes', chapter: 'evidence', evidence: 'observed', distance: 'Across missions',
    source: { label: 'NASA Image and Video Library', url: 'https://images.nasa.gov/' },
    en: { title: 'How we saw it', eyebrow: 'Missions and instruments', summary: 'A beautiful image is stronger when you can name the instrument behind it.', detail: 'Every future gallery entry should identify its mission, observing band, capture or publication date, credit and original NASA page.', facts: ['Mission and instrument', 'Observed band and timestamp', 'Direct original source'] },
    tr: { title: 'Onu nasıl gördük', eyebrow: 'Görevler ve araçlar', summary: 'Güzel bir görüntü, arkasındaki aracı adlandırabildiğinizde daha güçlü olur.', detail: 'Gelecekteki her galeri kaydı görevini, gözlem bandını, çekim veya yayın tarihini, kredisini ve orijinal NASA sayfasını belirtmeli.', facts: ['Görev ve araç', 'Gözlem bandı ve zaman damgası', 'Doğrudan orijinal kaynak'] }
  },
  {
    id: 'evidence-first', chapter: 'evidence', evidence: 'derived', distance: 'Every scale',
    source: { label: 'NASA Media Usage Guidelines', url: 'https://www.nasa.gov/nasa-brand-center/images-and-media/' },
    en: { title: 'Read the evidence', eyebrow: 'The atlas contract', summary: 'Every card says whether you are seeing an observation, a calculation or a forthcoming archive connection.', detail: 'That distinction is a product feature. It prevents a visitor from mistaking an artist’s concept or a simulation layer for a telescope photograph.', facts: ['Observed, derived and planned labels', 'Source links on every chapter', 'Credits travel with NASA media'] },
    tr: { title: 'Kanıtı okuyun', eyebrow: 'Atlas sözleşmesi', summary: 'Her kart bir gözlem, hesaplama ya da gelecek arşiv bağlantısı görüp görmediğinizi söyler.', detail: 'Bu ayrım bir ürün özelliğidir. Ziyaretçinin sanatçı konseptini veya simülasyon katmanını teleskop fotoğrafı sanmasını engeller.', facts: ['Gözlem, hesaplama ve planlanan etiketleri', 'Her bölümde kaynak bağlantısı', 'NASA görselleriyle birlikte taşınan krediler'] }
  }
];

export function atlasText(entry: AtlasEntry, language: AppLanguage): AtlasText {
  return entry[language];
}
