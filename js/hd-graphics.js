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

    var toolbarBound = false, settingsKeys = {};

    function settingsElements() {
        var toolbar = document.getElementById('baye-hd-toolbar');
        return { toolbar: toolbar,
            toggle: toolbar && toolbar.querySelector('[data-hd-settings-toggle]'),
            panel: document.getElementById('baye-hd-settings-panel') };
    }

    function setSettingsOpen(open, restoreFocus) {
        var ui = settingsElements();
        if (!ui.toggle || !ui.panel) { return; }
        ui.panel.hidden = !open;
        ui.toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (!open && restoreFocus && typeof ui.toggle.focus === 'function') {
            ui.toggle.focus({ preventScroll: true });
        }
    }

    function contains(node, target) {
        if (!node || !target) { return false; }
        for (var current = target; current; current = current.parentNode) {
            if (current === node) { return true; }
        }
        return false;
    }

    function settingsKey(event) {
        var ui = settingsElements();
        if (!ui.toolbar || !ui.panel || !ui.toggle) { return; }
        var inside = contains(ui.toolbar, event.target), open = !ui.panel.hidden;
        var token = event.code || String(event.keyCode || event.key), held = !!settingsKeys[token];
        if (!open && !held) { return; }
        if (event.type === 'keydown') { settingsKeys[token] = true; }
        else if (event.type === 'keyup') { delete settingsKeys[token]; }
        // Run before the HD battle/window and classic/document keyboard paths.
        // Leave native button activation intact, but never forward display
        // settings keys to the current game input owner.
        event.stopPropagation();
        if (event.stopImmediatePropagation) { event.stopImmediatePropagation(); }
        var key = event.key || ({ 9: 'Tab', 27: 'Escape' })[event.keyCode];
        if (event.type === 'keydown' && key === 'Escape' && open) {
            event.preventDefault();
            setSettingsOpen(false, true);
        } else if (event.type === 'keydown' && key === 'Tab' && open) {
            var controls = [ui.toggle], buttons = ui.panel.querySelectorAll('button');
            for (var i = 0; i < buttons.length; i++) {
                if (!buttons[i].disabled && !buttons[i].hidden) { controls.push(buttons[i]); }
            }
            var index = controls.indexOf(document.activeElement);
            if (index < 0 || event.shiftKey && index === 0 || !event.shiftKey && index === controls.length - 1) {
                event.preventDefault();
                controls[event.shiftKey ? controls.length - 1 : 0].focus({ preventScroll: true });
            }
        } else if (event.type === 'keydown' && !inside) {
            event.preventDefault();
        }
    }

    // Register at script load, before the other PC overlays install their
    // window capture listeners. Mobile has no settings toolbar.
    if (typeof global.addEventListener === 'function') {
        global.addEventListener('keydown', settingsKey, true);
        global.addEventListener('keyup', settingsKey, true);
        global.addEventListener('pointerdown', function (event) {
            var ui = settingsElements();
            if (ui.panel && !ui.panel.hidden && !contains(ui.toolbar, event.target)) {
                setSettingsOpen(false, contains(ui.panel, document.activeElement));
            }
        }, true);
        global.addEventListener('blur', function () { settingsKeys = {}; setSettingsOpen(false, false); });
        global.addEventListener('pagehide', function () { settingsKeys = {}; setSettingsOpen(false, false); });
    }
    if (typeof document.addEventListener === 'function') {
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) { settingsKeys = {}; setSettingsOpen(false, false); }
        });
    }

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
            if (btn.hasAttribute('data-hd-settings-toggle')) {
                var panel = document.getElementById('baye-hd-settings-panel');
                if (panel) { setSettingsOpen(panel.hidden, false); }
                return;
            }
            if (btn.getAttribute('data-hd-scale')) {
                setScale(btn.getAttribute('data-hd-scale'));
            } else if (btn.getAttribute('data-hd-filter')) {
                setFilter(btn.getAttribute('data-hd-filter'));
            } else if (btn.getAttribute('data-hd-theme')) {
                setTheme(btn.getAttribute('data-hd-theme'));
            }
            var help = btn.hasAttribute('data-hd-settings-help');
            setSettingsOpen(false, !help);
            // H/S request a native help publication asynchronously. Release the
            // retired settings control now; the real dialog takes focus only
            // after its own publication has rendered.
            if (help && contains(toolbar, document.activeElement) &&
                typeof document.activeElement.blur === 'function') { document.activeElement.blur(); }
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
