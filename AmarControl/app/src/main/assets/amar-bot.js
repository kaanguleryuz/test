Java.perform(function() {
    // --- HEARTBEAT ---
    try {
        setInterval(function() {
            try {
                console.log('[HEARTBEAT] ' + new Date().toISOString());
            } catch (e) {}
        }, 20000);
    } catch (e) {}
    
    try {
        var selfUserId = '';
        var processState = {};
        var globalMessageContent = {};

        var sayaçAktif = false;
        var sayaçTimeout = null;
        var sayaçSüresi = 5 * 60 * 1000;
        var sonIdler = [];
        var maxId = 10;
        var sayaçTakip = {};
        var trackedIdsFile = '/data/local/tmp/id.json';

        function loadTrackedIds() {
            try {
                var File = Java.use('java.io.File');
                var FileInputStream = Java.use('java.io.FileInputStream');
                var InputStreamReader = Java.use('java.io.InputStreamReader');
                var BufferedReader = Java.use('java.io.BufferedReader');
                var file = File.$new(trackedIdsFile);
                if (!file.exists()) return [];
                var fis = FileInputStream.$new(file);
                var isr = InputStreamReader.$new(fis, 'UTF-8');
                var br = BufferedReader.$new(isr);
                var line;
                var content = '';
                while ((line = br.readLine()) !== null) { content += line; }
                br.close(); isr.close(); fis.close();
                var parsed = JSON.parse(content);
                return Array.isArray(parsed) ? parsed.map(String) : [];
            } catch (e) {
                return [];
            }
        }

        function saveTrackedIds() {
            try {
                // Frida CLI çıktısını Python yakalar ve bot klasöründeki id.json dosyasına yazar.
                console.log('[IDFILE_DATA]' + JSON.stringify(sonIdler));
            } catch (e) {
                console.log('[IDFILE] Kaydetme hatası: ' + e);
            }
        }

        function restoreTrackedIds() {
            try {
                var ids = loadTrackedIds();
                if (!Array.isArray(ids) || !ids.length) return;
                sonIdler = ids.slice(-maxId);
                for (var i = 0; i < sonIdler.length; i++) {
                    var id = String(sonIdler[i]);
                    if (!id) continue;
                    if (!sayaçTakip[id]) {
                        sayaçTakip[id] = { timeout: null, aktif: false };
                    }
                    if (sayaçTakip[id].timeout) {
                        clearTimeout(sayaçTakip[id].timeout);
                    }
                    sayaçTakip[id].aktif = true;
                    sayaçSıfırlaVeBaşlat(id);
                }
            } catch (e) {}
        }

        function sayaçSıfırlaVeBaşlat(yeniId) {
            if (!yeniId) return;

            var id = String(yeniId);
            if (!sayaçTakip[id]) {
                sayaçTakip[id] = { timeout: null, aktif: false };
            }

            if (sayaçTakip[id].timeout) {
                clearTimeout(sayaçTakip[id].timeout);
            }

            sayaçAktif = true;
            sayaçTakip[id].aktif = true;

            if (sonIdler.indexOf(id) === -1) {
                sonIdler.push(id);
                if (sonIdler.length > maxId) sonIdler = sonIdler.slice(-maxId);
            }

            saveTrackedIds();

            sayaçTakip[id].timeout = setTimeout(function() {
                sayaçTakip[id].aktif = false;
                sayaçTakip[id].timeout = null;
                otomatikMesajGonder(id);
            }, sayaçSüresi);
        }

        function sayaçDurdur(yeniId) {
            if (!yeniId) return;

            var id = String(yeniId);
            if (sayaçTakip[id] && sayaçTakip[id].timeout) {
                clearTimeout(sayaçTakip[id].timeout);
                sayaçTakip[id].timeout = null;
            }
            if (sayaçTakip[id]) {
                sayaçTakip[id].aktif = false;
            }
            sonIdler = sonIdler.filter(function(x) { return x !== id; });
            saveTrackedIds();
        }

        function otomatikMesajGonder(targetId) {
            var mesajlar = (configData && configData.sayacmesaj && Array.isArray(configData.sayacmesaj)) ? configData.sayacmesaj : [];
            var id = String(targetId || '');
            if (!mesajlar.length || !id) return;

            var rastMsg = mesajlar[Math.floor(Math.random() * mesajlar.length)];
            if (rastMsg) {
                sendResponse(id, rastMsg, undefined, undefined, 'SAYAÇ');
            }

            delete sayaçTakip[id];
            sonIdler = sonIdler.filter(function(x) { return x !== id; });
            saveTrackedIds();
        }
        
        var BENIM_ID = '';
        var istenmeyenIdler = [];
        var processCooldown = 2000;
        
        var Function0 = Java.use('kotlin.jvm.functions.Function0');
        var Function2 = Java.use('kotlin.jvm.functions.Function2');
        
        var onSuccess = Java.registerClass({
            name: 'com.example.OnSuccess',
            implements: [Function0],
            methods: {
                invoke: function() {
                    return null;
                }
            }
        }).$new();
        
        var onFailure = Java.registerClass({
            name: 'com.example.OnFailure',
            implements: [Function2],
            methods: {
                invoke: function(p1, p2) {
                    return null;
                }
            }
        }).$new();

        var configData = {};

        function normalizeText(text) {
            return String(text || "")
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/ı/g,"i").replace(/ş/g,"s").replace(/ğ/g,"g").replace(/ü/g,"u").replace(/ö/g,"o").replace(/ç/g,"c")
                .replace(/[^\p{L}\p{N}\s]/gu,"")
                .replace(/\s+/g," ")
                .trim();
        }

        // Terminalde uzun/çok satırlı içerikleri tek satır ve okunabilir gösterir.
        // Yalnızca log biçimini etkiler; mesaj veya ayar verisini değiştirmez.
        function terminalText(value, maxLen) {
            var s = String(value === null || value === undefined ? '' : value)
                .replace(/\s+/g, ' ')
                .trim();
            var limit = parseInt(maxLen || 120);
            if (!limit || limit < 20) limit = 120;
            return s.length > limit ? s.substring(0, limit - 3) + '...' : s;
        }
        var OTO_MESAJLAR=[
"hey","heey","heyy","heyyy","heyyyy","selaam","selaaam","selaaaam","selam","slm",
"merhaba","merhabaa","merhabaaa","merhabaaaa","nasilsin","naber","nbr",
"seni buralarda gormek guzel",
"isleri ilginc tutalim sohbet etmeye hazir misin",
"bugun sirin hissediyor musun cunku gercekten oyle gorunuyorsun",
"bugun sirin hissediyor musun",
"gercekten oyle gorunuyorsun",
"yemin ederim o gulumsemeyi daha once bir yerde gormustum ah evet ruyalarimda",
"yemin ederim o gulumsemeyi",
"ah evet ruyalarimda"
].map(normalizeText);

        function isOtoMesajText(content) {
            var normalized = normalizeText(content);
            if (!content || normalized === '') return true;
            if (normalized.indexOf('system') !== -1 || normalized.indexOf('earn') !== -1) return true;
            if (OTO_MESAJLAR.indexOf(normalized) !== -1) return true;
            try {
                var ekstra = (configData && configData.otoMesajTetikleyiciler && Array.isArray(configData.otoMesajTetikleyiciler)) ? configData.otoMesajTetikleyiciler : [];
                for (var i = 0; i < ekstra.length; i++) {
                    var e = normalizeText(ekstra[i]);
                    if (e && normalized.indexOf(e) !== -1) return true;
                }
            } catch (e) {}
            // Uygulamanın otomatik yakınlık/mesafe mesajları soru cevabı sayılmasın.
            // Örnek: "aramızda 1 km var" konum cevabı değildir; soru sırasını ilerletmez.
            if (/\byasca\s+yakin\b/.test(normalized)) return true;
            if (/\baramizda\s*\d+\s*(km|kilometre|metre|m)\s*var\b/.test(normalized)) return true;
            if (/^\d+\s*(km|kilometre|metre|m)\s*(var|uzakta|yakin)?$/.test(normalized)) return true;
            return false;
        }


        function canProcess(senderId) {
            var now = Date.now();
            if (!processState[senderId]) {
                processState[senderId] = { isProcessing: false, lastProcessTime: 0 };
            }
            if (processState[senderId].isProcessing) {
                return false;
            }
            if (now - processState[senderId].lastProcessTime < processCooldown) {
                return false;
            }
            processState[senderId].isProcessing = true;
            processState[senderId].lastProcessTime = now;
            return true;
        }

        function finishProcessing(senderId) {
            if (processState[senderId]) {
                processState[senderId].isProcessing = false;
            }
        }
        
        function L(msg) {
            try {
                console.log('[FRIDA_MSG] ' + JSON.stringify(msg));
            } catch (e) {
                console.log('[FRIDA_MSG] ' + String(msg));
            }
        }

        function runOnNewThread(fn) {
            var Thread = Java.use('java.lang.Thread');
            var Runnable = Java.use('java.lang.Runnable');
            var runnable = Java.registerClass({
                name: 'com.example.FridaRunnable_' + Date.now() + '_' + Math.floor(Math.random() * 99999),
                implements: [Runnable],
                methods: {
                    run: function() {
                        try {
                            fn();
                        } catch(e) {
                            console.log('[Thread] Hata: ' + e);
                        }
                    }
                }
            }).$new();
            Thread.$new(runnable).start();
        }
        
        function loadAppConfig() {
            try {
                var File = Java.use('java.io.File');
                var FileInputStream = Java.use('java.io.FileInputStream');
                var BufferedReader = Java.use('java.io.BufferedReader');
                var InputStreamReader = Java.use('java.io.InputStreamReader');
                var file = File.$new('/data/local/tmp/ayarlar.json');
                if (!file.exists()) {
                    throw new Error('ayarlar.json bulunamadı!');
                }
                var fis = FileInputStream.$new(file);
                var isr = InputStreamReader.$new(fis, 'UTF-8');
                var br = BufferedReader.$new(isr);
                var line;
                var content = '';
                while ((line = br.readLine()) !== null) { content += line; }
                br.close(); isr.close(); fis.close();
                return JSON.parse(content);
            } catch (e) {
                L({err: 'ayarlar.json okunamadı, script durduruluyor', details: String(e)});
                throw e;
            }
        }
        
        var lastConfigSnapshot = '';
        var configAutoReloadTimer = null;

        function applySettings(settings, initialLoad) {
            if (!settings) throw new Error('ayarlar.json zorunlu!');
            configData = settings;

            if (settings.processCooldown !== undefined) {
                var pc = parseInt(settings.processCooldown);
                if (!isNaN(pc) && pc >= 0) processCooldown = pc;
            }

            if (settings.own_id !== undefined) {
                BENIM_ID = String(settings.own_id || '');
            }

            if (Array.isArray(settings.istenmeyenKisiler)) {
                istenmeyenIdler = settings.istenmeyenKisiler.map(String);
            } else {
                istenmeyenIdler = [];
            }

            if (initialLoad) {
                restoreTrackedIds();
                saveTrackedIds();
            }
        }

        function loadAllSettings(initialLoad) {
            try {
                var settings = loadAppConfig();
                applySettings(settings, initialLoad !== false);
                lastConfigSnapshot = JSON.stringify(settings);
                L({msg: 'Ayarlar yüklendi', cooldown: processCooldown, own_id: BENIM_ID});
                return configData;
            } catch (e) {
                L({err: 'Ayarlar yüklenemedi, script durdu', details: String(e)});
                throw e;
            }
        }

        function startConfigAutoReload() {
            if (configAutoReloadTimer) return;
            configAutoReloadTimer = setInterval(function() {
                Java.perform(function() {
                    try {
                        var settings = loadAppConfig();
                        var snapshot = JSON.stringify(settings);
                        if (snapshot === lastConfigSnapshot) return;

                        applySettings(settings, false);
                        lastConfigSnapshot = snapshot;

                        // Başlangıçta kapalı olup sonradan açılan özellikler de canlı devreye girebilsin.
                        try { if (configData.kaderPopupOtomatikKapatVeEngelle !== false) installKaderPopupAutoBlock(); } catch (e) {}
                        try { if (configData.kaderPopupBlockSignalAktif !== false) installKaderBlockSignalWatcher(); } catch (e) {}

                        L({msg: 'Ayarlar CANLI güncellendi', cooldown: processCooldown, own_id: BENIM_ID});
                    } catch (e) {
                        // Editör dosyayı yazarken oluşabilecek geçici yarım JSON'da eski ayarla devam et.
                        console.log('[CANLI AYAR] Yeni ayar henüz okunamadı; mevcut ayar korunuyor: ' + e);
                    }
                });
            }, 750);
        }


        // ========== KADER / YETERSİZ BAKİYE POPUP: GERÇEK X + SESSİZ ENGEL ==========
        // APK 2.19.1 hedefi: com.dd.base.weight.dialog.PayNewDialog
        // Kapatma ve engelleme birbirinden bağımsızdır: BLOCK tarafında hata olsa bile X hook'u çalışmaya devam eder.
        var kaderPopupHookKuruldu = false;
        var kaderPopupKurulumDeneniyor = false;
        var kaderPopupIslenenUidler = {};
        var kaderPopupBlockViewModel = null;
        var kaderPopupWatchdog = null;

        // V5: Python'daki kesin popup tespiti ile Frida BLOCK işlemini birbirine bağlar.
        // Popup kapanırken Python yalnızca bir sinyal dosyası günceller. Gerçek hedef UID,
        // botun kendi sendResponse() çağrısından tutulur; ekrandan/koordinattan UID tahmini yapılmaz.
        var kaderBlockSignalFile = '/data/local/tmp/amar_kader_block.signal';
        var kaderBlockSignalLast = '';
        var kaderBlockSignalWatcher = null;
        var kaderLastSendTargetUid = '';
        var kaderLastSendTargetAt = 0;
        var kaderLastNativeSendTargetUid = '';
        var kaderLastNativeSendTargetAt = 0;
        var kaderLastPopupUid = '';
        var kaderLastPopupAt = 0;
        var kaderLastPeerUid = '';
        var kaderLastPeerAt = 0;
        var kaderBlockOverloadLoglandi = false;
        var kaderNativeSendHookKuruldu = false;
        var kaderPopupFactoryHookKuruldu = false;
        // Çoklu Kader: her farklı UID kaybolmadan sırayla işlenir.
        var kaderBlockQueue = [];
        var kaderBlockQueued = {};
        var kaderBlockBusy = false;


        function kaderRememberSendTarget(uid) {
            uid = String(uid || '').trim();
            if (!uid || uid === '0') return;
            kaderLastSendTargetUid = uid;
            kaderLastSendTargetAt = Date.now();
        }

        function kaderRememberNativeSendTarget(uid, source) {
            uid = String(uid || '').trim();
            if (!uid || uid === '0') return;
            if (BENIM_ID && uid === String(BENIM_ID)) return;
            kaderLastNativeSendTargetUid = uid;
            kaderLastNativeSendTargetAt = Date.now();
        }

        function kaderRememberPopupUid(uid, source) {
            uid = String(uid || '').trim();
            if (!uid || uid === '0') return;
            if (BENIM_ID && uid === String(BENIM_ID)) return;
            kaderLastPopupUid = uid;
            kaderLastPopupAt = Date.now();
            console.log('[KADER-BLOCK] PayNewDialog gerçek UID önbelleğe alındı uid=' + uid + ' kaynak=' + (source || 'dialog'));
        }

        function kaderRememberPeer(uid) {
            uid = String(uid || '').trim();
            if (!uid || uid === '0') return;
            kaderLastPeerUid = uid;
            kaderLastPeerAt = Date.now();
        }

        function kaderReadSmallFile(path) {
            try {
                var File = Java.use('java.io.File');
                var FileInputStream = Java.use('java.io.FileInputStream');
                var InputStreamReader = Java.use('java.io.InputStreamReader');
                var BufferedReader = Java.use('java.io.BufferedReader');
                var file = File.$new(path);
                if (!file.exists()) return '';
                var fis = FileInputStream.$new(file);
                var isr = InputStreamReader.$new(fis, 'UTF-8');
                var br = BufferedReader.$new(isr);
                var line = br.readLine();
                br.close(); isr.close(); fis.close();
                return line ? String(line).trim() : '';
            } catch (e) {
                return '';
            }
        }

        function kaderSelectSignalTarget() {
            var now = Date.now();
            var popupMaxAge = 180000;
            var nativeSendMaxAge = 120000;
            var sendMaxAge = 120000;
            var peerMaxAge = 300000;
            try {
                if (configData && configData.kaderPopupBlockPopupUidMs !== undefined) {
                    var p = parseInt(configData.kaderPopupBlockPopupUidMs);
                    if (!isNaN(p) && p >= 5000 && p <= 600000) popupMaxAge = p;
                }
                if (configData && configData.kaderPopupBlockNativeGonderimMs !== undefined) {
                    var n = parseInt(configData.kaderPopupBlockNativeGonderimMs);
                    if (!isNaN(n) && n >= 5000 && n <= 600000) nativeSendMaxAge = n;
                }
                if (configData && configData.kaderPopupBlockSonGonderimMs !== undefined) {
                    var a = parseInt(configData.kaderPopupBlockSonGonderimMs);
                    if (!isNaN(a) && a >= 3000 && a <= 600000) sendMaxAge = a;
                }
                if (configData && configData.kaderPopupBlockSonKisiMs !== undefined) {
                    var b = parseInt(configData.kaderPopupBlockSonKisiMs);
                    if (!isNaN(b) && b >= 5000 && b <= 600000) peerMaxAge = b;
                }
            } catch (e) {}

            // Eski kod sabit öncelik kullanıyordu ve ilk popup UID'si 180 sn boyunca
            // yeni kullanıcıların önüne geçebiliyordu. Geçerli adaylar arasından
            // timestamp'i EN YENİ olan kişiyi seç.
            var candidates = [];
            function addCandidate(uid, at, maxAge, source) {
                uid = String(uid || '').trim();
                at = Number(at || 0);
                if (!uid || uid === '0' || !at) return;
                var age = now - at;
                if (age < 0 || age > maxAge) return;
                candidates.push({ uid: uid, source: source, age: age, at: at });
            }

            addCandidate(kaderLastPopupUid, kaderLastPopupAt, popupMaxAge, 'paynewdialog-uid');
            addCandidate(kaderLastNativeSendTargetUid, kaderLastNativeSendTargetAt, nativeSendMaxAge, 'native-sendTextMsg');
            addCandidate(kaderLastSendTargetUid, kaderLastSendTargetAt, sendMaxAge, 'last-send');
            addCandidate(kaderLastPeerUid, kaderLastPeerAt, peerMaxAge, 'last-peer');

            if (!candidates.length) return null;
            candidates.sort(function(a, b) { return b.at - a.at; });
            return { uid: candidates[0].uid, source: candidates[0].source, age: candidates[0].age };
        }

        function kaderClearTargetCache(uid) {
            uid = String(uid || '').trim();
            if (!uid) return;
            if (String(kaderLastPopupUid || '') === uid) { kaderLastPopupUid = ''; kaderLastPopupAt = 0; }
            if (String(kaderLastNativeSendTargetUid || '') === uid) { kaderLastNativeSendTargetUid = ''; kaderLastNativeSendTargetAt = 0; }
            if (String(kaderLastSendTargetUid || '') === uid) { kaderLastSendTargetUid = ''; kaderLastSendTargetAt = 0; }
            if (String(kaderLastPeerUid || '') === uid) { kaderLastPeerUid = ''; kaderLastPeerAt = 0; }
        }


        function installKaderBlockSignalWatcher() {
            if (kaderBlockSignalWatcher) return;
            if (configData && configData.kaderPopupBlockSignalAktif === false) {
                console.log('[KADER-BLOCK] Python popup sinyal watcher ayarlardan kapalı.');
                return;
            }

            // Script ilk bağlandığında eski sinyali işleme; sadece bundan sonraki değişiklikleri al.
            try { kaderBlockSignalLast = kaderReadSmallFile(kaderBlockSignalFile); } catch (e) {}

            kaderBlockSignalWatcher = setInterval(function() {
                Java.perform(function() {
                    try {
                        if (configData && configData.kaderPopupBlockSignalAktif === false) return;
                        var token = kaderReadSmallFile(kaderBlockSignalFile);
                        if (!token || token === kaderBlockSignalLast) return;
                        kaderBlockSignalLast = token;

                        var target = kaderSelectSignalTarget();
                        if (!target || !target.uid) {
                            console.log('[KADER-BLOCK] Popup sinyali geldi fakat güncel hedef UID yok token=' + token);
                            return;
                        }

                        console.log('[KADER-BLOCK] Popup sinyali -> uid=' + target.uid + ' kaynak=' + target.source + ' ageMs=' + target.age);
                        kaderSilentBlock(target.uid, 'signal-' + target.source);
                    } catch (e) {
                        console.log('[KADER-BLOCK] Sinyal watcher hata: ' + e);
                    }
                });
            }, 75);

            console.log('[✓] KADER-BLOCK Python sinyal watcher aktif');
        }

        function useClassAnyLoader(className) {
            try {
                return Java.use(className);
            } catch (firstErr) {
                var loaders = [];
                try { loaders = Java.enumerateClassLoadersSync(); } catch (e) {}
                for (var i = 0; i < loaders.length; i++) {
                    try {
                        loaders[i].findClass(className);
                        var factory = Java.ClassFactory.get(loaders[i]);
                        return factory.use(className);
                    } catch (e) {}
                }
                throw firstErr;
            }
        }

        function installKaderNativeSendTargetHook() {
            if (kaderNativeSendHookKuruldu) return;
            try {
                var MessageSendUtilsKader = useClassAnyLoader('com.immomo.biz.module_im_api.im.MessageSendUtils');
                var sendOverloads = MessageSendUtilsKader.sendTextMsg.overloads || [];
                if (!sendOverloads.length) throw new Error('sendTextMsg overload bulunamadı');

                for (var i = 0; i < sendOverloads.length; i++) {
                    (function(ov, idx) {
                        ov.implementation = function() {
                            try {
                                var remote = '';
                                try {
                                    if (arguments.length > 2 && arguments[2] !== null && arguments[2] !== undefined) {
                                        remote = String(arguments[2]).trim();
                                    }
                                } catch (e) {}

                                if (!/^\d{5,}$/.test(remote) || (BENIM_ID && remote === String(BENIM_ID))) {
                                    remote = '';
                                    var limit = Math.min(arguments.length, 6);
                                    for (var ai = 0; ai < limit; ai++) {
                                        try {
                                            var candidate = String(arguments[ai] === null || arguments[ai] === undefined ? '' : arguments[ai]).trim();
                                            if (/^\d{5,}$/.test(candidate) && (!BENIM_ID || candidate !== String(BENIM_ID))) {
                                                remote = candidate;
                                            }
                                        } catch (e) {}
                                    }
                                }

                                if (remote) kaderRememberNativeSendTarget(remote, 'sendTextMsg#' + idx);
                            } catch (capErr) {
                                console.log('[KADER-BLOCK] sendTextMsg hedef yakalama hata: ' + capErr);
                            }
                            return ov.apply(this, arguments);
                        };
                    })(sendOverloads[i], i);
                }

                kaderNativeSendHookKuruldu = true;
                console.log('[✓] KADER-BLOCK global MessageSendUtils.sendTextMsg hedef hook aktif overload=' + sendOverloads.length);
            } catch (e) {
                console.log('[KADER-BLOCK] global sendTextMsg hedef hook kurulamadı: ' + e);
            }
        }

        function installKaderPopupFactoryHook() {
            if (kaderPopupFactoryHookKuruldu) return;
            var hooked = 0;

            function hookFactoryClass(className) {
                try {
                    var C = useClassAnyLoader(className);
                    if (!C.newInstance) return;
                    var ovs = C.newInstance.overloads || [];
                    for (var i = 0; i < ovs.length; i++) {
                        (function(ov, idx, cn) {
                            ov.implementation = function() {
                                var result = ov.apply(this, arguments);
                                try {
                                    var uid = '';
                                    try { uid = kaderDialogUid(result); } catch (e) {}
                                    if (!uid) {
                                        for (var ai = 0; ai < arguments.length; ai++) {
                                            try {
                                                var candidate = String(arguments[ai] === null || arguments[ai] === undefined ? '' : arguments[ai]).trim();
                                                if (/^\d{5,}$/.test(candidate) && (!BENIM_ID || candidate !== String(BENIM_ID))) {
                                                    uid = candidate;
                                                    break;
                                                }
                                            } catch (e) {}
                                        }
                                    }
                                    if (uid) kaderRememberPopupUid(uid, cn + '.newInstance#' + idx);
                                } catch (e) {
                                    console.log('[KADER-BLOCK] PayNewDialog factory uid yakalama hata: ' + e);
                                }
                                return result;
                            };
                        })(ovs[i], i, className);
                        hooked++;
                    }
                } catch (e) {}
            }

            hookFactoryClass('com.dd.base.weight.dialog.PayNewDialog');
            hookFactoryClass('com.dd.base.weight.dialog.PayNewDialog$Companion');

            if (hooked > 0) {
                kaderPopupFactoryHookKuruldu = true;
                console.log('[✓] KADER-BLOCK PayNewDialog newInstance UID hook aktif overload=' + hooked);
            } else {
                console.log('[KADER-BLOCK] PayNewDialog newInstance UID hook henüz kurulamadı');
            }
        }

        function kaderDialogUid(dialog) {
            try {
                var args = dialog.getArguments();
                if (!args) return '';
                var uidObj = args.getString('uid');
                return uidObj ? uidObj.toString().trim() : '';
            } catch (e) {
                return '';
            }
        }

        function kaderDialogClose(dialog, view, source) {
            try {
                var closedByClick = false;
                var closeView = null;
                var rootView = view;

                if (!rootView) {
                    try { rootView = dialog.getView(); } catch (e) {}
                }

                if (rootView) {
                    try {
                        var context = rootView.getContext();
                        var resources = context.getResources();
                        var packageName = context.getPackageName();
                        var closeId = resources.getIdentifier('close', 'id', packageName);

                        // APK 2.19.1'de @id/close = 0x7f0a01fa. getIdentifier başarısızsa bu yalnızca yedek.
                        if (!closeId) closeId = 0x7f0a01fa;

                        closeView = rootView.findViewById(closeId);
                        if (closeView) {
                            try {
                                closedByClick = !!closeView.performClick();
                                console.log('[KADER] X performClick=' + closedByClick + ' kaynak=' + source + ' id=' + closeId);
                            } catch (clickErr) {
                                console.log('[KADER] X performClick hata kaynak=' + source + ': ' + clickErr);
                            }
                        } else {
                            console.log('[KADER] @id/close view bulunamadı kaynak=' + source + ' id=' + closeId);
                        }
                    } catch (findErr) {
                        console.log('[KADER] X view arama hatası kaynak=' + source + ': ' + findErr);
                    }
                }

                // performClick true dönse bile listener popup'ı gerçekten kapatmamış olabilir.
                // Çok kısa bir süre sonra dialog hâlâ ekliyse Fragment API üzerinden kapat.
                setTimeout(function() {
                    Java.perform(function() {
                        Java.scheduleOnMainThread(function() {
                            try {
                                var stillAdded = false;
                                var stillVisible = false;
                                try { stillAdded = !!dialog.isAdded(); } catch (e) {}
                                try {
                                    var dv = dialog.getView();
                                    stillVisible = dv ? !!dv.isShown() : false;
                                } catch (e) {}

                                if (stillAdded || stillVisible) {
                                    try {
                                        dialog.dismissAllowingStateLoss();
                                        console.log('[KADER] X sonrası zorunlu dismiss kaynak=' + source);
                                    } catch (e1) {
                                        try {
                                            dialog.dismiss();
                                            console.log('[KADER] X sonrası dismiss kaynak=' + source);
                                        } catch (e2) {
                                            console.log('[KADER] Popup kapatma tamamen başarısız kaynak=' + source + ': ' + e2);
                                        }
                                    }
                                }
                            } catch (e) {}
                        });
                    });
                }, 120);

                return true;
            } catch (e) {
                console.log('[KADER] kaderDialogClose hata: ' + e);
                return false;
            }
        }

        function kaderGetBlockViewModel(callback) {
            var vmClassName = 'com.immomo.biz.module_accout.profile.model.NewUserProfileViewModel';

            // Her Kader kişisi için önce YENİ ViewModel oluştur. İlk kişiden kalan
            // lifecycle/state ikinci kullanıcıyı etkilemesin.
            try {
                var VM = useClassAnyLoader(vmClassName);
                var fresh = VM.$new();
                if (fresh) {
                    kaderPopupBlockViewModel = fresh;
                    callback(fresh);
                    return;
                }
            } catch (freshErr) {
                // $new mümkün değilse uygulamadaki canlı instance'a düş.
            }

            var finished = false;
            try {
                Java.choose(vmClassName, {
                    onMatch: function(instance) {
                        if (finished) return;
                        finished = true;
                        kaderPopupBlockViewModel = instance;
                        callback(instance);
                    },
                    onComplete: function() {
                        if (finished) return;
                        finished = true;
                        callback(null);
                    }
                });
            } catch (chooseErr) {
                callback(null);
            }
        }

        function kaderFinishBlock(remoteUid) {
            try { delete kaderBlockQueued[String(remoteUid || '')]; } catch (e) {}
            kaderPopupBlockViewModel = null;
            kaderBlockBusy = false;
            // Sonraki kişi geldiyse aynı Kader oturumunda otomatik devam et.
            setTimeout(function() { kaderProcessBlockQueue(); }, 30);
        }

        function kaderEnqueueBlock(remoteUid, source) {
            remoteUid = String(remoteUid || '').trim();
            if (!remoteUid || remoteUid === '0') return;
            if (BENIM_ID && remoteUid === String(BENIM_ID)) return;

            // Aynı UID aynı popup için onViewCreated/onResume/ADB sinyalinden birkaç kez gelebilir.
            // Aynı UID'yi tekilleştir; FARKLI UID'ler hiçbir zaman birbirini engellemez.
            if (!kaderBlockQueued[remoteUid]) {
                kaderBlockQueued[remoteUid] = true;
                kaderBlockQueue.push({ uid: remoteUid, source: String(source || 'kader'), at: Date.now() });
            }
            kaderProcessBlockQueue();
        }

        function kaderProcessBlockQueue() {
            if (kaderBlockBusy) return;
            if (!kaderBlockQueue.length) return;

            var item = kaderBlockQueue.shift();
            var uid = String(item.uid || '').trim();
            if (!uid) {
                kaderBlockBusy = false;
                setTimeout(function() { kaderProcessBlockQueue(); }, 0);
                return;
            }

            kaderBlockBusy = true;
            kaderSilentBlockNow(uid, item.source);
        }

        // Dışarıdaki tüm eski çağrılar artık kuyruğa girer.
        function kaderSilentBlock(remoteUid, source) {
            kaderEnqueueBlock(remoteUid, source || 'legacy');
        }

        function kaderSilentBlockNow(remoteUid, triggerSource) {
            remoteUid = String(remoteUid || '').trim();
            if (!remoteUid || remoteUid === '0') return;

            var now = Date.now();
            var cooldownMs = 15000;
            try {
                if (configData && configData.kaderPopupEngelCooldownMs !== undefined) {
                    var parsedCooldown = parseInt(configData.kaderPopupEngelCooldownMs);
                    if (!isNaN(parsedCooldown) && parsedCooldown >= 1000) cooldownMs = parsedCooldown;
                }
            } catch (e) {}

            // Aynı UID için peş peşe gelen aynı Kader olayını tekrar bloklama.
            // Farklı UID'ler birbirinden tamamen bağımsızdır ve anında işlenir.
            if (kaderPopupIslenenUidler[remoteUid] && (now - kaderPopupIslenenUidler[remoteUid]) < cooldownMs) {
                kaderFinishBlock(remoteUid);
                return;
            }
            kaderPopupIslenenUidler[remoteUid] = now;

            try {
                if (istenmeyenIdler.indexOf(remoteUid) === -1) istenmeyenIdler.push(remoteUid);
            } catch (e) {}

            // KADER ANINDA ENGEL: herhangi bir ekstra setTimeout / ayar gecikmesi yok.
            // UID yakalandığı çağrıda doğrudan engelleme zincirine gir.
            Java.perform(function() {
                try {
                    var localUid = '';
                    try {
                        var UserManager = useClassAnyLoader('com.dd.base.user.UserManager');
                        var localObj = UserManager.getInstance().getUserId();
                        if (localObj !== null) localUid = localObj.toString().trim();
                    } catch (userErr) {
                        console.log('[KADER] UserManager uid hatası: ' + userErr);
                    }
                    if (!localUid && BENIM_ID) localUid = String(BENIM_ID).trim();

                    if (!localUid || localUid === '0') {
                        console.log('[KADER] Local UID alınamadı; BLOCK gönderilmedi remote=' + remoteUid);
                        delete kaderPopupIslenenUidler[remoteUid];
                        kaderFinishBlock(remoteUid);
                        return;
                    }
                    if (localUid === remoteUid) {
                        delete kaderPopupIslenenUidler[remoteUid];
                        kaderFinishBlock(remoteUid);
                        return;
                    }

                    // Her yeni kullanıcıda güncel ViewModel instance'ını seç.
                    kaderPopupBlockViewModel = null;
                    kaderGetBlockViewModel(function(vm) {
                        if (!vm) {
                            console.log('[KADER] BLOCK için ViewModel yok remote=' + remoteUid);
                            delete kaderPopupIslenenUidler[remoteUid];
                            kaderFinishBlock(remoteUid);
                            return;
                        }
                        try {
                            var blockCalled = false;
                            var blockMethod = vm.addUserRelation;
                            var ovs = blockMethod.overloads || [];

                            for (var oi = 0; oi < ovs.length; oi++) {
                                var ats = ovs[oi].argumentTypes || [];
                                if (ats.length === 3 &&
                                    ats[0].className === 'java.lang.String' &&
                                    ats[1].className === 'java.lang.String' &&
                                    ats[2].className === 'java.lang.String') {
                                    ovs[oi].call(vm, localUid, remoteUid, '2');
                                    blockCalled = true;
                                    break;
                                }
                            }
                            if (!blockCalled) {
                                vm.addUserRelation(localUid, remoteUid, '2');
                            }

                            console.log('[KADER-BLOCK] ANINDA BLOCK çağrıldı local=' + localUid + ' remote=' + remoteUid + ' type=2');
                            kaderClearTargetCache(remoteUid);
                            console.log('[KADER-BLOCK] KUYRUK BLOCK çağrıldı remote=' + remoteUid + ' kaynak=' + (triggerSource || 'kader'));
                            kaderFinishBlock(remoteUid);
                        } catch (blockErr) {
                            console.log('[KADER-BLOCK] ANINDA BLOCK hata: ' + blockErr);
                            delete kaderPopupIslenenUidler[remoteUid];
                            kaderFinishBlock(remoteUid);
                        }
                    });
                } catch (e) {
                    console.log('[KADER] ANINDA BLOCK genel hata: ' + e);
                    try { delete kaderPopupIslenenUidler[remoteUid]; } catch (x) {}
                    kaderFinishBlock(remoteUid);
                }
            });
        }

        function kaderHandleDialog(dialog, view, source) {
            try {
                if (configData && configData.kaderPopupOtomatikKapatVeEngelle === false) return;
                var remoteUid = kaderDialogUid(dialog);
                console.log('[KADER] PayNewDialog yakalandı kaynak=' + source + ' uid=' + (remoteUid || 'BOS'));
                if (remoteUid) kaderRememberPopupUid(remoteUid, 'lifecycle-' + source);

                // UID yakalandığı anda ÖNCE engelleme zincirini başlat. Popup kapanınca
                // profil/ViewModel lifecycle'ı değişse bile BLOCK fırsatı kaçmasın.
                if (remoteUid && remoteUid !== '0') {
                    kaderSilentBlock(remoteUid, 'popup-' + source);
                }

                // Engel çağrısını başlattıktan hemen sonra popup'ı kapat.
                kaderDialogClose(dialog, view, source);
            } catch (e) {
                console.log('[KADER] kaderHandleDialog hata kaynak=' + source + ': ' + e);
            }
        }

        function installKaderPopupAutoBlock() {
            if (kaderPopupHookKuruldu || kaderPopupKurulumDeneniyor) return;
            if (configData && configData.kaderPopupOtomatikKapatVeEngelle === false) {
                console.log('[KADER] Otomatik kapat + sessiz engel ayarlardan kapalı.');
                return;
            }

            kaderPopupKurulumDeneniyor = true;
            try {
                var PayNewDialog = useClassAnyLoader('com.dd.base.weight.dialog.PayNewDialog');

                // X hook'u BLOCK ViewModel hazırlanmasından tamamen bağımsız kurulur.
                try {
                    var onViewCreated = PayNewDialog.onViewCreated.overload('android.view.View', 'android.os.Bundle');
                    onViewCreated.implementation = function(view, bundle) {
                        var result = onViewCreated.call(this, view, bundle);
                        try { kaderHandleDialog(this, view, 'onViewCreated'); } catch (e) {}
                        return result;
                    };
                    console.log('[KADER] onViewCreated hook kuruldu');
                } catch (e) {
                    console.log('[KADER] onViewCreated hook kurulamadı: ' + e);
                }

                // Lifecycle ikinci emniyet: onViewCreated kaçarsa onResume'da kapat.
                try {
                    var onResume = PayNewDialog.onResume.overload();
                    onResume.implementation = function() {
                        var result = onResume.call(this);
                        try { kaderHandleDialog(this, this.getView(), 'onResume'); } catch (e) {}
                        return result;
                    };
                    console.log('[KADER] onResume hook kuruldu');
                } catch (e) {
                    console.log('[KADER] onResume hook kurulamadı: ' + e);
                }

                kaderPopupHookKuruldu = true;
                kaderPopupKurulumDeneniyor = false;

                // Frida popup açıldıktan sonra attach olduysa mevcut instance'ı da yakala.
                if (!kaderPopupWatchdog) {
                    kaderPopupWatchdog = setInterval(function() {
                        Java.perform(function() {
                            try {
                                Java.choose('com.dd.base.weight.dialog.PayNewDialog', {
                                    onMatch: function(instance) {
                                        try {
                                            var added = false;
                                            var shown = false;
                                            try { added = !!instance.isAdded(); } catch (e) {}
                                            try {
                                                var v = instance.getView();
                                                shown = v ? !!v.isShown() : false;
                                            } catch (e) {}
                                            if (added || shown) kaderHandleDialog(instance, instance.getView(), 'watchdog');
                                        } catch (e) {}
                                    },
                                    onComplete: function() {}
                                });
                            } catch (e) {}
                        });
                    }, 700);
                }

                console.log('[✓] Kader PayNewDialog: X + lifecycle + watchdog + sessiz BLOCK aktif');
            } catch (e) {
                kaderPopupKurulumDeneniyor = false;
                console.log('[!] Kader PayNewDialog hook henüz kurulamadı: ' + e);
            }
        }

        // Dynamic/split class loader geç hazır olursa otomatik tekrar dene.
        setInterval(function() {
            try {
                if (!kaderPopupHookKuruldu && (!configData || configData.kaderPopupOtomatikKapatVeEngelle !== false)) {
                    Java.perform(function() { installKaderPopupAutoBlock(); });
                }
            } catch (e) {}
        }, 2000);

        // Split/dynamic loader nedeniyle hedef sınıflar geç gelirse UID hook'larını da tekrar kur.
        setInterval(function() {
            try {
                Java.perform(function() {
                    if (!kaderNativeSendHookKuruldu) installKaderNativeSendTargetHook();
                    if (!kaderPopupFactoryHookKuruldu) installKaderPopupFactoryHook();
                });
            } catch (e) {}
        }, 2000);

        // Geçmiş sistemi kaldırıldı: JS tarafında geçmiş tutulmaz veya diske yazılmaz.

        // ========== YENİ: MESAJ TİPLERİ İÇİN HAZIR CEVAPLAR ==========
        var MESAJ_TIPI_CEVAPLARI = {
            // Sesli mesaj cevapları (3-5 sn bekleme + random)
            sesli: [
                "Sesini tam seçemedim biraz daha yavaş konuşabilir misin",
                "Ses kaydın geldi ama bazı yerleri anlayamadım tekrar söyler misin",
                "Biraz cızırtılı geldi yeniden gönderebilir misin",
                "Sesin çok kısık geldi ne dediğini tam çıkaramadım",
                "Kaydı dinledim ama son kısmını anlayamadım tekrar eder misin",
                "Sesli mesajın geldi ama biraz boğuk duyuluyor",
                "Galiba bağlantıdan dolayı sesin kesik kesik geldi",
                "Seni duydum ama söylediklerini tam anlayamadım bir daha söyler misin",
                "Ses kaydın biraz kısa ve karışık geldi tekrar atabilir misin",
                "Sesini net alamadım istersen yazıyla da söyleyebilirsin",
                "Kaydın geldi ama arka plandaki seslerden anlayamadım",
                "Biraz daha yakından konuşup tekrar yollar mısın",
                "Sesli mesajın açıldı ama bazı kelimeleri kaçırdım",
                "Ne dediğini merak ettim ama ses biraz karışmış tekrar söyler misin",
                "Sesin geliyor ama çok düşük biraz daha yüksek konuşabilir misin",
                "Kaydı birkaç kez dinledim ama tam çıkaramadım",
                "Ses mesajında ufak bir kesilme olmuş galiba tekrar atar mısın",
                "Başını duydum ama devamı pek anlaşılmadı",
                "Son söylediğini kaçırdım bir daha söyler misin",
                "Sesin biraz uzaktan geliyor tekrar gönderir misin",
                "Kaydın geldi ama ses çok net değil ne demiştin",
                "Bir an anlayamadım tekrar sesli söyler misin",
                "Sesini duydum ama kelimeler biraz birbirine girmiş",
                "Ses kaydında bir sorun olmuş olabilir yeniden atabilir misin",
                "Söylediğini tam çözemedim istersen kısa kısa yazabilirsin",
                "Sesli mesaj biraz hızlı geldi tekrar ama biraz yavaş söyler misin",
                "Kaydın sonuna doğru ses kayboluyor ne demiştin",
                "Ses biraz yankılı geldi o yüzden anlayamadım",
                "Seni dinledim ama bir kısmını kaçırmışım tekrar eder misin",
                "Sesin güzel geliyor ama söylediklerini tam seçemedim",
                "Kaydı aldım fakat ortasında ses kesilmiş gibi",
                "Bir daha gönderirsen dikkatlice dinlerim",
                "Sesli mesajında ne dediğini merak ettim ama net duyamadım",
                "Galiba mikrofon biraz uzakta kalmış ses düşük geliyor",
                "Bir kısmını anladım ama tamamını anlayamadım tekrar söyler misin",
                "Ses kaydın gelmiş ama bende biraz bozuk oynuyor",
                "Tekrar ses atabilir misin bu sefer daha net gelir belki",
                "Sesin kesilmiş gibi geldi son söylediğini tekrarlar mısın",
                "Biraz hızlı konuştun galiba yetişemedim",
                "Sesli mesajını dinledim ama ne dediğinden emin olamadım"
            ],
            // Fotoğraf cevapları (3-5 sn bekleme + random)
            fotograf: [
                 "Fotoğrafın bende açılmadı galiba tekrar atabilir misin",
                "Resim geldi görünüyor ama içeriğini göremiyorum",
                "Fotoğraf yüklenmemiş olabilir yeniden göndermeyi dener misin",
                "Ne gönderdiğini merak ettim ama fotoğraf görünmüyor",
                "Fotoğrafı açamadım bana biraz anlatsana",
                "Resim bende boş görünüyor tekrar yollar mısın",
                "Sanırım fotoğraf düzgün yüklenmedi bir daha atabilir misin",
                "Fotoğraf geldi bildirimi var ama görüntü yok",
                "Ne fotoğrafıydı o bende açılmadı",
                "Fotoğrafını göremedim tekrar göndermeyi dener misin",
                "Galiba görsel tarafında bir sorun oldu bana ulaşmadı",
                "Resmi görmek istedim ama maalesef açılmıyor",
                "Gönderdiğin fotoğraf bende görüntülenmiyor",
                "Fotoğraf sanki yarım yüklenmiş tekrar atar mısın",
                "Görsel gelmiş ama bende sadece boş ekran çıkıyor",
                "Merak ettim şimdi fotoğrafı bir daha yollar mısın",
                "Resim açılmadı ne olduğunu söyle bari",
                "Fotoğrafı göremiyorum ama çok merak ettim",
                "Sanırım bağlantıda bir problem oldu fotoğraf ulaşmadı",
                "Bir daha atabilir misin ilk fotoğraf açılmadı",
                "Fotoğrafın görünmüyor istersen yeniden gönder",
                "Resim bende yüklenmeye takılmış gibi duruyor",
                "Fotoğrafı açmaya çalıştım ama olmadı",
                "Görsel görünmedi ne göndermiştin",
                "Fotoğrafın için bildirim geldi ama kendisi gelmedi",
                "Bende resim açılmıyor tekrar göndersen olur mu",
                "Fotoğraf kaybolmuş gibi bir daha yollar mısın",
                "Gönderdiğin görseli göremedim anlatmak ister misin",
                "Ne attığını merak ettim ama resim bende açılmadı",
                "Fotoğrafı tekrar gönderir misin sanırım ilkinde hata oldu",
                "Görsel yükleniyor gibi kalıyor açılmıyor",
                "Fotoğraf gelmedi galiba yeniden dener misin",
                "Resim tarafında bir sorun var sanırım bende görünmüyor",
                "Fotoğrafını görebilsem yorum yapacaktım ama açılmadı",
                "Bir fotoğraf gönderdin sanırım ama bana görüntü gelmedi",
                "Görsel bende siyah ekran olarak çıkıyor tekrar atabilir misin",
                "Resim yüklenmemiş gibi görünüyor ne vardı fotoğrafta",
                "Fotoğrafını tekrar yollasana merak ettim",
                "Gönderdiğin şeyi göremiyorum fotoğraf mıydı",
                "Fotoğraf açılmadı ama şimdi iyice merak ettim",
                "Görseli yeniden gönderirsen tekrar bakayım",
                "Bende fotoğraf kısmı çalışmadı galiba tekrar atar mısın",
                "Fotoğraf görünmüyor istersen ne olduğunu yazıyla anlat",
                "Resmi göremedim tekrar gönderirsen sevinirim",
                "Fotoğraf bana ulaşmış gibi ama görüntüsü açılmıyor",
                "Bir sorun olmuş galiba gönderdiğin fotoğraf görünmüyor",
                "Görseli göremiyorum ama eminim güzel bir şey gönderdin",
                "Fotoğrafı yeniden atabilir misin ilk gönderdiğin açılmadı",
                "Resim bende yüklenemedi bir daha dener misin",
                "Gönderdiğin fotoğrafın ne olduğunu çok merak ettim"
            ],
            // Oto mesaj / Hi mesajı cevapları (normal işlem, bekleme yok)
            otomesaj: [
                "pempe pıttımı görmek istiyorsan ara canım ",
                
            ],
            // Bilinmeyen/Diğer mesajlar için flört cevapları
            diger: [
                "Canım naber? 😊",
                "Nasılsın canım?",
                "Selam güzelim, iyi misin?",
                "Heyy, nasıl gidiyor? 💫",
                "Merhaba tatlım, sohbet edelim mi?"
            ]
        };
        
        function mesajTipiCevapHavuzu() {
            var out = {
                sesli: MESAJ_TIPI_CEVAPLARI.sesli.slice(),
                fotograf: MESAJ_TIPI_CEVAPLARI.fotograf.slice(),
                otomesaj: MESAJ_TIPI_CEVAPLARI.otomesaj.slice(),
                diger: MESAJ_TIPI_CEVAPLARI.diger.slice()
            };
            try {
                var cfg = (configData && (configData.mesajTipiCevaplari || configData.mesaj_tipi_cevaplari)) || {};
                var cfgOtoMesajVar = Array.isArray(cfg.otomesaj) && cfg.otomesaj.length > 0;
                if (Array.isArray(cfg.sesli) && cfg.sesli.length) out.sesli = cfg.sesli.slice();
                if (Array.isArray(cfg.fotograf) && cfg.fotograf.length) out.fotograf = cfg.fotograf.slice();
                if (Array.isArray(cfg.foto) && cfg.foto.length) out.fotograf = cfg.foto.slice();
                if (cfgOtoMesajVar) out.otomesaj = cfg.otomesaj.slice();
                if (Array.isArray(cfg.diger) && cfg.diger.length) out.diger = cfg.diger.slice();

                // Eski ayarlarla uyumluluk: mesajTipiCevaplari.otomesaj yoksa
                // soruOncesiOtoMesaj tek metin veya liste olarak kullanılabilir.
                if (!cfgOtoMesajVar && configData && configData.soruOncesiOtoMesaj) {
                    if (Array.isArray(configData.soruOncesiOtoMesaj)) {
                        out.otomesaj = configData.soruOncesiOtoMesaj.slice();
                    } else {
                        out.otomesaj = [String(configData.soruOncesiOtoMesaj)];
                    }
                }
            } catch (e) {}
            out.sesli = out.sesli.map(String).filter(function(x) { return x.trim().length > 0; });
            out.fotograf = out.fotograf.map(String).filter(function(x) { return x.trim().length > 0; });
            out.otomesaj = out.otomesaj.map(String).filter(function(x) { return x.trim().length > 0; });
            out.diger = out.diger.map(String).filter(function(x) { return x.trim().length > 0; });
            if (!out.sesli.length) out.sesli = ['sesli mesajı net alamadım canım yazıyla söyler misin'];
            if (!out.fotograf.length) out.fotograf = ['fotoğraf bende açılmadı canım yazıyla anlatır mısın'];
            if (!out.otomesaj.length) out.otomesaj = ['merhaba canım'];
            if (!out.diger.length) out.diger = ['canım yazıyla söyler misin'];
            return out;
        }

        // Rastgele bekleme fonksiyonu (3-5 saniye)
        function randomBekleme() {
            var minSn = 3000;  // 3 saniye
            var maxSn = 5000;  // 5 saniye
            var beklemeMs = Math.floor(Math.random() * (maxSn - minSn + 1)) + minSn;
            var Thread = Java.use('java.lang.Thread');
            Thread.sleep(beklemeMs);
        }
        
        function rastgeleTekrarsizCevap(senderId, havuz) {
            // Geçmiş tutulmadığı için havuzdan doğrudan rastgele seç.
            if (!Array.isArray(havuz) || !havuz.length) return '';
            return String(havuz[Math.floor(Math.random() * havuz.length)] || '');
        }

        // YENİ: Mesaj tipine göre cevap seç ve gönder
        function tipineGoreCevapGonder(senderId, mesajTipi, orijinalIcerik, ekSoru) {
            var cevap = null;
            var cevapHavuzu = mesajTipiCevapHavuzu();
            
            switch(mesajTipi) {
                case 'sesli':
                    randomBekleme();  // 3-5 saniye bekle
                    cevap = rastgeleTekrarsizCevap(senderId, cevapHavuzu.sesli);
                    break;
                    
                case 'fotograf':
                    randomBekleme();  // 3-5 saniye bekle
                    cevap = rastgeleTekrarsizCevap(senderId, cevapHavuzu.fotograf);
                    break;
                    
                case 'otomesaj':
                    randomBekleme();
                    cevap = rastgeleTekrarsizCevap(senderId, cevapHavuzu.otomesaj);
                    break;
                    
                case 'diger':
                default:
                    cevap = rastgeleTekrarsizCevap(senderId, cevapHavuzu.diger);
                    break;
            }
            
            if (cevap) {
                try {
                    if (ekSoru && String(ekSoru).trim().length > 0) {
                        cevap = String(cevap).replace(/\s+$/g, '') + ' ' + String(ekSoru).trim();
                    }
                } catch (e) {}
                sendResponse(senderId, cevap, undefined, undefined, 'HAZIR');
            }
        }
        
        // GELİŞMİŞ: Mesaj bilgilerini çıkar (Foto, Ses, Text, Hi)
        function extractRichInfo(msg) {
            var info = {
                from: '',
                content: '',
                msgType: 'normal',  // normal, fotograf, sesli, otomesaj
                timestamp: 0,
                fileUrl: '',
                raw: null
            };
            
            try {
                // Gönderen ID
                if (msg.from) {
                    try { info.from = String(msg.from.value); } catch(e) {}
                }
                
                // Zaman
                if (msg.time) {
                    try { info.timestamp = msg.time.value; } catch(e) {}
                }
                
                // messageType kontrolü (en önemli kısım!)
                var messageType = null;
                try { messageType = msg.messageType.value; } catch(e) {}
                try { if (!messageType) messageType = msg.msgType.value; } catch(e) {}
                
                
                // messageType = 3 -> FOTOĞRAF
                if (messageType === 3) {
                    info.msgType = 'fotograf';
                    try { info.fileUrl = String(msg.fileUrl.value); } catch(e) {}
                    info.content = '[Fotoğraf mesajı]';
                }
                // messageType = 4 -> SESLİ MESAJ
                else if (messageType === 4) {
                    info.msgType = 'sesli';
                    try { info.fileUrl = String(msg.fileUrl.value); } catch(e) {}
                    var mediaTime = 0;
                    try { mediaTime = msg.mediaTime.value; } catch(e) {}
                    info.content = '[Sesli mesaj - ' + (mediaTime/1000) + ' saniye]';
                }
                // messageType = 2 -> TEXT veya OTO MESAJ
                else if (messageType === 2) {
                    var content = '';
                    try { content = String(msg.content.value); } catch(e) {}
                    
                    // Oto mesaj/Hi kontrolü (content boş veya sistem mesajı içeriyorsa)
                    var normalized=normalizeText(content);
                    if (!content || normalized==="" || normalized.indexOf('system')!==-1 || normalized.indexOf('earn')!==-1 || OTO_MESAJLAR.indexOf(normalized)!==-1) {
                        info.msgType = 'otomesaj';
                        info.content = content && String(content).trim().length ? content : '[Otomatik mesaj]';
                    } else {
                        info.msgType = 'normal';
                        info.content = content;
                    }
                }
                // Diğer bilinmeyen tipler
                else {
                    info.msgType = 'diger';
                    info.content = '[Bilinmeyen mesaj tipi: ' + messageType + ']';
                }
                
            } catch(e) {
                console.log('[Extract Error] ' + e);
            }
            
            return info;
        }
        
        function isUnwantedSender(senderId) {
            var unwanted = (configData && configData.istenmeyenIdler) || istenmeyenIdler;
            return Array.isArray(unwanted) && unwanted.indexOf(String(senderId)) !== -1;
        }


        function getAiBaseUrl() {
            try {
                var b = '';
                if (configData && configData.ai_base_url) b = String(configData.ai_base_url);
                else if (configData && configData.ai_http_port) b = 'http://10.0.2.2:' + String(configData.ai_http_port);
                else b = 'http://10.0.2.2:5986';
                if (b.charAt(b.length - 1) === '/') b = b.substring(0, b.length - 1);
                return b;
            } catch (e) { return 'http://10.0.2.2:5986'; }
        }

        function callLocalAi(senderId, messageText) {
            try {
                var URL = Java.use('java.net.URL');
                var HttpURLConnection = Java.use('java.net.HttpURLConnection');
                var BufferedReader = Java.use('java.io.BufferedReader');
                var InputStreamReader = Java.use('java.io.InputStreamReader');
                var JavaString = Java.use('java.lang.String');

                var urlObj = URL.$new(getAiBaseUrl() + '/chat');
                var conn = urlObj.openConnection();
                conn = Java.cast(conn, HttpURLConnection);
                conn.setRequestMethod('POST');
                conn.setRequestProperty('Content-Type', 'application/json; charset=utf-8');
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(60000);
                conn.setDoOutput(true);

                var payload = JSON.stringify({ account_id: String(BENIM_ID || ''), user_id: String(senderId || ''), message: String(messageText || '') });
                var os = conn.getOutputStream();
                var bytes = JavaString.$new(payload).getBytes('UTF-8');
                os.write(bytes);
                os.flush();
                os.close();

                var code = conn.getResponseCode();
                var is = (code >= 200 && code < 300) ? conn.getInputStream() : conn.getErrorStream();
                var response = '';
                if (is) {
                    var br = BufferedReader.$new(InputStreamReader.$new(is, 'UTF-8'));
                    var line;
                    while ((line = br.readLine()) !== null) response += line;
                    br.close();
                    is.close();
                }
                conn.disconnect();
                if (code < 200 || code >= 300) {
                    console.log('[AI] HTTP hata ' + code + ': ' + response);
                    return '';
                }
                var parsed = JSON.parse(response || '{}');
                return String(parsed.answer || '').trim();
            } catch (e) {
                console.log('[AI] Yerel AI çağrı hatası: ' + e);
                return '';
            }
        }

        function aiCevapGonder(senderId, messageContent) {
            // AI cevabı hazır olduktan SONRA ayrıca 2-4 saniye bekle.
            // Böylece DeepInfra ne kadar hızlı cevap verirse versin mesaj anında gönderilmez.
            var aiMinMs = 2000;
            var aiMaxMs = 4000;
            try {
                if (configData && configData.ai_cevap_min_ms !== undefined) {
                    var cfgMin = parseInt(configData.ai_cevap_min_ms);
                    if (!isNaN(cfgMin) && cfgMin >= 0) aiMinMs = cfgMin;
                }
                if (configData && configData.ai_cevap_max_ms !== undefined) {
                    var cfgMax = parseInt(configData.ai_cevap_max_ms);
                    if (!isNaN(cfgMax) && cfgMax >= aiMinMs) aiMaxMs = cfgMax;
                }
            } catch (e) {}

            var cevap = callLocalAi(senderId, messageContent);
            if (!cevap) {
                try {
                    var fallbackList = (configData && Array.isArray(configData.aiFallbackMesajlari)) ? configData.aiFallbackMesajlari : [];
                    if (fallbackList.length) {
                        cevap = String(fallbackList[Math.floor(Math.random() * fallbackList.length)] || '').trim();
                    } else {
                        cevap = (configData && configData.aiFallbackMesaji) ? String(configData.aiFallbackMesaji) : 'seni anlayamadım canım';
                    }
                } catch (e) { cevap = 'şu an tam toparlayamadım canım'; }
            }

            sendResponse(senderId, cevap, aiMinMs, aiMaxMs, 'AI');
            // AI hafızası yalnızca Python RAM içinde tutulur; diske geçmiş yazılmaz.
        }
        function sendResponse(kisiId, response, delayMinMs, delayMaxMs, terminalSource) {
            try {
                // Kader popup'ı bu gönderim yüzünden açılırsa Python sinyali geldiğinde
                // engellenecek gerçek karşı UID tam olarak budur.
                try { kaderRememberSendTarget(kisiId); } catch (e) {}
                var kelimeSayisi = 0;
                if (typeof response === 'string') {
                    kelimeSayisi = response.trim().split(/\s+/).length;
                }
                var minMs;
                var maxMs;
                if (typeof delayMinMs === 'number' && typeof delayMaxMs === 'number') {
                    minMs = Math.max(0, Math.floor(delayMinMs));
                    maxMs = Math.max(minMs, Math.floor(delayMaxMs));
                } else {
                    minMs = 700 + Math.max(0, kelimeSayisi - 1) * 200;
                    maxMs = 1200 + Math.max(0, kelimeSayisi - 1) * 500;
                }
                var beklemeMs = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
                var startTime = Date.now();
                var Thread = Java.use('java.lang.Thread');
                Thread.sleep(beklemeMs);

                var MessageSendUtils = Java.use('com.immomo.biz.module_im_api.im.MessageSendUtils');
                var instance = MessageSendUtils.$new();
                instance.sendTextMsg(
                    "msg_" + Date.now(),
                    BENIM_ID,
                    kisiId,
                    response,
                    "Turkey",
                    "2",
                    "1",
                    -1,
                    "from_msgList_msg",
                    1,
                    false,
                    null,
                    null,
                    Java.use('java.util.HashMap').$new(),
                    onSuccess,
                    onFailure
                );
                var elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
                var src = String(terminalSource || 'HAZIR').toUpperCase();
                console.log('\n[ YANIT • ' + src + ' ✓ ]\n  ├─ ID      : ' + kisiId + '\n  ├─ Bekleme : ' + elapsed + ' sn\n  └─ Cevap   : ' + terminalText(response, 120) + '\n');
            } catch (e) {
                console.log('[HATA][GÖNDERİM] ID=' + kisiId + ' | ' + e);
            }
        }
        
        // === ANA MESAJ DİNLEME (GÜNCELLENMİŞ) ===
        try {
            var ReceivedMsg = Java.use('com.immomo.biz.module_db.bean.AmarReceivedImSessionAndMessage');
            var originalGetMessage = ReceivedMsg.getMessage.overload();
            
            originalGetMessage.implementation = function() {
                var msg = originalGetMessage.call(this);
                if (msg) {
                    try {
                        // Gelişmiş bilgi çıkarımı
                        var info = extractRichInfo(msg);
                        var senderId = info.from || '';
                        var messageContent = info.content;
                        var msgType = info.msgType;
                        try { kaderRememberPeer(senderId); } catch (e) {}
                        
                        // Kendi mesajını engelle
                        if (BENIM_ID && String(senderId) === String(BENIM_ID)) {
                            return msg;
                        }
                        
                        // Engelli kullanıcı kontrolü
                        if (isUnwantedSender(senderId)) {
                            return msg;
                        }
                        
                        // Boş/geçersiz mesaj kontrolü
                        if (!senderId || senderId === '') {
                            return msg;
                        }
                        
                        // Aynı mesajın tekrar işlenmesini engelle
                        var msgKey = senderId + '_' + msgType + '_' + String(info.timestamp || '') + '_' + normalizeText(messageContent).substring(0, 80);
                        if (globalMessageContent[msgKey]) {
                            return msg;
                        }
                        globalMessageContent[msgKey] = Date.now();
                        try {
                            var nowClean = Date.now();
                            for (var oldKey in globalMessageContent) {
                                if (nowClean - globalMessageContent[oldKey] > 10 * 60 * 1000) delete globalMessageContent[oldKey];
                            }
                        } catch (e) {}
                        
                        // Mesaj gönderen kullanıcı ID'sini kaydet ve 300 saniyelik sayacı başlat/yenile.
                        // Süre dolunca ayarlar.json içindeki sayacmesaj listesinden tek mesaj gönderilir.
                        sayaçSıfırlaVeBaşlat(senderId);

                        // İşlem cooldown kontrolü. Aynı kullanıcı için önceki cevap hâlâ hazırlanıyorsa
                        // uzun teknik log yerine tek kompakt satır göster.
                        if (!canProcess(senderId)) {
                            console.log('\n[ ATLANDI • MEŞGUL ]\n  ├─ ID      : ' + senderId + '\n  └─ İçerik  : ' + terminalText(messageContent, 100) + '\n');
                            return msg;
                        }

                        // Bilinmeyen/atlanacak tipleri iki ayrı blokta göstermemek için sadece işlenen mesajları burada yaz.
                        if (msgType !== 'diger') {
                            console.log('\n[ MESAJ • ' + String(msgType || '').toUpperCase() + ' ]\n  ├─ ID      : ' + senderId + '\n  └─ Gelen   : ' + terminalText(messageContent, 140));
                        }
                        
                        // FOTOĞRAF / SESLİ MESAJ: hazır cevap gönder
                        if (msgType === 'fotograf' || msgType === 'sesli') {
                            runOnNewThread(function() {
                                try { tipineGoreCevapGonder(senderId, msgType, messageContent, ''); }
                                catch (e) { console.log('[MEDIA] Cevap hatası: ' + e); }
                                finishProcessing(senderId);
                            });
                            return msg;
                        }

                        // OTO MESAJ: sabit oto cevap
                        if (msgType === 'otomesaj' || (msgType === 'normal' && isOtoMesajText(messageContent))) {
                            runOnNewThread(function() {
                                try { tipineGoreCevapGonder(senderId, 'otomesaj', messageContent, ''); }
                                catch (e) { console.log('[OTO] Cevap hatası: ' + e); }
                                finishProcessing(senderId);
                            });
                            return msg;
                        }

                        // NORMAL MESAJ: Python üzerinden DeepInfra servisine gönder
                        if (msgType === 'normal' && configData && configData.normalMesajAiAktif !== false) {
                            runOnNewThread(function() {
                                try { aiCevapGonder(senderId, messageContent); }
                                catch (e) { console.log('[AI] Cevap hatası: ' + e); }
                                finishProcessing(senderId);
                            });
                            return msg;
                        }

                        console.log('\n[ ATLANDI • ' + String(msgType || '').toUpperCase() + ' ]\n  ├─ ID      : ' + senderId + '\n  └─ İçerik  : ' + terminalText(messageContent, 100) + '\n');
                        finishProcessing(senderId);
                        return msg;

                    } catch (innerErr) {
                        console.log('[HATA][MESAJ] ' + innerErr);
                        try { finishProcessing(); } catch(e) {}
                    }
                }
                return msg;
            };
            
            console.log('[SİSTEM] Mesaj dinleme aktif | hazır cevap + DeepInfra AI');
        } catch (e) {
            console.log('[!] Message hook hatası: ' + e);
        }
        
        // Ayarları yükle
        try {
            loadAllSettings(true);
            startConfigAutoReload();
            installKaderPopupAutoBlock();
            installKaderNativeSendTargetHook();
            installKaderPopupFactoryHook();
            installKaderBlockSignalWatcher();
        } catch (e) {
            console.log('[!] Ayarlar hatası: ' + e);
        }
        
        // === ARAMA BİLDİRİMİ ===
        try {
            var processedCalls = new Set();
            
            function tapWithDelay(x, y) {
                runOnNewThread(function() {
                    try {
                        var Thread = Java.use('java.lang.Thread');
                        console.log('[⏰] 4.5 saniye bekleniyor...');
                        Thread.sleep(4500);
                        for (var i = 0; i < 2; i++) {
                            console.log('[👆] TIKLANIYOR... (' + x + ',' + y + ') - ' + (i+1) + '. deneme');
                            var Runtime = Java.use('java.lang.Runtime');
                            Runtime.getRuntime().exec(['input', 'tap', x.toString(), y.toString()]);
                            Thread.sleep(800);
                        }
                    } catch(e) {
                        console.log('[!] Tıklama hatası: ' + e);
                    }
                });
            }
            
            setTimeout(function() {
                try {
                    var NotifyHelper = Java.use('com.immomo.biz.ddoversea.utils.NotifyHelper');
                    if (NotifyHelper.showNotification) {
                        var overloads = NotifyHelper.showNotification.overloads;
                        for (var i = 0; i < overloads.length; i++) {
                            overloads[i].implementation = function() {
                                var result = this.showNotification.apply(this, arguments);
                                try {
                                    for (var k = 0; k < arguments.length; k++) {
                                        if (arguments[k] && arguments[k].toString().indexOf('davet ediyor') !== -1) {
                                            console.log('\n[📞] ARAMA DAVETİ YAKALANDI!');
                                            tapWithDelay(500, 790);
                                            break;
                                        }
                                    }
                                } catch(e) {}
                                return result;
                            };
                        }
                    }
                } catch(e) {
                    console.log('[!] NotifyHelper hook hatası: ' + e);
                }
            }, 2000);
            
        } catch(e) {
            console.log('[!] Arama modülü hatası: ' + e);
        }
        
    } catch(e) {
        console.log('[!] FATAL HATA: ' + e);
    }
});
