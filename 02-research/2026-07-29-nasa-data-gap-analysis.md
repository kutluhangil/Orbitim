# Orbitim — NASA/JPL veri boşluğu analizi

Tarih: 29 Temmuz 2026
Kapsam: Mevcut Orbitim kodu, canlı Vercel rotalarının durum kontrolü ve yalnızca birincil NASA/JPL/Earthdata dokümantasyonu.

## Kısa sonuç

Orbitim zaten yalnızca görsel süslemeye dayanmıyor: gezegen geometrisi, JPL küçük cisimleri, NASA gözlem kartları, uzay havası, doğrulanmış ötegezegenler ve derin-uzay nesne çözümleme katmanları var. En büyük fırsat yeni bir "API duvarı" kurmak değil; mevcut bilimsel sahneyi üç net katmanla derinleştirmek: **Güneş-Dünya etkisi**, **zamana bağlı Dünya gözlemleri** ve **doğrulanmış / aday ötegezegen ayrımı**.

`NASA_API_KEY` yalnızca DONKI rotasında kullanılıyor. Yeni NASA Open API özellikleri aynı anahtarı sunucu tarafında kullanabilir; Earthdata ve FIRMS ise ayrı erişim/anahtar kuralları gerektirir. Anahtar hiçbir zaman istemciye, URL'ye ya da kaynak haritasına yazılmamalıdır.

## Mevcut durum: gerçekten aldığımız veri

| Katman | Kaynak ve rota | Şu an alınan/verilen bilgi | Sınır |
| --- | --- | --- | --- |
| Uzay havası | NASA DONKI, `/api/space-weather` | Son 14 günün güneş parlamaları (FLR), koronal kütle atımları (CME), jeomanyetik fırtınaları (GST); kaynak alma zamanı | DONKI'nin SEP, IPS, HSS, RBE, MPC, bildirim ve WSA-Enlil ürünleri henüz alınmıyor. |
| Dünya gözlemi | NASA EPIC / NOAA DSCOVR, `/api/earth-observation` | En güncel doğal renkli tam-Dünya görseli, gerçek gözlem zamanı, başlık | Bu bir gözlem kartı; sahnenin Dünya dokusu diye sunulmuyor. |
| Güneş gözlemi | NASA SDO AIA 171 Å, `/api/solar-observation` | En güncel 171 Å görselinin varlığı ve yayın varlığı zamanı | Kod, görüntü varlığının `Last-Modified` zamanını gösteriyor; poz süresi gibi etiketlemiyor. Tek dalga boyu var. |
| Ötegezegenler | NASA Exoplanet Archive TAP, `/api/exoplanets` | `pscomppars` doğrulanmış katalog: ad, ev sahibi, keşif yöntemi/yılı, yarıçap-kütle, yörünge, sıcaklık, uzaklık, koordinat, tesis, yarı-büyük eksen, eksantriklik | Sadece doğrulanmış bileşik parametreler. Adaylar, zaman serileri, ışık eğrileri, belirsizlik sütunları ve sistem düzeyi karşılaştırmalar yok. |
| Derin uzay | NASA/IPAC NED, `/api/deep-sky` | Tek ada göre çözümleme: tür, J2000 koordinat, kırmızıya kayma, belirsizlik ve kaynak kaydı | Bir ad çözücü; gökyüzü kataloğu/galaksi haritası veya görüntü arşivi değil. |
| Gök mekaniği | JPL Horizons, `/api/horizons` | Voyager 1/2, New Horizons, Parker Solar Probe ve JWST için Güneş-merkezli durum vektörü | Tüm görevler/gezegenler için canlı Horizons katmanı yok; gezegenler zaten `astronomy-engine` ile hesaplanıyor. |
| Yakın geçiş | JPL CNEOS CAD, `/api/near-approaches` | Bir yıl içinde 0.05 AU içindeki ilk altı yaklaşım; mesafe, bağıl hız, çap | Genel NEO keşif akışı, risk tablosu ya da görsel zaman çizgisi yok. |
| Küçük cisim | JPL SBDB, `/api/small-body` | Ada göre fiziksel/yörüngesel parametreler ve Dünya yakınlaşma kayıtları | Arama odaklı; büyük popülasyon veya yörünge animasyonu yok. |
| Sabit bilimsel varlıklar | NASA Fact Sheet, NASA/USGS/JPL/PDS ürünleri, 3D Resources | Fiziksel sabitler, küresel mozaikler, seçili uydu 3D modelleri, Mars MOLA kabartması | Bunlar canlı API yanıtı değildir; kaynak/örtü ayrımı arayüzde açık olmalıdır. |
| Uydu takibi | CelesTrak + SGP4 | TLE ve yayılmış uydu konumu | NASA verisi değildir; NASA anahtarıyla ilişkisi yoktur. |

Canlı dağıtımda 29 Temmuz 2026'da `/api/space-weather`, `/api/earth-observation` ve `/api/solar-observation` HTTP 200 döndürdü. Bu yalnızca rota sağlık kontrolüdür; bilimsel ölçümün gecikmesiz olduğu anlamına gelmez.

## Şu an kullanılmayan, yüksek değerli NASA verileri

### P0 — bir sonraki ürün fazı

1. **DONKI etki zinciri**
   - Mevcut anahtarla SEP (enerjik parçacık), IPS (gezegenlerarası şok), HSS (yüksek hızlı akım), RBE (radyasyon kuşağı artışı), MPC (manyetopoz geçişi), bildirimler ve WSA-Enlil simülasyon özetleri alınabilir.
   - Arayüz: Güneş'ten Dünya'ya uzanan ince bir "etki zinciri"; her kart açıkça `gözlem / analiz / model` diye işaretlenir. WSA-Enlil bir tahmin/modeldir, gözlem değildir.
   - Neden ilk sırada: Yeni anahtar yoktur, mevcut `Now` modu ve Güneş görselleştirmesiyle doğrudan bağ kurar.

2. **Doğrulanmış ile aday ötegezegenlerin kesin ayrımı**
   - Exoplanet Archive TAP, TESS Project Candidates (`toi`) dahil birden çok tabloya programatik erişim sunar.
   - Arayüz: Mevcut katalog yalnızca `Confirmed` kalır; ikinci, turuncu bir `Candidates` sekmesi "not a planet yet" sözleşmesiyle açılır. Adaylar sahneye gezegen diye render edilmez, yalnızca araştırma listesi/filtre olarak görünür.
   - Neden ilk sırada: Explore fikrini büyütürken bilimsel doğruluğu korur; yeni API anahtarı gerektirmez.

3. **NASA Image and Video Library ile görev/araç galerisi**
   - `images-api.nasa.gov` arama, varlık, metadata, caption ve albüm uçlarını sunuyor; CORS destekli JSON dönüyor.
   - Arayüz: "How we saw it" Atlas bölümü; kullanıcı bir görev, araç, gözlem bandı veya hedef için kaynaklı sonuç açar. Her kayıtta NASA ID, kredi, medya türü ve orijinal sayfa saklanır.
   - Kural: Arama sonucundaki görsel, simülasyon yüzeyine otomatik doku yapılmaz. Gözlem kartı olarak kalır; telif/kredi alanı görünür olur.

4. **EONET ile Dünya'daki açık doğal olaylar**
   - EONET v3; açık/kapalı olayları, kategori, tarih, GeoJSON geometri ve bağlı WMS/WMTS katmanlarını veriyor.
   - Arayüz: Dünya yakındayken yalnızca kullanıcı istediğinde açılan "Open natural events" katmanı. Yangın, tropik fırtına, volkan ve şiddetli fırtına olayları tarih/kaynak/konumla listelenir; olay noktası gözlem değil, katalog geometrisi olarak etiketlenir.
   - Neden ilk sırada: `Earth now` deneyimini gerçek zamanlı ama sakin biçimde zenginleştirir; tüm gezegeni gürültüyle kaplamaz.

### P1 — kaliteli ikinci dalga

5. **Earthdata GIBS zaman seçicisi**
   - GIBS; WMTS, WMS, TWMS ve XYZ ile zaman boyutlu NASA Dünya gözlem katmanları yayımlar. "best", "std" ve "nrt" uçları ile katmanın ne tür ürün olduğu ayrılabilir.
   - Arayüz: Earth modalinde ayrı bir "Observation layer" modu: MODIS true color, aerosol, gece ışıkları veya yangın termal anomalisi gibi yalnızca 3–5 seçilmiş katman. Tarih seçici, katman kaynağı ve gerçek veri zamanı zorunlu.
   - Teknik sınır: GIBS köşe karoları doğrudan küresel doku yerine önce düz/harita önizlemesi olarak doğrulanmalı. Güncel tarih henüz işlenmemişse boş karo dönebileceği için "latest available" ve gerçek tarih gösterilmeli.

6. **FIRMS aktif yangın noktaları**
   - VIIRS/MODIS/Landsat algılamaları; konum, algılama tarihi/saati, araç, güven ve fire radiative power alanlarını verir. Ayrı ücretsiz `MAP_KEY` gerekir; dünya çapında ham sorgu on binlerce kayıt döndürebilir.
   - Arayüz: Dünya için yalnızca görünür kamera alanı veya seçili bounding box; 24 saat, 3 gün ve 7 gün seçenekleri. Noktalar "fire detection", asla kesin yangın sınırı olarak etiketlenmez.
   - Teknik sınır: Sunucu rotası, alan ve gün aralığı için zorunlu üst sınır koymalı; anahtar NASA anahtarından ayrı Vercel environment variable olmalı.

7. **PDS / OPUS yüzey kanıtı**
   - PDS, NASA gezegen görevlerinin uzun dönem arşividir. OPUS; Cassini, Galileo, New Horizons ve Voyager görüntü/spektrumlarını hedef, geometri ve aydınlatma koşuluyla aramaya imkân verir.
   - Arayüz: Bir uydu/gezegen dosyasında "Original mission frames" bölümü. Önce beş kürasyonlu hedef (Europa, Enceladus, Titan, Pluto, Io); sonra açık arama.
   - Kural: Kısmi örtü, küresel doku yerine geçmez. Her ürünün görev, araç, ürün kimliği, gözlem zamanı ve örtü uyarısı gösterilir.

8. **NED'i bağlam katmanına dönüştürme**
   - Mevcut tek-ad çözümlemesine mesafe birimi, kırmızıya-kayma referansı, eş adlar ve gözlem kaydı eklenebilir.
   - Arayüz: Galaxy kartında veri kalitesi/belirsizlik rozeti ve "source record" bağlantısı. "Tüm galaksileri çiz" iddiası yerine, aranan nesnenin güvenilir dosyası kalır.

### P2 — değerli fakat ana deneyimden sonra

9. **Earthdata CMR/STAC keşif katmanı**
   - CMR Search; koleksiyon, granül, değişken ve servis metadata'sını JSON/STAC dahil birçok formatta sorgulayabilir. CMR Service-Bridge alt-küme/OPeNDAP bağlantıları üretir; korumalı koleksiyonlar Earthdata Login tokenı isteyebilir.
   - Arayüz: Teknik kullanıcılara yönelik "Find NASA datasets" bölümü; veri katalog keşfi ve orijinal Earthdata bağlantısı. Ana sahneye ham NetCDF/GeoTIFF yükleme yapılmaz.
   - Neden P2: Çok güçlü fakat görsel üründen çok veri keşif aracıdır; giriş, kota ve büyük indirme deneyimi ister.

10. **APOD günlük editoryal kartı**
    - NASA Open APIs portalı APOD için tarih/aralık/sayım ve video küçük görseli sunuyor.
    - Arayüz: Landing veya Explore içinde tek günlük kart. Bilimsel sahnenin canlı telemetrisi gibi davranmaz.
    - Neden P2: Güzel bir günlük ritim sağlar fakat simülasyon doğruluğunu artırmaz.

11. **Bilim yayınları (NASA ADS) — ancak ayrı erişimle**
    - Görev/nesne dosyalarına makale bağlantısı fikri iyi olsa da ADS, NASA Open API anahtarından farklı bir kimlik ve akademik arama UX'i gerektirir.
    - Karar: Explore kitabı oturduktan sonra eklenmeli; ilk veri fazına alınmamalı.

## Bilinçli olarak eklenmemesi gerekenler

| Kaynak/fikir | Karar | Gerekçe |
| --- | --- | --- |
| NASA Earth API | Ekleme | NASA Open APIs portalı bu uçun arşivlendiğini ve GIBS ile değiştirildiğini belirtiyor. |
| NASA Mars Rover API | Ekleme | Portal bu API'nin de arşivlendiğini belirtiyor. Mars için PDS/Mars mission archive daha sağlam yoldur. |
| NeoWs | Şimdilik ekleme | Yakın Dünya asteroitleri için JPL CNEOS CAD + SBDB zaten daha ayrıntılı ve Orbitim'de mevcut. Aynı veriyi ikinci bir API ile çoğaltmak yalnızca çelişki riski doğurur. |
| Ham FIRMS dünya sorgusu | Ekleme | Dünya çapı tek günlük VIIRS sorgusu on binlerce algılama döndürebilir; kamera/bounding-box sınırı olmadan WebGL ve API kotasını bozar. |
| GIBS karolarını otomatik gezegen dokusu yapmak | Ekleme | Kartografik projeksiyon, zaman, eksik gün ve atmosfer/kenar artefaktı doğrulanmadan küresel yüzeye bindirmek bilimsel olarak yanıltıcı olur. |
| Bir model çıktısını gözlem gibi göstermek | Ekleme | DONKI WSA-Enlil tahmin/model ürünüdür; `observed`, `analysed` ve `modelled` ayrımı korunmalı. |

## Önerilen uygulama sırası

1. **Faz A — Solar impact:** DONKI genişletme, veri türü rozetleri, bir "Earth impact" zaman çizgisi.
2. **Faz B — Earth now:** EONET açık olayları, sonra seçili GIBS gözlem katmanları.
3. **Faz C — Explore evidence:** NASA Image Library görev galerisi ve TESS adayları için ayrı, doğrulama-dışı bölüm.
4. **Faz D — Planetary archive:** PDS/OPUS beş kürasyonlu görev görüntüsüyle başlayıp ölçülü aramaya geçiş.
5. **Faz E — Expert discovery:** CMR/STAC ve isteğe bağlı NASA ADS.

Her faz için ortak teknik sözleşme:

- Sunucu tarafında daraltılmış istek parametreleri, açık üst sınırlar ve zaman damgalı önbellek.
- Her veri kartında `observed`, `derived`, `analysed`, `modelled` veya `catalogued` türü.
- Kaynak URL'si, sağlayıcı, gözlem/veri zamanı ve mümkünse ürün kimliği.
- İstemciye asla anahtar geçmemesi; `NASA_API_KEY`, `FIRMS_MAP_KEY` ve olası Earthdata tokenlarının ayrı environment variable olması.
- Harita/veri katmanlarının görünürlük anahtarıyla kapatılabilmesi; varsayılan sahne sakin ve performanslı kalmalı.

## Kaynaklar

- [NASA Open APIs](https://api.nasa.gov/) — API anahtarı, kota, APOD, NeoWs ve arşivlenmiş Earth/Mars Rover API notları.
- [NASA DONKI](https://api.nasa.gov/) — mevcut ve eklenebilecek uzay hava durumu uçları.
- [NASA Exoplanet Archive TAP](https://exoplanetarchive.ipac.caltech.edu/docs/TAP/usingTAP.html) — `pscomppars` ve `toi` dahil tablo erişimi.
- [NASA Image and Video Library API](https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf) — arama, varlık, metadata, caption ve albüm uçları.
- [EONET v3 API](https://eonet.gsfc.nasa.gov/docs/v3) — doğal olaylar, GeoJSON ve katman metadatası.
- [NASA GIBS Access Basics](https://nasa-gibs.github.io/gibs-api-docs/access-basics/) — zaman boyutlu WMTS/WMS/TWMS/XYZ erişimi.
- [NASA FIRMS Area API](https://firms.modaps.eosdis.nasa.gov/api/area/) — aktif yangın algılamaları, kota ve MAP_KEY gereksinimi.
- [NASA Earthdata CMR Search](https://cmr.earthdata.nasa.gov/search/site/docs/search/api.html) — koleksiyon/granül/STAC metadata araması.
- [NASA Planetary Data System](https://pds.nasa.gov/) ve [PDS Search API](https://pds.nasa.gov/services/search/index.jsp) — görev arşivleri ve programatik ürün keşfi.
