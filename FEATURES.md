# Orbitim — Özellikler

Gerçek efemeris verisiyle çalışan Güneş Sistemi görselleştiricisi. Aşağıda
şimdiye kadar eklenen özellikler, geliştirme fazlarına göre listelenmiştir.

## Faz 1 — Üretilmiş varlıklar bağlandı

8 glyph silueti + 14 hero çizimi diskte duruyordu ama koda bağlı değildi. Uydular
artık kare nokta değil siluet; bir uydu seçilince panelde sınıf çizimi +
`Illustration · representative of class` etiketi görünüyor.

## Faz 2 — Uzay çöpü

Bilinen 3 büyük parçalanma bulutu eklendi:

- **Cosmos 2251** (2009 çarpışma)
- **Fengyun 1C** (2007 ASAT, en büyük bulut)
- **Cosmos 1408** (2021 ASAT)

Hepsi gerçek CelesTrak katalogları. Panelde çalışan uydu / çöp ayrımı yapılıyor.

## Faz 3 — Kuyruklu yıldızlar

Kepler iki-cisim çözücü + 5 gerçek kuyruklu yıldız (Halley, Encke, 67P, Hale-Bopp,
NEOWISE) JPL elemanlarıyla. Kuyruk güneşe zıt akıyor, sadece güneşe yaklaşınca
açılıyor. Halley perihelde `r = q = 0.586`, şu an 35 AU (aphel) — doğrulandı.

## Faz 4 — Cüce gezegenler + adlı asteroitler

Ceres, Pluto, Eris, Makemake, Haumea + Vesta, Pallas, Hygiea, Juno. J2000
elemanları. Pipeline `astronomy-engine`'in Pluto'suna 0.01 AU ile oturuyor —
gerçek konum garantisi.

## Faz 5 — Landing animasyonu

Yörünge markası (ellipse üstünde dönen nokta), HUD köşe işaretleri, telemetri
retick flash, tarama katmanı. Hepsi `prefers-reduced-motion` arkasında.

## Faz 6 — Marka

Yabancı mor favicon değişti (Orbitim yörünge markası), referanssız `icons.svg`
silindi, 1200×630 OG/Twitter kartı (`qlmanage` ile rasterize), MIT LICENSE.

## Faz 7 — Paylaşılabilir link

An + hız + takımyıldızlar URL hash'inde. Share butonu tıklama anındaki an'ı
damgalayıp kopyalıyor. Konum asla saklanmaz, hep an'dan hesaplanır.

## Faz 8 — WebP

Hero çizim + glyph + kuyruklu yıldız sprite'ları PNG'den WebP'ye. Doku dışı public
asset ~15 MB → ~2 MB. 2 dead asset silindi.

## Faz 9 — README güncellendi

Kuyruklu yıldızlar, minör gezegenler, çöp bulutları ve paylaşılabilir linkler
dokümante edildi.

## Faz 10 — Yörünge çizgisi anahtarı + light tema

Sitenin sağ-üstüne, Share View'in yanına iki kontrol eklendi (`ViewControls`):

- **Yörünge çizgisi anahtarı.** Tek buton gezegen + kuyruklu yıldız + minör cisim
  yörünge izlerinin hepsini birden gizler/gösterir. Sahne kalabalık olduğunda
  çizgiler kapatılıp cisimler net görülebiliyor. Takımyıldız figürleri ve
  asteroit kuşağı ayrı katman — anahtardan etkilenmiyor.
- **Light / dark tema anahtarı.** Varsayılan koyu (uzay) mod; light modda uzay
  boşluğu yerine düz açık bir zemin geliyor, yıldız alanı düşürülüyor, gezegenler
  bu zemine karşı okunuyor. Arka plan sahne clear rengiyle veriliyor
  (`SceneRoot`), bloom eşiğinin altında tutulmuş açık ton. Light modda ambient
  fill yükseltiliyor ki cisimlerin gece yüzü siyah disk olarak kalmasın; vignette
  düşürülüyor (köşeleri grileştirmesin).

Tema durumu tek bir zustand store'da (`scene/viewSettings.ts`): `orbitsVisible`
+ `theme`. Light modda okunmaz kalan iç-sahne etiketleri koyulaştırıldı (gezegen
adları, kuyruklu yıldız + minör cisim adları); desktop sol rail de light modda
koyu slate'e geçiyor — mobilde kendi koyu şeridi olduğu için orada beyaz kalıyor.
Kontrol pill'leri her iki temada koyu: enstrüman kromu, iki zeminde de okunur.

## Faz 11 — Gerçekçilik, erişim ve veri güvence katmanı

- Otuz gök cismi ve on dokuz doğal uydu; seçili uydular için yakın görünümde
  NASA 3D Resources GLB modelleri. Modeller yalnızca ziyaret edilen uyduda
  yüklenir; sistem görünümü gereksiz GPU/ağ maliyeti taşımaz.
- Dünya için yüzeyden ayrık, simülasyon zamanıyla hareket eden bulut kabuğu;
  Güneş, gezegen terminatörleri ve halka gölgeleri aynı aydınlatma yaklaşımında.
- Mobilde çakışan üst araçlar tek erişilebilir sahne kokpitinde birleştirildi:
  mod, yörünge, gökyüzü çizgileri, tema, dil ve paylaşım tek noktada.
- İngilizce/Türkçe geçişi olay, uzay havası, yerel gökyüzü ve uydu dosyalarına
  uzatıldı; tarih ve sayılar seçilen yerel ayara göre biçimlenir.
- JPL Horizons ve CNEOS Vercel rotaları artık ağ, HTTP ve bozuk JSON durumlarını
  açık 502 tanılarıyla verir; NASA DONKI anahtarı yalnızca Vercel ortamında tutulur.

---

## Notlar

**Paylaşım linkinden gövde-uçuşu çıkarıldı.** Soğuk-başlangıçta sahne ~9 sn
ısınırken render loop bloklanıyor, uçuş `flying`'de takılıyordu; oynatılan saat
gecikmede kayardı. An / hız / takımyıldız kısmı sağlam çalışıyor — asıl
paylaşılabilir değer o.

**Soğuk-başlangıç siyahlığı.** Landing'i atlayan paylaşım linki soğuk sahneye
giriyor, ~9 sn siyah sonra render. Bu sahnenin mevcut karakteri (landing arkasında
ısınıyordu). Doku sıkıştırma (Faz 8) bunu bir miktar hafifletir.
</content>
</invoke>
