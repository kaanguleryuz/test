# Amar Control v0.3 - Magisk + Frida standalone test

Bu sürüm v0.2 overlay testinin üstüne gerçek bot runtime katmanını ekler.

## İçerik
- Foreground service + Amar üstünde kayan A menüsü
- Magisk `su` ile doğrudan cihaz içi komutlar
- Frida 17.17.0 `frida-inject` ilk BOTU BAŞLAT kullanımında resmi GitHub release üzerinden cihaz ABI'sine göre indirilir
- `amar-bot.js` `/data/local/tmp/amar-bot.js` konumuna taşınır ve Amar PID'sine inject edilir
- `ayarlar.json` `/data/local/tmp/ayarlar.json` konumuna atomik yazılır
- AI servisi `127.0.0.1:5555/chat` üzerinde APK içinde çalışır
- DeepInfra API anahtarı APK/repo içine gömülmez; uygulama içinden bir kez girilir ve private SharedPreferences'ta tutulur
- AI geçmişi yalnızca RAM'de tutulur
- JS heartbeat ve IDFILE_DATA çıktıları APK tarafından işlenir

## İlk kurulum
v0.2 GitHub Actions debug imzası farklı olduğu için v0.3 kurulmadan önce v0.2'yi kaldırmak gerekebilir. v0.3 ve sonraki testler sabit test keystore ile imzalanır.

1. APK'yı kur
2. Overlay iznini ver
3. AI / KENDİ ID AYARLARI bölümünde own_id ve DeepInfra key'i kaydet
4. BOTU BAŞLAT
5. İlk seferde Frida indirmesinin bitmesini bekle
6. Amar açıldığında logda `BOT AKTİF` ve `Mesaj dinleme aktif` beklenir

Bu bir test sürümüdür. Frida/ROM uyumluluğu telefona göre değişebilir.
