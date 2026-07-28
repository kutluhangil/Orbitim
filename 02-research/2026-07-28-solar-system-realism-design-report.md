# Orbitim — Gerçekçilik ve Tasarım Araştırma Raporu

**Tarih:** 28 Temmuz 2026
**Kapsam:** Mevcut React Three Fiber sahnesinin kod incelemesi ile NASA/JPL/IAU birincil kaynak araştırması. Bu rapor öneridir; kod değişikliği içermez.

## Kısa sonuç

Orbitim'in doğru yönü, daha fazla dekoratif efekt eklemek değil, her görsel katmanı kendi veri türüne bağlayan **bilimsel ama sinematik** bir uzay arayüzü kurmaktır. En büyük farkı yaratacak iş, Güneş kaynaklı aydınlatmayı tek bir fiziksel modele toplamak; gezegenlerin gece tarafını, atmosferik alacakaranlığını, tutulmaları ve halka gölgelerini bu modelden üretmektir. İkinci büyük kazanım, Dünya ve Güneş için "canlı" kelimesini açıkça zaman damgası olan gözlem verisine bağlamaktır.

## Mevcut durum: güçlü temel, görünürlük açığı

Kod tabanı incelendiğinde aşağıdaki altyapıların zaten bulunduğu görüldü:

| Alan | Mevcut temel | Gerçekçilik açığı |
| --- | --- | --- |
| Güneş ışığı | Güneş orijinde `pointLight`; karanlık temada düşük ambient fill | Logaritmik mesafe ölçeği nedeniyle ışık şiddeti fiziksel olarak bire bir değil; ambient fill terminatör kontrastını yumuşatıyor. |
| Gün/gece | `meshStandardMaterial` ile Güneş'e bakan yüz aydınlık, karşı yüz karanlık; Dünya şehir ışıkları geceye maskeli | Ayırt edici bir "bilimsel ışık" modu ve görünür faz/terminatör okuması yok. |
| Gölgeler | Ay/gezegen tutulmaları, Dünya bulut gölgesi, Satürn halka gölgesi; Uranüs'te uydurma geniş halka gölgesi engellenmiş | Tutulma hesabı sahne ölçeğiyle yapıldığı için olayların sıklığı ve gölge boyutu astronomik olarak doğru değildir. |
| Atmosfer | Dünya, Venüs, Mars ve dev gezegenlerde limb/aerial perspektif katmanı | Gece tarafı airglow, alacakaranlık renk geçişi ve gezegen bazlı optik derinlik katmanı yok. |
| Dünya | Ayrı, dönen, yüzeyden yükseltilmiş bulut kabuğu ve bulut gölgesi | Bulut yoğunluğu dokusu canlı gözlem değil; gözlem tarihi ekranda görünmüyor. |
| Güneş | Kaynayan fotosfer shader'ı, prominence ve korona | Animasyon ikna edici olsa da `Now` görünümünde SDO gözlemiyle eşleşmiyor. |
| Konum | `astronomy-engine`, JPL Horizons, CelesTrak ve JPL küçük cisim verileri | Görsel ölçek navigasyon için sıkıştırılmış; bu doğru biçimde kullanıcıya daha görünür anlatılmalı. |

Bu nedenle "gölgelendirme hiç yok" teşhisi teknik olarak doğru değil: altyapı var. Ürün açısından doğru teşhis şudur: **gölgelendirme tek bir net sistem gibi okunmuyor ve fiziksel uzayla sahne ölçeği arasındaki fark görünür biçimde yönetilmiyor.**

## Araştırmadan çıkan ilkeler

1. JPL Horizons; gözlem, vektör ve eleman efemerislerini; geometrik, ışık-zamanı düzeltilmiş ve yıldız sapması düzeltilmiş vektör seçeneklerini sunuyor. Bu, "gezegen nerede?" ve "gözlemci onu ne zaman görüyor?" görünümlerinin ayrı modellenebileceği anlamına gelir. [JPL Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html)
2. JPL NAIF SPICE araçları; faz, geliş ve çıkış açıları ile kısmi/tam örtülme durumlarını ayrı geometrik kavramlar olarak ele alıyor. Bu, Güneş ışığı, tutulma ve görüş alanını tek bir `Solar Illumination` katmanında birleştirmek için doğru referans modeldir. [NAIF Geometry Finder](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/req/gf.html)
3. IAU'nun çalışma grubu, gezegen ve uyduların dönme elemanları ile kartografik koordinatları için güncel önerileri tanımlıyor. Yüzeydeki iniş noktaları ve dokuların meridyen hizası bu çerçeveye göre doğrulanmalıdır. [IAU WGCCRE](https://iau.org/WG100/WG100/Home.aspx)
4. NASA EPIC; DSCOVR/L1 konumundan günlük tam-Dünya doğal renk, geliştirilmiş renk ve bulut ürünü metadatasını yayımlar. Bu, "canlı Dünya" için gerçek bir gözlem kaynağıdır; fakat küresel equirectangular yüzey dokusu değildir. [NASA EPIC API](https://epic.gsfc.nasa.gov/about/api)
5. NASA GIBS/Worldview, tarih seçilebilir küresel görüntü katmanlarını servis eder. EPIC'in aksine Dünya küresine kaplanabilecek günlük bir harita katmanı için daha uygun adaydır; veri yaşı her zaman gösterilmelidir. [NASA Worldview Snapshots](https://wvs.earthdata.nasa.gov/)
6. SDO; Güneş'in fotosferini HMI ile, atmosferini ise çoklu AIA dalga boylarıyla gözlüyor; yakın-gerçek-zamanlı tarama görüntüleri yaklaşık 15 dakikalık aralıklarla yayımlanıyor. "Şu anki Güneş" modu bu kaynakla kurulabilir. [NASA SDO veri erişimi](https://sdo.gsfc.nasa.gov/data/dataaccess.php)
7. MOLA küresel topografya verisi, Mars'ın topoğrafyasını doğrudan lazer altimetresi ölçümlerinden türetir. Mars yaklaşımında gerçek yükseklik alanı ve eğime bağlı ışık kullanmak, tek bir renk dokusundan çok daha inandırıcı olur. [NASA PDS MOLA](https://pds.nasa.gov/ds-view/pds/viewDataset.jsp?dsid=MGS-M-MOLA-5-IEGDR-L3-V1.0)
8. NASA Eyes, tarayıcıda gerçek görev verisi/konumları, zaman yolculuğu ve görev anlatılarıyla çalışan en yakın ürün referansıdır. Orbitim'in kopyası değil, doğruluk + keşif dengesine dair benchmark'ıdır. [NASA Eyes](https://science.nasa.gov/eyes/)

## En yüksek öncelik: Güneş, ışık ve gölge sistemi

### 1. Tek bir Solar Illumination modeli

**Öneri:** `SolarSystem.tsx` içindeki doğrudan ışık, `surfaceShading.ts` içindeki özel gölgeler ve atmosfer shader'ları tek bir veri sözleşmesine bağlanmalı. Bu model her gövde için şu değerleri üretmeli:

- gerçek (sıkıştırılmamış) efemeris uzayında Güneş yönü ve uzaklığı;
- yerel güneş yüksekliği, terminatör ve faz açısı;
- tam/kısmi örtülme oranı ve penumbra yumuşaklığı;
- halka geçirgenliği ve bulut gölgesi;
- gözlemciye göre görünür aydınlık kesir.

**Neden:** Mevcut `pointLight` görsel bir genel ışık sağlıyor; fakat olay geometrisini yöneten shader ayrı çalışıyor. JPL'nin ayrıştırdığı illumination/occultation kavramları, uygulamada da ayrı ama aynı kaynaktan beslenmelidir.

**Kritik karar:** Genel amaçlı Three.js shadow map kullanılmamalı. Gezegenler arası ölçek, çok büyük near/far aralığı ve logaritmik navigasyon ölçeği gölge haritalarını kararsız/yanıltıcı yapar. Bunun yerine mevcut analitik disk-örtülme yaklaşımı gerçek kilometre/AU koordinatlarında hesaplanmalı; sonuç shader uniformu olarak aktarılmalı.

### 2. Gece tarafını gerçekten gece yapma

- Karanlık temadaki ambient fill `0.08` yerine fotoğrafik referansla çok daha düşük tutulmalı; kullanıcının tamamen siyah disk görmemesi için genel ambient yerine düşük seviyeli yıldız ışığı/gezegen yansıması gibi kontrollü bir fill kullanılmalı.
- Dünya'da şehir ışıkları, terminatörün arkasında aşamalı görünmeli; mavi hourglass/alacakaranlık bandı yalnız atmosferi olan cisimlerde görünmeli.
- Venüs'te yüzey değil kalın bulut üstü aydınlanması; Mars'ta ince mavi-pembe limb; Titan'da sıcak turuncu pus; Neptün/Uranüs'te soğuk limb profilleri kullanılmalı.
- Kullanıcı tercihine bağlı `Scientific contrast` anahtarı eklenmeli. Normal mod estetik olarak okunur, bu mod ambient'i düşürür ve gölgeleri belirginleştirir.

### 3. Görülebilir olay modu

Tutulma, transit, opposition ve conjunction için yalnız panel metni değil, zaman çizgisinde bir "olay penceresi" olmalı. Kullanıcı bir olaya tıklayınca kamera en iyi açıyı seçmeli; sağ panel şu üç etiketi göstermeli: **geometrik durum**, **veri kaynağı**, **simülasyon zamanı**.

> Dürüstlük notu: mevcut sahnede gövde/mesafe ölçekleri bilinçli olarak sıkıştırılmıştır. Böyle bir modda olayın yönü ve sırası doğru, ekrandaki gölge çapı ise ancak gerçek koordinatlar kullanılırsa bilimsel olarak doğru kabul edilmelidir.

## "Canlı" kelimesini gerçek veriye bağlama

### Dünya: iki farklı gerçeklik modu

| Mod | Ne gösterir | Doğru kaynak ve kural |
| --- | --- | --- |
| **Simulation Earth** | Seçilen geçmiş/gelecek zamana göre doğru eksen, aydınlık yüz, şehir ışıkları ve dönen bulut kabuğu | Sabit tarihli iklimsel doku; "gözlem değil" etiketi. Gelecekte gerçek bulut iddiası kesinlikle yapılmaz. |
| **Earth Now** | Son mevcut uydu görüntüsü, bulut ve doğal renk | EPIC veya GIBS. Kartta görüntü saati/ürün zamanı ve gecikme gösterilir. Simülasyon saati `Now` değilse, görüntü küreye zorla sarılmaz. |

EPIC tam disk kameradır; ham EPIC görüntüsünü sanki dünya küresinin tamamının anlık equirectangular dokusuymuş gibi kaplamak yanlış olur. EPIC'i Dünya yaklaşımında "Latest DSCOVR observation" adlı yönü/saati bilinen fotoğraf kartı veya kamera-projeksiyon katmanı olarak göstermek doğrudur. GIBS/Worldview ise günlük küresel yüzey/bulut katmanı için daha uygundur.

### Güneş: `Solar Surface` ve `Solar Now`

- **Solar Surface:** Bugünkü kaliteli, sürekli shader; zaman çizelgesinin her tarihinde çalışır ve "procedural visualization" olarak etiketlenir.
- **Solar Now:** SDO HMI continuum görüntüsü + AIA 171/193 isteğe bağlı false-color corona katmanı; en son veri saati, dalga boyu ve gecikme panelde görünür.
- DONKI entegrasyonu yalnız son flare/CME/GST ile sınırlı kalmamalı; SEP, IPS, HSS ve WSA-ENLIL yayılım ürünleri de olay şeridine bağlanmalı. DONKI bu uç noktaları resmi olarak sunuyor. [NASA DONKI API](https://api.nasa.gov/)

Bu ayrım, Güneş'i hem canlı hem dürüst yapar: shader "Güneş gibi davranır", gözlem modu ise "o andaki Güneş'i gösterir".

## Yüzey, atmosfer ve halka kalitesi

### Yüzey LOD yol haritası

1. **Ay ve Mars:** gerçek DEM/height map ile parallax/normal map; yaklaşımda güneş açısına göre kraterlerin gölge yönü değişir. Mars için MOLA öncelikli kaynak olmalıdır.
2. **Merkür, Ceres, Vesta:** krater yoğunluğu ve mikro-roughness; sadece kontrastı artırılmış albedo ile yetinilmemeli.
3. **Io/Europa/Enceladus:** her biri kendi jeolojisine özgü normal/height işlemesi; Io'da emisyonlu volkanik sıcak noktalar sadece uygun veri/etiketle, Europa'da çatlaklar ve Enceladus'ta kutup plume'ları.
4. **Gaz devleri:** yüzey gibi dönmeyen, enleme göre farklı hızlarda kayan bulut bantları; Jüpiter/Neptün için gözlemden türetilmiş büyük sistemler, tahmin edici "hava durumu" iddiası olmadan.
5. **Halkalar:** Satürn için Cassini Division, B/A/C bandı, back-scattering ve gezegen gölgesi; Uranüs için yalnız gözlenmiş ince halka dizisi. Halka görünürlüğü kamera ve Güneş fazına bağlı olmalı.

### Atmosferden beklenenler

- Fiziksel yoğunluk simülasyonu yerine katmanlı, gezegen bazlı optik profil: Rayleigh rengi, Mie pus, limb parlaklığı, gece airglow.
- Güneşin tam arkasında kalan ince atmosferlerde forward scattering; Dünya'da mavi halo, Titan'da turuncu halo.
- Bulutlar için ayrı derinlik yazımı, kendi terminatörü ve yüzeye düşen güneş yönlü gölge. Dünya için bu temel zaten mevcut; canlı veri katmanı sonradan eklenebilir.

## Yaşayan uzay: eklenmesi değerli modüller

| Öncelik | Modül | Kullanıcı etkisi | Veri/etiket kuralı |
| --- | --- | --- | --- |
| P1 | Işık, terminatör, tutulma | Sahne bir anda derin ve fiziksel görünür | Horizons/SPICE geometrisi; gerçek uzayda hesaplanır. |
| P1 | "Neden böyle görünüyor?" bilgi katmanı | Kullanıcı gölge, faz, retrograde, halka açıklığı gibi ayrıntıları anlar | Her kartta kaynak + hesap anı. |
| P2 | Earth Now ve Solar Now | Gerçek zaman duygusu | Gözlem zamanı ile simülasyon zamanını ayır. |
| P2 | Olay takvimi + yönlendirilmiş kamera | Keşfedilebilirlik artar | Tutulma/transit/conjunction hesapları. |
| P3 | Görev yörünge şeritleri | Voyager, Parker, JWST, Europa Clipper gibi öğeler anlam kazanır | Horizons/SPICE örneklenmiş yörüngeler; düz çizgili uzun dönem tahmin değil. |
| P3 | DSN bağlantı katmanı | Uzayın canlı bir operasyon ağı gibi algılanması | DSN Now verisi varsa son güncelleme saatiyle; yoksa gizle. NASA'nın DSN Now verisi beş saniyede güncellenir. [NASA Eyes](https://science.nasa.gov/eyes/) |
| P4 | Veri olayları | NEO yakın geçişleri, DONKI fırtınaları, yangın/toz/aurora gibi Dünya katmanları | Gözlem/veri gecikmesi açıkça yazılır. |
| P4 | Hikâye rotaları | "Cassini rings", "Apollo sites", "Mars relay", "Pluto flyby" | Sadece yayımlanmış görev verisi ve kaynaklı kısa metin. |

## Tasarım önerisi: kontrol odası değil, keşif aracı

1. **Sahne önce gelir.** Paneller yalnız seçim/hover ile, yarı saydam ve kenarda açılmalı; büyük sürekli dashboard hissinden kaçınılmalı.
2. **Üç net çalışma modu:** `Explore`, `Scientific`, `Now`. Explore estetik varsayılan; Scientific kaynak/ölçek/hesap katmanlarını açar; Now sadece canlı gözlemleri ve iletişimi açar.
3. **Katmanların dürüst dili:** Her katmanda `Predicted`, `Observed`, `Archived`, `Procedural` ve mümkünse tarih/UTC etiketi olmalı. "Live" sadece son gözlem/telemetri gerçekten canlıysa kullanılmalı.
4. **Zaman çubuğu olay odaklı olmalı.** Boş bir hız kontrolü yerine yaklaşan olay işaretleri, geçmiş görev anları ve "now" ayracı taşımalı.
5. **Kamera bir ölçüm aracı da olmalı.** Bir gövdeye yaklaşınca ölçek, güneş açısı, ışık gecikmesi, görünür kesir ve aktif katmanlar sade bir readout ile görünmeli.
6. **Yoğunluk yönetimi:** Yıldız, uydu, asteroid, yörünge, görev, yer adı gibi katmanlar tek tek yönetilmeli; varsayılan görünüm sakin kalmalı. "Her şey açık" görünümü gerçekçiliği değil karmaşayı artırır.

## Yapılmaması gerekenler

- Sıkıştırılmış sahne koordinatlarından fiziksel tutulma sıklığı veya gölge çapı türetip bunu "gerçek" diye sunmak.
- Gelecekteki tarih için güncel bulut/solar görüntüyü göstermek.
- EPIC tam-disk fotoğrafını koordinat/duruş dönüşümü olmadan tüm Dünya dokusu gibi sarmak.
- Sadece güzel görünmesi için olmayan halka, uydu, iniş noktası veya atmosfer eklemek.
- Her gezegeni aynı shader ile "parlatmak"; cisimlerin jeolojisi ve optiği farklıdır.

## Önerilen uygulama sırası

### Faz A — Fiziksel ışık omurgası (ilk tercih)

1. Gerçek efemeris koordinatlarında `SolarIllumination` servis sözleşmesi.
2. Gün/gece, faz, penumbra, bulut/halkalar ve atmosferin aynı uniform paketine geçmesi.
3. Karanlık temada yeni fill stratejisi ve `Scientific contrast` anahtarı.
4. Gölge/tutulma için olay doğrulama senaryoları; kaynak ve ölçek açıklaması.

**Başarı ölçütü:** Dünya, Ay, Mars ve Satürn'de Güneş yönü değiştikçe terminatör/gölge ilişkisi açıkça okunur; görünür ayrıntı ambient ile düzleşmez; olay zamanı gerçek uzay koordinatlarıyla kontrol edilir.

### Faz B — Dünya ve Güneş gözlem katmanları

1. `Earth Now` için GIBS günlük kaplama, EPIC için zaman damgalı tam-disk gözlem kartı.
2. `Solar Now` için SDO HMI/AIA seçici; DONKI olay kartını zaman şeridine bağlama.
3. Ağ/servis kesintisinde uydurma değer yerine açık hata ve son geçerli zaman gösterimi.

**Başarı ölçütü:** Kullanıcı hangi pikselin gözlem, hangisinin simülasyon, hangisinin prosedürel olduğunu tek bakışta anlar.

### Faz C — Yakın plan yüzeyleri ve görev hikâyeleri

1. Ay/Mars gerçek topoğrafya LOD'ları.
2. Cisim bazlı roughness/normal/atmosfer profilleri.
3. Horizons/SPICE örneklemli görev yolları, DSN ve "mission moment" rotaları.

**Başarı ölçütü:** Yakın plan gezegenler tek dokulu küre değil; ışık, topoğrafya, görev bağlamı ve veri kaynağı olan yerler gibi okunur.

## Açık kararlar

- `Now` modunun günlük/15 dakikalık gözlem katmanları için Vercel tarafında cache ve veri lisansı/attribution politikası netleştirilmeli.
- Bilimsel doğru ölçek tek ekranda kullanılabilir değildir. Bu nedenle varsayılan navigasyon ölçeği korunmalı; gerçek ölçek yalnız karşılaştırma/ölçüm modunda gösterilmelidir.
- Ay ve Mars dışındaki her cisim için yüksek çözünürlüklü, doğrulanabilir DEM bulunmayabilir. Bulunamayan ayrıntı prosedürel jeolojiyle doldurulmamalı; yüzey düzeyi dürüstçe sınırlı kalmalıdır.

## Net öneri

İlk geliştirme paketi **Faz A: Solar Illumination** olmalı. Kullanıcının tarif ettiği gölge, arka tarafın kararması, Güneşin yönüne göre halka/bulut davranışı ve "uzayın canlı görünmesi" etkisinin büyük kısmı burada çözülür. Ardından Faz B ile Dünya/Güneş gözlemleri eklenirse, Orbitim yalnız iyi görünen bir 3D sahne değil; kaynaklarını ve zamanını söyleyen yaşayan bir uzay arayüzü olur.
