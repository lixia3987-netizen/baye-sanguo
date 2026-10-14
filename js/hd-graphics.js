/**
 * PC 画质脚手架（CSS 整数倍放大 / 滤镜 / 外壳主题）。
 * 不改 WASM、不改 .lib 图块、不改战斗与大地图逻辑。
 * 键名与默认值见 docs/hd-graphics.md。
 */
(function (global) {
    var STORAGE = {
        scale: 'baye/lcdCssScale',
        filter: 'baye/lcdFilter',
        theme: 'baye/lcdTheme'
    };

    var CLASSIC_CSS_WIDTH = 480;

    function read(key, fallback) {
        try {
            var value = global.localStorage.getItem(key);
            if (value === null || value === '') {
                return fallback;
            }
            return value;
        } catch (e) {
            return fallback;
        }
    }

    function write(key, value) {
        try {
            global.localStorage.setItem(key, String(value));
        } catch (e) {}
    }

    function normalizeScale(value) {
        return String(value) === '2' ? '2' : '1';
    }

    function normalizeFilter(value) {
        return value === 'smooth' ? 'smooth' : 'crisp';
    }

    function normalizeTheme(value) {
        return value === 'hd' ? 'hd' : 'classic';
    }

    function getSettings() {
        return {
            scale: normalizeScale(read(STORAGE.scale, '1')),
            filter: normalizeFilter(read(STORAGE.filter, 'crisp')),
            theme: normalizeTheme(read(STORAGE.theme, 'classic'))
        };
    }

    function applyEarlyDocumentAttrs() {
        var settings = getSettings();
        var root = document.documentElement;
        root.style.setProperty('--baye-lcd-scale', settings.scale);
        root.setAttribute('data-baye-lcd-scale', settings.scale);
        root.setAttribute('data-baye-lcd-filter', settings.filter);
        root.setAttribute('data-baye-theme', settings.theme);
    }

    function applyTheme() {
        var settings = getSettings();
        var root = document.documentElement;
        root.setAttribute('data-baye-theme', settings.theme);
        if (document.body) {
            document.body.classList.toggle('baye-theme-hd', settings.theme === 'hd');
            document.body.classList.toggle('baye-theme-classic', settings.theme !== 'hd');
        }
    }

    function applyFilter() {
        var settings = getSettings();
        var lcd = document.getElementById('lcd');
        document.documentElement.setAttribute('data-baye-lcd-filter', settings.filter);
        if (!lcd) {
            return;
        }
        var smooth = settings.filter === 'smooth';
        if (typeof lcdBlur === 'function') {
            lcdBlur(smooth);
        } else {
            lcd.classList.toggle('no_blur', !smooth);
            lcd.classList.toggle('lcd-smooth', smooth);
        }
        lcd.classList.toggle('lcd-crisp', !smooth);
        lcd.classList.toggle('lcd-smooth', smooth);
    }

    function applyPcScale() {
        var settings = getSettings();
        var scale = parseInt(settings.scale, 10);
        var width = CLASSIC_CSS_WIDTH * scale;
        document.documentElement.style.setProperty('--baye-lcd-scale', String(scale));
        document.documentElement.setAttribute('data-baye-lcd-scale', String(scale));
        if (document.body) {
            document.body.classList.toggle('baye-lcd-scale-2', scale === 2);
            document.body.classList.toggle('baye-allow-scroll', scale === 2);
        }
        var nodes = document.querySelectorAll('.js-baye-pc-lcd, .js-baye-pc-chrome');
        for (var i = 0; i < nodes.length; i++) {
            nodes[i].style.width = width + 'px';
        }
        syncToolbar(settings);
    }

    function syncToolbar(settings) {
        var toolbar = document.getElementById('baye-hd-toolbar');
        if (!toolbar) {
            return;
        }
        var buttons = toolbar.querySelectorAll('[data-hd-scale], [data-hd-filter], [data-hd-theme]');
        for (var i = 0; i < buttons.length; i++) {
            var btn = buttons[i];
            var active = false;
            if (btn.getAttribute('data-hd-scale')) {
                active = btn.getAttribute('data-hd-scale') === settings.scale;
            } else if (btn.getAttribute('data-hd-filter')) {
                active = btn.getAttribute('data-hd-filter') === settings.filter;
            } else if (btn.getAttribute('data-hd-theme')) {
                active = btn.getAttribute('data-hd-theme') === settings.theme;
            }
            btn.classList.toggle('is-active', active);
            btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        }
    }

    function applyAfterLcdInit() {
        applyTheme();
        applyFilter();
    }

    function applyPcPage() {
        applyAfterLcdInit();
        applyPcScale();
        bindToolbar();
    }

    function setScale(value) {
        write(STORAGE.scale, normalizeScale(value));
        applyPcPage();
    }

    function setFilter(value) {
        write(STORAGE.filter, normalizeFilter(value));
        applyPcPage();
    }

    function setTheme(value) {
        write(STORAGE.theme, normalizeTheme(value));
        applyPcPage();
    }

    var toolbarBound = false;

    function bindToolbar() {
        var toolbar = document.getElementById('baye-hd-toolbar');
        if (!toolbar || toolbarBound) {
            return;
        }
        toolbarBound = true;
        toolbar.addEventListener('click', function (event) {
            var el = event.target;
            var btn = null;
            while (el && el !== toolbar) {
                if (el.tagName === 'BUTTON') {
                    btn = el;
                    break;
                }
                el = el.parentNode;
            }
            if (!btn) {
                return;
            }
            if (btn.getAttribute('data-hd-scale')) {
                setScale(btn.getAttribute('data-hd-scale'));
            } else if (btn.getAttribute('data-hd-filter')) {
                setFilter(btn.getAttribute('data-hd-filter'));
            } else if (btn.getAttribute('data-hd-theme')) {
                setTheme(btn.getAttribute('data-hd-theme'));
            }
        });
    }

    applyEarlyDocumentAttrs();

    global.BayeHd = {
        STORAGE: STORAGE,
        CLASSIC_CSS_WIDTH: CLASSIC_CSS_WIDTH,
        getSettings: getSettings,
        setScale: setScale,
        setFilter: setFilter,
        setTheme: setTheme,
        applyTheme: applyTheme,
        applyFilter: applyFilter,
        applyPcScale: applyPcScale,
        applyAfterLcdInit: applyAfterLcdInit,
        applyPcPage: applyPcPage,
        applyEarlyDocumentAttrs: applyEarlyDocumentAttrs
    };
})(window);
