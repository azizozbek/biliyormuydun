# Biliyor muydun?

Trende, havalimanında ya da internetin zayıf olduğu veya hiç olmadığı bir yerde canın sıkıldığında aç, birbirinden ilginç bilgiler arasında kaydır.

Türkçe genel kültür bilgileri. Her bilgi tek bir kartta. Kartı sağa kaydırınca sonraki, sola kaydırınca önceki bilgi gelir. Yukarı çekince detay açılır, iki kez dokununca bilgi beğenilir ve favorilere eklenir.

Site [Hugo](https://gohugo.io/) ile üretilen statik bir PWA. Sunucu, veritabanı ya da PHP gerekmez. Bir kez açıldıktan sonra internet olmadan da çalışır.

## Kullanım

| Hareket | Sonuç |
| --- | --- |
| Kartı sağa kaydır, → tuşu ya da sağdaki ok | Sonraki bilgi |
| Kartı sola kaydır, ← tuşu ya da soldaki ok | Önceki bilgi |
| Kartı yukarı çek, "Detay" butonu ya da ↑ tuşu | Detay paneli açılır (kapatmak: paneli aşağı kaydır, ↓ ya da Esc) |
| Karta iki kez dokun / tıkla ya da kalp butonu | Beğen, favorilere ekle (kalp butonu beğeniyi geri de alır) |
| Paylaş butonu | Bilginin kalıcı linkini `/bilgi/<id>/` paylaşır (destek yoksa panoya kopyalar) |

- **Üst çubuk:** solda kategori filtresi, ortada site adı, sağda Favoriler ve Ayarlar.
- **Kart:** sol üstte kategori, o günün bilgisiyse yanında "Günün bilgisi" rozeti.
- **Sol alt köşe:** uygulama ana ekrana eklenebiliyorsa "Ana ekrana ekle" butonu çıkar. Telefonda bu butonun etiketi "Ekle".
- **Ayarlar:** tema (sistem/açık/koyu), yazı boyutu, çevrimdışı durumu, "Gördüğüm bilgileri sıfırla".
- **Tarayıcı çubuğu rengi** (`theme-color`) o anki kartın rengini ya da sayfa arka planını izler, açık ve koyu temaya uyar.
- `prefers-reduced-motion` açıksa animasyonlar kapanır. Bütün butonlarda erişilebilirlik etiketi var.

## Nasıl çalışıyor

| Parça | Dosya |
| --- | --- |
| Bilgiler | `data/facts.json` (`id`, `category`, `fact`, `detail[]`, `source?`) |
| Kart renkleri (açık/koyu) | `data/palette.json` |
| Her bilginin sayfası `/bilgi/<id>/` (`/bilgi/` liste sayfası üretilmez) | `content/bilgi/_content.gotmpl` (Hugo content adapter) |
| Sayfa iskeleti, kart şablonu | `layouts/baseof.html`, `layouts/_partials/deck.html` |
| Kart destesi, beğeni, filtre, ayarlar | `assets/js/app.js`, saf mantık `assets/js/lib.js` |
| Stiller (palet Hugo şablonuyla basılır) | `assets/css/main.css` |
| Çevrimdışı çalışma | `layouts/home.sw.js` → `/sw.js`, `layouts/home.manifest.webmanifest` |
| Apache ayarları | `static/.htaccess` |

- **Beğeniler ve ayarlar** yalnızca cihazda, tarayıcının `localStorage`'ında tutulur. Hiçbir veri sunucuya gönderilmez. Tarayıcı verisi silinirse favoriler de silinir.
- **Sıralama:** Kullanıcının daha önce görmediği bilgiler önce gelir, kullanıcının beğendiği kategoriler öne çıkar. Sıraya biraz rastgelelik eklenir, böylece her ziyarette farklı bilgiler görülür. Günün bilgisi o gün henüz görülmediyse ilk kart olur. Kurallar `lib.js` içindeki `rank()` fonksiyonunda.
- **Çevrimdışı:** Service worker, kurulumda bütün sayfaları, CSS'i, JS'i, `facts.json`'u ve ikonları önbelleğe alır. Her build'de önbellek adı değişir, eski dosyalar silinir.

## Gereksinimler

- Hugo **0.146 veya üzeri** (extended sürüm gerekmiyor). macOS: `brew install hugo`
- Node.js 20 veya üzeri. Yalnızca kendi bilgisayarındaki kontrol scriptleri için gerekiyor, bağımlılık yok.
- **Sunucuda hiçbir şey gerekmez:** Node, npm, Hugo, PHP ya da veritabanı yok. Site bilgisayarında build edilir, sunucuya yalnızca hazır statik dosyalar yüklenir.

## Çalıştırma

```bash
npm run dev          # hugo server → http://localhost:1313 (dosya değişince sayfa yenilenir)
```

Geliştirme sırasında önbellek karışmasın diye `hugo server` modunda (development ortamı) service worker kaydedilmez. Daha önce build edilmiş siteyi aynı adreste açtıysan, kalan service worker'ı DevTools → Application → Service workers → Unregister ile kaldır. Çevrimdışı çalışmayı denemek için sitenin build edilmiş hâlini kullan:

```bash
npm run preview      # hugo --minify + statik sunucu → http://localhost:8080
```

## Kontrol ve testler

```bash
npm run check        # facts.json şeması, kategori başına ≥ 5 bilgi, bütün renk çiftleri ≥ 4.5:1 (WCAG AA)
npm test             # sıralama ve günün bilgisi testleri
# PWA uçtan uca: preview açıkken, Chromium tabanlı bir tarayıcıyla (geçici profil, headless)
node scripts/offline-test.mjs "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" http://localhost:8080
```

Bilgi eklerken `data/facts.json`'a yeni bir nesne ekle, `id` küçük harf ve tireli olsun (URL'de kullanılıyor), ardından `npm run check` çalıştır.

## Yayına alma (statik hosting)

1. **Alan adı:** Siteyi yayınlayacağın alan adını ya da klasörü hosting panelinde hazırla ve sitenin dosyalarının gideceği klasörü (document root) not et.
2. **HTTPS:** Alan adı için SSL'i aç (çoğu panelde AutoSSL ya da Let's Encrypt). Service worker, yani çevrimdışı çalışma, yalnızca HTTPS'te çalışır.
3. **Site adresi:** `.env.example` dosyasını `.env` olarak kopyala ve `HUGO_BASEURL` değerini kendi adresin yap (örneğin `https://example.com/`). `npm run build` bu değeri okur ve `hugo.toml` içindeki `baseURL`'ün yerine kullanır. Canonical, og etiketleri ve sitemap bu değeri kullanır. `.env` git'e eklenmez. Node olmadan build alıyorsan: `HUGO_BASEURL=https://example.com/ hugo --minify`.
4. **Build (kendi bilgisayarında):**
   ```bash
   npm run build        # kontrol + hugo --minify
   ```
   Node kurulu değilse yalnızca `hugo --minify` de aynı `public/` klasörünü üretir, ama kontrol çalışmaz.
5. **Yükleme:** `public/` klasörünün *içindekileri* document root'a yükle: panelin dosya yöneticisiyle, FTP/SFTP ile ya da SSH varsa rsync ile. `.htaccess` gizli bir dosya, FTP programında gizli dosyaları göstermeyi aç.
   ```bash
   rsync -avz --delete public/ kullanici@sunucu:~/public_html/
   ```
6. **Kontrol:** Siteyi aç. DevTools → Application'da service worker aktif görünmeli ve manifest hatasız yüklenmeli. Sonra çevrimdışı moda geçip sayfayı yenile, site açılmalı.

**Git ile yayın:** `public/` klasörü build sonucuyla birlikte repoya eklenir, çünkü sunucuda build alınmıyor. Bilgisayarında `npm run build` çalıştır, `public/` dahil commit'le ve push'la. Sunucuda repoyu çekip (`git pull`) document root'u `public/` klasörüne yönlendir ya da `public/` içeriğini document root'a kopyala. Build almadan commit'lersen sunucudaki site eski kalır.

> **İpucu:** Sunucunda Node ve Hugo kuruluysa `public/` satırını `.gitignore`'a ekle ve siteyi sunucuda build et: `git pull && npm run build`. Böylece build sonucu repoya girmez. `.env` dosyasını sunucuda da oluşturmayı unutma.

Her güncellemede 4. ve 5. adımları tekrarla. Ziyaretçiler yeni sürümü bir sonraki açılışta otomatik alır.

`static/.htaccess` Apache içindir:
- HTTP'den HTTPS'e yönlendirir.
- 404 sayfasını ayarlar.
- `.webmanifest` dosyalarının MIME tipini tanımlar.
- `sw.js` dosyasının önbelleğe alınmasını engeller.
- Fingerprint'li dosyaları bir yıl önbellekte tutar.

Hosting nginx kullanıyorsa bu kuralların karşılığını panelden ayarla.

İkonlar `/img/` altındadır. `/icons/` kullanma: birçok paylaşımlı hostta Apache bu yolu kendi ikonlarına ayırır ve oradaki dosyalar 404 verir.

## PWA olarak yükleme

- **Android / masaüstü Chrome ve Edge:** sol alttaki "Ana ekrana ekle" butonu (ya da Ayarlar'daki aynı buton) tarayıcının yükleme penceresini açar. Kullanıcı reddederse buton, tarayıcı yeniden izin verene kadar gizlenir.
- **iPhone / iPad:** Apple sitelerin kendini ana ekrana eklemesine izin vermez. Bu yüzden buton adımları gösterir: Safari'de Paylaş → "Ana Ekrana Ekle" → "Ekle".
- Uygulama zaten yüklüyse ya da tarayıcı yüklemeyi desteklemiyorsa (örneğin Firefox) buton görünmez.
- Yükleme penceresi yalnızca HTTPS'te yayınlanan sitede çıkar. Yayından sonra bir Android telefonda ve bir iPhone'da dene.

İkonları değiştirmek için `scripts/icons.mjs` dosyasını düzenle ve `npm run icons` çalıştır. `static/img/icon.svg` dosyası ayrıca güncellenmeli.
