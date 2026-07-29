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
    id: 'confirmed-exoplanets', chapter: 'worlds', evidence: 'planned', distance: 'Light-years',
    source: { label: 'NASA Exoplanet Catalog', url: 'https://science.nasa.gov/exoplanets/exoplanet-catalog/' },
    en: { title: 'Confirmed worlds', eyebrow: 'Next: live catalogue', summary: 'The next atlas chapter will make every confirmed archive record searchable.', detail: 'Phase two connects the atlas to NASA’s Exoplanet Archive. Until then, this card deliberately does not claim an offline list is current.', facts: ['NASA Archive data, not hand-maintained rows', 'Discovery method and source retained', 'Unknown values remain unknown'] },
    tr: { title: 'Doğrulanmış dünyalar', eyebrow: 'Sıradaki: canlı katalog', summary: 'Atlasın sonraki bölümü her doğrulanmış arşiv kaydını aranabilir hâle getirecek.', detail: 'Faz iki atlası NASA Exoplanet Archive’a bağlar. O zamana kadar bu kart çevrimdışı bir listenin güncel olduğunu iddia etmez.', facts: ['Elle güncellenen satırlar değil, NASA Arşiv verisi', 'Keşif yöntemi ve kaynak korunur', 'Bilinmeyen değerler bilinmeyen olarak kalır'] }
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
    id: 'nearby-galaxies', chapter: 'galaxies', evidence: 'planned', distance: 'Local Universe',
    source: { label: 'NASA Galaxies Gallery', url: 'https://science.nasa.gov/gallery/universe-galaxies/' },
    en: { title: 'The nearby universe', eyebrow: 'Next: curated deep sky', summary: 'Begin with a small, credited gallery before claiming to map everything.', detail: 'The first galaxy release should use named objects with a NASA image, distance context and source metadata—not an unbounded wall of thumbnails.', facts: ['Curated named objects', 'Image credits carried into detail view', 'Distance and redshift context follow later'] },
    tr: { title: 'Yakın evren', eyebrow: 'Sıradaki: kürasyonlu derin uzay', summary: 'Her şeyi haritaladığını iddia etmeden önce küçük ve kredili bir galeriyle başlayın.', detail: 'İlk galaksi sürümü, sınırsız küçük görsel duvarı yerine NASA görseli, uzaklık bağlamı ve kaynak metadatası olan adlandırılmış nesneler kullanmalı.', facts: ['Kürasyonlu adlandırılmış nesneler', 'Görsel kredileri detay görünümüne taşınır', 'Uzaklık ve kırmızıya kayma bağlamı sonraki fazda gelir'] }
  },
  {
    id: 'deep-sky-search', chapter: 'galaxies', evidence: 'planned', distance: 'Object search',
    source: { label: 'NASA/IPAC NED', url: 'https://ned.ipac.caltech.edu/Documents/Guides/Interface' },
    en: { title: 'Find a deep-sky object', eyebrow: 'Next: bounded search', summary: 'Search by a known name or position, with a source rather than a synthetic result.', detail: 'Phase four uses NASA/IPAC NED behind a server route with a small result limit and cache. It is an object lookup, not a promise to load the observable universe.', facts: ['Name and coordinate lookup', 'Server-side rate and result limits', 'No “all galaxies” claim'] },
    tr: { title: 'Bir derin uzay nesnesi bul', eyebrow: 'Sıradaki: sınırlı arama', summary: 'Bilinen ad veya konuma göre, sentetik sonuç yerine kaynaklı arama yapın.', detail: 'Faz dört NASA/IPAC NED’i küçük sonuç sınırı ve önbelleği olan bir sunucu rotası arkasında kullanır. Bu bir nesne bulma aracıdır; gözlemlenebilir evreni yükleme sözü değildir.', facts: ['Ad ve koordinat araması', 'Sunucu tarafında hız ve sonuç sınırları', '“Tüm galaksiler” iddiası yok'] }
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
