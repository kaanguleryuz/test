# Amar Control 0.2 – Android 11 / Magisk overlay test

Bu proje, fiziksel Android 11 + Magisk telefonda APK kabuğunu test etmek için hazırlanmıştır.

## Bu testte çalışanlar
- Magisk root kontrolü (`su -c id`)
- Android sürümü ve CPU ABI tespiti
- Foreground service + kalıcı bildirim
- Amar açıkken diğer uygulamaların üzerinde kalan sürüklenebilir mavi `A` balonu
- Balona dokununca açılan kayan panel
- Panelde: Arka plan testini başlat/durdur, Amar'ı aç, root durumu, canlı loglar, servisi kapat
- Amar process durumunu root üzerinden 5 saniyede bir kontrol etme
- `START_STICKY` arka plan servisi

## Telefonda test sırası
1. APK'yı kur ve aç.
2. `ROOT KONTROL`e bas. Magisk sorarsa izin ver.
3. `KAYAN MENÜYÜ AÇ`a bas.
4. Android 11 izin ekranında `Amar Control` için `Diğer uygulamaların üzerinde göster` iznini aç.
5. Uygulamaya dönüp tekrar `KAYAN MENÜYÜ AÇ`a bas.
6. `AMAR'I AÇ`a bas.
7. Amar'ın üzerinde mavi `A` balonu görünmeli. Balonu sürükleyebilirsin.
8. Balona dokun ve `ARKA PLAN TESTİNİ BAŞLAT`a bas.
9. Menüde `Root ✓ · Amar AÇIK` görülmesi beklenir. Canlı loglarda PID, Android sürümü ve ABI görünür.

## Build
Android Studio ile klasörü açıp `Build > Build APK(s)` kullan.

- applicationId: `com.amar.control`
- minSdk: 26
- targetSdk: 30
- Android 11 hedefi: API 30

## Kapsam
Bu 0.2 test sürümü yalnızca root, overlay, foreground-service ve Amar process erişimini doğrular. Otomatik mesaj gönderme, kullanıcı taklidi veya kişisel iletişim bilgisi toplama davranışı içermez.
