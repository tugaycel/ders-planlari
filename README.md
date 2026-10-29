# Özel Ders Programı

Özel ders veren öğretmenler için takvim ve ders takip uygulaması. Kurulum gerektirmez; tarayıcıda çalışır ve GitHub Pages üzerinden bir linkle açılabilir.

## Özellikler

- **Takvim**: gün, hafta ve ay görünümü. Boş alana tıklayınca o saate ders eklenir. Öğretmen, öğrenci, kategori ve duruma göre filtrelenir; renkler kategoriye ya da öğretmene göre seçilebilir.
- **Ders planları**: tarih, saat, süre, öğretmen, bir ya da birden çok öğrenci (grup dersi), kategori, yer, konu, ders planı ve notlar. Haftalık tekrar ile toplu planlama yapılır. Öğretmen ya da öğrenci çakışmalarında uyarı verilir.
- **Ders durumu**: planlandı, yapıldı, yapılmadı (nedeniyle), ertelendi (isteğe bağlı yeni tarihle; yeni ders kendiliğinden oluşur). Zamanı geçtiği halde durumu girilmemiş dersler için uyarı gösterilir. Her dersin işlem geçmişi tutulur.
- **Onay süreci (isteğe bağlı)**: Ayarlar'dan açılır. Açıkken öğretmenin durum bildirimi, sorumlu öğretmen ya da yönetici onaylayana kadar işlenmez. Onaylar sayfasından tek tek ya da toplu olarak onaylanır veya reddedilir.
- **Öğretmenler**: iki rol vardır: yönetici ve öğretmen. Her öğretmene bir *sorumlu öğretmen* atanabilir. Sorumlu öğretmen, ekibindeki öğretmenlerin adına ders girebilir ve onların bildirimlerini onaylar. Bu sorumluluk zincirleme işler: ekibin ekibi de kapsama girer. İstenirse giriş için PIN konabilir.
- **Öğrenciler**: veli ve iletişim bilgileri, sınıf, notlar. Ders almayı bırakan öğrenci pasife alınabilir.
- **Kategoriler**: ders türleri (Matematik, İngilizce vb.). Her birinin rengi, varsayılan süresi ve ders başı ücreti olur.
- **Eşleştirmeler**: hangi öğrencinin hangi dersi hangi öğretmenden aldığı tanımlanır. Haftalık ders hedefi ve öğrenciye özel ücret buradan girilir. Ders planlarken eşleştirme seçilirse form kendiliğinden dolar.
- **Raporlar**: tarih aralığına göre öğretmen, öğrenci ve kategori bazında yapılan, yapılmayan ve ertelenen ders sayıları, gerçekleşme oranı, toplam süre ve tutar. Raporlar CSV olarak (Excel'de açılabilir) indirilebilir.
- **Yedekleme**: tüm veriler JSON dosyası olarak indirilir ve geri yüklenir.

## Verilerin saklandığı yer (önemli)

Bu sürümde sunucu yok. **Veriler, uygulamanın açıldığı tarayıcıda saklanır** (localStorage).

- Uygulamaya aynı cihazdan ve aynı tarayıcıdan girildiği sürece veriler korunur.
- Başka bir cihaz kendi ayrı verisiyle başlar. Verileri taşımak için **Ayarlar → Yedek indir** ile dosya alınır, diğer cihazda **Yedekten geri yükle** ile yüklenir.
- Tarayıcı verilerini temizlemek ya da gizli sekme kullanmak kayıtları siler. Bu yüzden düzenli yedek alın.
- Aynı cihazı birden çok öğretmen kullanıyorsa her biri kendi adıyla giriş yapar. PIN yalnızca karıştırmayı önlemek içindir; gerçek bir güvenlik önlemi değildir.

## Yerelde çalıştırma

`index.html` dosyasına çift tıklamak yeterlidir. İsterseniz küçük bir sunucuyla da açabilirsiniz:

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
4. Birkaç dakika içinde uygulama `https://KULLANICI_ADINIZ.github.io/ozel-ders/` adresinde açılır. Bu linke sahip olan herkes uygulamayı kendi cihazında, kendi verisiyle kullanabilir.

Not: Depo herkese açık olsa bile içinde öğrenci verisi bulunmaz. Veriler yalnızca kullanıcıların tarayıcısında durur.

## Sonraki adımlar (sunucu ve alan adı)

Veri erişimi tek bir dosyada toplanmıştır: `js/db.js`. Ortak ve çok cihazlı kullanıma geçmek için yalnızca bu katman bir sunucuya bağlanır, örneğin Supabase, Firebase ya da kendi API'niz. Bu geçişle şunlar da eklenebilir:

- gerçek kullanıcı girişi (e-posta ve şifre),
- tüm öğretmenlerin aynı verileri anlık görmesi,
- yetki kurallarının sunucuda uygulanması (şu an `js/yetki.js` içinde, tarayıcı tarafındadır),
- özel alan adı: GitHub Pages'te **Settings → Pages → Custom domain** ile tanımlanır.

## Dosya yapısı

```
index.html        Giriş sayfası
css/style.css     Görünüm (açık/koyu tema, mobil uyumlu)
js/util.js        Tarih ve biçim yardımcıları
js/db.js          Depolama katmanı (sunucuya geçişte değişecek tek dosya)
js/yetki.js       Oturum, roller, sorumluluk ve onay yetkileri
js/ders.js        Ders iş kuralları: durum, onay, erteleme, ücret
js/ui.js          Pencere, bildirim ve form yardımcıları
js/takvim.js      Takvim görünümleri, ders formu, ders detayı
js/liste.js       Ders listesi ve onaylar
js/yonetim.js     Öğrenci, öğretmen, kategori ve eşleştirme yönetimi
js/rapor.js       Raporlar ve ayarlar
js/demo.js        Deneme verisi
js/app.js         Uygulama kabuğu ve sayfa yönlendirme
```
