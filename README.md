# Ders Planları

Ders veren öğretmenler için takvim ve ders takip uygulaması. Kurulum gerektirmez; tarayıcıda çalışır, GitHub Pages üzerinden bir linkle açılır ve verileri Firebase bulut veritabanında saklar.

Canlı adres: https://tugaycel.github.io/ozel-ders/

## Özellikler

- **Takvim**: gün, hafta ve ay görünümü. Boş alana tıklayınca o saate ders eklenir. Öğretmen, öğrenci, kategori ve duruma göre filtrelenir; renkler kategoriye ya da öğretmene göre seçilebilir.
- **Ders planları**: tarih, saat, süre, öğretmen, bir ya da birden çok öğrenci (grup dersi), kategori, yer, konu, ders planı ve notlar. Haftalık tekrar ile toplu planlama yapılır. Öğretmen ya da öğrenci çakışmalarında uyarı verilir.
- **Ders durumu**: planlandı, yapıldı, yapılmadı (nedeniyle), ertelendi (isteğe bağlı yeni tarihle; yeni ders kendiliğinden oluşur). Zamanı geçtiği halde durumu girilmemiş dersler için uyarı gösterilir. Her dersin işlem geçmişi tutulur.
- **Onay süreci (isteğe bağlı)**: Ayarlar'dan açılır. Açıkken öğretmenin durum bildirimi, sorumlu öğretmen ya da yönetici onaylayana kadar işlenmez. Onaylar sayfasından tek tek ya da toplu olarak onaylanır veya reddedilir.
- **Öğretmenler**: iki rol vardır: yönetici ve öğretmen. Her öğretmene bir *sorumlu öğretmen* atanabilir. Sorumlu öğretmen, ekibindeki öğretmenlerin adına ders girebilir ve onların bildirimlerini onaylar. Bu sorumluluk zincirleme işler: ekibin ekibi de kapsama girer. Öğretmenler uygulamaya yöneticinin gönderdiği tek kullanımlık davet linkiyle katılır.
- **Öğrenciler**: veli ve iletişim bilgileri, sınıf, notlar. Ders almayı bırakan öğrenci pasife alınabilir.
- **Kategoriler**: ders türleri (Matematik, İngilizce vb.). Her birinin rengi, varsayılan süresi ve ders başı ücreti olur.
- **Eşleştirmeler**: hangi öğrencinin hangi dersi hangi öğretmenden aldığı tanımlanır. Haftalık ders hedefi ve öğrenciye özel ücret buradan girilir. Ders planlarken eşleştirme seçilirse form kendiliğinden dolar.
- **Raporlar**: tarih aralığına göre öğretmen, öğrenci ve kategori bazında yapılan, yapılmayan ve ertelenen ders sayıları, gerçekleşme oranı, toplam süre ve tutar. Raporlar CSV olarak (Excel'de açılabilir) indirilebilir.
- **Yedekleme**: tüm veriler JSON dosyası olarak indirilir ve geri yüklenir.

## Uygulama olarak yükleme

Site, cihaza uygulama gibi yüklenebilir (PWA): kendi simgesiyle açılır, tarayıcı çubukları görünmez ve internet yokken de açılır.

- **Android (Chrome):** siteyi açın → menü (⋮) → **Uygulamayı yükle** ya da **Ana ekrana ekle**.
- **iPhone / iPad (Safari):** Paylaş düğmesi → **Ana Ekrana Ekle**.
- **Bilgisayar (Chrome / Edge):** adres çubuğunun sağındaki **Yükle** simgesi; uygulama başlat menüsüne ve masaüstüne eklenir.

Güncellemeler yüklü uygulamaya kendiliğinden gelir. `sw.js` uygulama dosyalarını cihazda saklar; dosya listesi değişirse içindeki `ONBELLEK` sürümünü artırın.

## Veriler ve giriş

Veriler **Firebase** (Google) bulut veritabanında, Frankfurt bölgesinde saklanır. Proje: `ozel-ders-c42ad` (tugaycelikk@gmail.com hesabı, ücretsiz Spark planı).

- Herkes kendi e-postası ve şifresiyle giriş yapar. Telefon, tablet ya da bilgisayar fark etmez; aynı takvim görünür ve değişiklikler anında herkese yansır.
- İnternet kesilse de uygulama çalışır; yapılan değişiklikler bağlantı gelince gönderilir.
- **Kurum yapısı:** İlk giriş yapan kişi bir kurum oluşturur ve yöneticisi olur. Diğer öğretmenler **Öğretmenler → Davet linki** ile eklenir. Link tek kullanımlıktır ve öğretmen kaydına bağlanır. Her kurumun verisini yalnızca o kurumun üyeleri görebilir; bu kural sunucuda, `firestore.rules` dosyasıyla uygulanır.
- Bir öğretmen pasife alındığında uygulamaya erişimi de kaldırılır.
- Rol ve sorumluluk kuralları (kimin kimin adına ders girebileceği, kimin onaylayabileceği) uygulama içinde uygulanır. Sunucu tarafında ise kurum üyeleri birbirine güvenilir kabul edilir.
- **Ayarlar → Yedek indir** ile tüm veriler JSON olarak indirilebilir, **Yedekten geri yükle** ile geri yüklenebilir.

### Firebase ayarları

- Authentication: E-posta/Şifre girişi açık.
- Firestore: `(default)` veritabanı, `europe-west3`. Güvenlik kuralları `firestore.rules` dosyasındadır; değiştirildiğinde Firebase konsolunda **Firestore → Rules** sayfasına yapıştırılıp yayınlanmalıdır.
- Web yapılandırması: `js/firebase-config.js`. Bu değerler gizli değildir; erişimi güvenlik kuralları sınırlar.

## Yerelde çalıştırma

Firebase modülleri nedeniyle dosyaya çift tıklayarak değil, küçük bir sunucuyla açılmalıdır:

```bash
python -m http.server 5173
```

Ardından tarayıcıda `http://localhost:5173` adresini açın.

## GitHub Pages ile yayınlama

1. GitHub'da yeni bir depo oluşturun (örneğin `ozel-ders`). Herkese açık (public) depo, ücretsiz hesapta Pages için gereklidir.
2. Bu klasördeki dosyaları depoya gönderin:
   ```bash
   git init
   git add .
   git commit -m "Özel ders programı"
   git branch -M main
   git remote add origin https://github.com/KULLANICI_ADINIZ/ozel-ders.git
   git push -u origin main
   ```
3. Depoda **Settings → Pages** sayfasına girin. **Source: Deploy from a branch**, **Branch: main / (root)** seçip kaydedin.
4. Birkaç dakika içinde uygulama `https://KULLANICI_ADINIZ.github.io/ozel-ders/` adresinde açılır. Linki açan herkes kendi hesabıyla giriş yapar ve yalnızca üyesi olduğu kurumun verisini görür.

Not: Depo herkese açık olsa bile içinde öğrenci verisi bulunmaz. Veriler Firebase veritabanında durur ve yalnızca kurum üyelerine açıktır.

## Alan adı

İleride özel alan adı GitHub Pages'te **Settings → Pages → Custom domain** ile tanımlanır. Ardından bu alan adı Firebase konsolunda **Authentication → Settings → Authorized domains** listesine eklenmelidir.

## Dosya yapısı

```
index.html        Giriş sayfası
manifest.webmanifest  Uygulama adı, rengi ve simgeleri (yükleme için)
sw.js             Service worker: çevrimdışı açılış
icons/            Uygulama simgeleri
css/style.css     Görünüm (açık/koyu tema, mobil uyumlu)
js/util.js        Tarih ve biçim yardımcıları
js/db.js          Bellek içi veri katmanı (uygulama buradan okur/yazar)
js/bulut.js       Firebase: giriş, kurum, davetler, eşitleme
js/firebase-config.js  Firebase web yapılandırması
firestore.rules   Firestore güvenlik kuralları
js/yetki.js       Oturum durumu, roller, sorumluluk ve onay yetkileri
js/ders.js        Ders iş kuralları: durum, onay, erteleme, ücret
js/ui.js          Pencere, bildirim ve form yardımcıları
js/takvim.js      Takvim görünümleri, ders formu, ders detayı
js/liste.js       Ders listesi ve onaylar
js/yonetim.js     Öğrenci, öğretmen, kategori ve eşleştirme yönetimi
js/rapor.js       Raporlar ve ayarlar
js/demo.js        Deneme verisi
js/app.js         Uygulama kabuğu ve sayfa yönlendirme
```
