# 📡 Orbitim 3D - Gerçek Zamanlı Uydu ve Telemetri Simülatörü

<p align="center">
  <img src="./public/screenshots/orbitim_logo.png" alt="Orbitim Logo" width="300" />
</p>

[![Live Demo](https://img.shields.io/badge/Live-Demo-blue.svg?style=for-the-badge&logo=vercel)](https://orbitim-3d.vercel.app)

Orbitim 3D, Dünya yörüngesindeki yapay uydu kabuklarını (özellikle Starlink takımyıldızını) gerçek zamanlı TLE (Two-Line Element) verilerini kullanarak 3 boyutlu ortamda simüle eden ve takip eden siber-estetik bir telemetri istasyonudur.

---

## 📸 Ekran Görüntüleri

### 🚀 Siber Landing & Karşılama Ekranı
![Starlink Karşılama Ekranı](./public/screenshots/starlink_satellite.png)

### 🌍 3D Telemetri Küresi ve Yörüngeler
![Orbitim 3D Küre Önizleme](./public/screenshots/globe_preview.png)

---

## 🌟 Öne Çıkan Özellikler

*   **⚡ Satvisor TLE CDN Aynası**: CelesTrak 403 API hız limitlerini tamamen aşan ve **6.000+ aktif Starlink uydusunu** anında yükleyen hızlı yörünge veri boru hattı.
*   **🌍 8K Ultra Yüksek Çözünürlüklü Dünya**: Gündüz ve gece (şehir ışıkları) dokularını birleştiren özel `MeshStandardMaterial` materyali.
*   **☁️ Bağımsız Bulut Katmanı**: Dünya'nın üzerinde, ondan bağımsız olarak dönen gerçekçi ve akıcı bulut simülasyonu.
*   **☀️ Gerçek Zamanlı Güneş & Ay Hizalaması**: UTC saatine bağlı olarak Güneş ve Ay'ın astronomik konumları anlık hesaplanır. Küre üzerinde aydınlanma çemberi (terminator) ve gölgeler gerçekçidir.
*   **✨ 3D Vektörel Yıldız Kümesi**: 4.000 adet parçacıktan oluşan derinlik (parallax) hissi veren keskin uzay boşluğu arka planı.
*   **🚀 LOD (Level of Detail) Performans Optimizasyonu**:
    *   Uyduların donma ve kasma yapmasını önlemek için basitleştirilmiş tek parça 3D modeller ve ortak materyal havuzu (material cache) kullanılır.
    *   Sadece üzerine tıklanarak kilitlenen (hedef alınan) aktif uydu tam detaylı 3D modeliyle yörünge çizgisi (sonraki 90 dk) ve kapsama alanı halkasıyla birlikte gösterilir.
    *   CPU-GPU veri aktarımını 15 kat azaltarak **60 FPS akıcı çalışma** sunar.
*   **💫 Yaşayan Takımyıldız Blinki**: Tüm uydu parçacıkları kendilerine özel rastgele fazlarda out-of-phase olarak sinüs dalgasıyla yanıp söner.

---

## 🛠️ Kullanılan Teknolojiler

*   **Frontend Framework**: React 19 + TypeScript
*   **Vite**: v8.1 (Fast HMR & Optimized Bundling)
*   **3D WebGL Engine**: Three.js & `react-globe.gl` / `globe.gl`
*   **Fizik & Orbital Hesaplama**: `satellite.js` (SGP4/SDP4 Orbit Propagator)
*   **Styling**: Tailwind CSS v4 + Lucide React (Cyberpunk Glassmorphic HUD)

---

## 🚀 Kurulum ve Çalıştırma

Projeyi yerel makinenizde çalıştırmak için aşağıdaki adımları izleyin:

1.  **Bağımlılıkları Yükleyin**:
    ```bash
    npm install
    ```

2.  **Geliştirme Sunucusunu Başlatın**:
    ```bash
    npm run dev
    ```

3.  **Tarayıcıda Açın**:
    Tarayıcınızda `http://localhost:5173/` adresine gidin.

4.  **Üretim Sürümü İçin Derleyin**:
    ```bash
    npm run build
    ```

---

## 🖱️ Kontroller

*   **Dünya Döndürme**: Sol tık ile sürükleyin.
*   **Yakınlaştırma/Uzaklaştırma**: Farenizin tekerleğini kullanın.
*   **Uydu Telemetrisi Kilitleme**: Herhangi bir uydunun üzerine tıklayarak yörüngesini ve anlık enlem/boylam/hız bilgilerini HUD panelinde kilitleyin.
*   **Konsept Filtreleri**: Sol HUD panelinden Starlink, GPS, Hava Durumu, Uzay İstasyonları veya Jeosenkron yörünge takımlarını seçin.
