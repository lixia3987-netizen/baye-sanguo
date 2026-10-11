var lcdWidth = 16*10;
var lcdHeight = 16*6;
var dotSize = 4;

function getLCD() {
    var canvas = document.getElementById('lcd');
    if (canvas.getContext === undefined) {
        alert("你的浏览器不支持HTML5");
    }
    var ctx = canvas.getContext('2d');
    return ctx;
}

function lcdBlur(blur) {
    var lcd = getLCD();
    if (blur) {
        lcd.imageSmoothingEnabled = true;
        $('#lcd').removeClass('no_blur')
    } else {
        lcd.imageSmoothingEnabled = false;
        $('#lcd').addClass('no_blur')
    }
}

function lcdInit()
{
    var width = 16*10;
    var height = 16*6;

    //分辨率
    switch (window.localStorage["baye/resolution"]) {
    case '0':
        width = 16*10;
        height = 16*6;
        break;
    case '1':
        width = 16*13;
        height = 16*8;
        break;
    }

    bayeResizeScreen(width, height);

    if (window.localStorage["baye/debug"] == '1') {
        _bayeSetDebug(1);
    }
    lcdBlur(false);
    baye_bridge_init();
    /* 不要在 lcdInit / postRun 里调用 _bayeGetGlobal：lib 尚未加载，
     * bind_init 会把 g_var.def 钉死，script_init 就无法再绑 HD 字段。 */
}

function bayeResizeScreen(width, height) {
    lcdWidth = width;
    lcdHeight = height;
    var canvas = document.getElementById('lcd');
    canvas.width = width * dotSize;
    canvas.height = height * dotSize
    _bayeSetLcdSize(lcdWidth, lcdHeight);
}

function imagePixel(img, i)
{
    img.data[i] = 0;
    img.data[i+1] = 0;
    img.data[i+2] = 0;
    img.data[i+3] = 255;
}

function imageDot(img, x, y, lineSize)
{
    var ind = lineSize*y + x;
    imagePixel(img, ind*4);
}

function lcdSetDotSize(s)
{
    var canvas = document.getElementById('lcd');
    dotSize = s;
    canvas.width = lcdWidth * dotSize;
    canvas.height = lcdHeight * dotSize
}

function lcdFlushBuffer(buffer) {
    var lcd = getLCD();
    var w = lcdWidth*dotSize;
    var h = lcdHeight*dotSize
    var nbytes = w * h * 4;
    var heap = (typeof wasmMemory !== 'undefined' && wasmMemory && wasmMemory.buffer) ? wasmMemory.buffer : null;
    buffer = Number(buffer) || 0;
    if (!heap || buffer <= 0 || nbytes <= 0 || buffer + nbytes > heap.byteLength) {
        console.error('[hd-bridge] lcd flush skipped', { buffer: buffer, nbytes: nbytes, heap: heap ? heap.byteLength : 0 });
        return;
    }

    var buffer_wrp = new Uint8ClampedArray(heap, buffer, nbytes);
    var img = new ImageData(buffer_wrp, w, h);
    lcd.putImageData(img, 0, 0);
    if (window.BayeHdSpe && typeof BayeHdSpe.onLcdFlush === 'function') {
        try { BayeHdSpe.onLcdFlush(img, w, h); } catch (e) {}
    }
}

function sendKey(key) {
    if('undefined' === typeof Module || ('undefined' === typeof Module.asm && 'undefined' === typeof wasmExports)){
        return;
	}
    _bayeSendKey(key);
}

var 		VK_PGUP =			0x20;
var 		VK_PGDN	=			0x21;
var 		VK_UP	=			0x22;
var 		VK_DOWN	=			0x23;
var 		VK_LEFT	=			0x24;
var 		VK_RIGHT=			0x25;
var 		VK_HELP	=			0x26;
var 		VK_ENTER=			0x27;
var 		VK_EXIT	=			0x28;

var 		VK_INSERT	=		0x30;
var 		VK_DEL		=		0x31;
var 		VK_MODIFY	=		0x32;
var 		VK_SEARCH	=		0x33;

// HD overlays and the classic handler share one keyboard event. Native form
// controls keep their keys, and an overlay that consumes a key owns it fully.
function bayeInputIgnored(event) {
    if (!event || event.defaultPrevented || event.returnValue === false ||
        event.isComposing || event.keyCode === 229) {
        return true;
    }
    var target = event.target || event.srcElement;
    for (var node = target; node; node = node.parentElement) {
        var tag = String(node.tagName || node.nodeName || '').toLowerCase();
        if (node.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select') {
            return true;
        }
        // Enter/Space already activate a focused native button. Let its click
        // handler send the command instead of also forwarding the keyboard key.
        if ((tag === 'button' && (event.keyCode === 13 || event.keyCode === 32)) ||
            (tag === 'a' && event.keyCode === 13)) {
            return true;
        }
    }
    return false;
}

function bayeConsumeKeyEvent(event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) {
        event.stopImmediatePropagation();
    }
}

function bayeQtyStepKeys(delta, qty) {
    delta = Number(delta);
    if (!qty || !qty.active || (delta !== -10 && delta !== -1 && delta !== 1 && delta !== 10)) {
        return [];
    }
    var value = Number(qty.value), min = Number(qty.min), max = Number(qty.max);
    if (!isFinite(value) || !isFinite(min) || !isFinite(max) ||
        min < 0 || max < min || max > 0xffffffff || value < min || value > max ||
        Math.floor(value) !== value || Math.floor(min) !== min || Math.floor(max) !== max) {
        return [];
    }
    var amount = Math.min(Math.abs(delta), delta > 0 ? max - value : value - min);
    if (!amount) {
        return [];
    }
    var keys = [], places = String(max).length - 1, i;
    if (qty.protocol) {
        // The native cursor describes its current arithmetic place. Do not
        // normalize it with no-op RIGHT keys when C can tell us where it is.
        if (!bayeQtyAckState(qty) || Number(qty.cursor) > places ||
            Number(qty.step) !== Math.pow(10, places - Number(qty.cursor))) {
            return [];
        }
        var target = amount === 10 ? places - 1 : places;
        var cursor = Number(qty.cursor);
        while (cursor < target) { keys.push(VK_RIGHT); cursor += 1; }
        while (cursor > target) { keys.push(VK_LEFT); cursor -= 1; }
        var change = delta > 0 ? VK_UP : VK_DOWN;
        if (amount === 10) {
            keys.push(change, VK_RIGHT);
        } else {
            for (i = 0; i < amount; i++) { keys.push(change); }
        }
        return keys;
    }
    // NumOperate starts at units, but keyboard/digit input may have moved the
    // cursor. RIGHT reaches units from any position (tactic.c::NumOperateInner).
    for (i = 0; i < places; i++) {
        keys.push(VK_RIGHT);
    }
    var direction = delta > 0 ? VK_UP : VK_DOWN;
    if (amount === 10) {
        keys.push(VK_LEFT, direction, VK_RIGHT);
    } else {
        // Near a bound, use units so +/-10 lands exactly on min/max.
        for (i = 0; i < amount; i++) {
            keys.push(direction);
        }
    }
    return keys;
}

function bayeQtyAckState(qty) {
    if (!qty || !qty.protocol) { return false; }
    var bounds = { session: 0xffffffff, inputSeq: 0xffffffff,
        lastKey: 0xffff, cursor: 9, step: 1000000000, ready: 1 };
    for (var name in bounds) {
        var value = Number(qty[name]);
        if (!isFinite(value) || value < 0 || value > bounds[name] || Math.floor(value) !== value) {
            return false;
        }
    }
    return Number(qty.session) > 0 && Number(qty.step) > 0;
}

// Wait for C's input boundary, or for one specific native character receipt.
// Only C advances the sequence; unchanged values and cursor no-ops still ACK.
var bayeQtyReceiptBarrier = null;
var bayeQtyClosedSession = 0;

function bayeQtyNativeClosed(qty) {
    return !!(qty && qty.protocol && qty.active && Number(qty.session) === bayeQtyClosedSession);
}

function bayeQtyCloseInput(qty) {
    if (qty && qty.protocol && qty.active && Number(qty.session) > 0) {
        bayeQtyClosedSession = Number(qty.session);
    }
}

function bayeQtyInputAck(code, owner, options, done) {
    var session = Number(owner && owner.session), sent = false, before = 0;
    var receipt = null;
    var finished = false, timer = 0, deadline = Date.now() + 2000;
    function finish(ok, reason, qty) {
        if (finished) { return; }
        finished = true;
        if (timer) { clearTimeout(timer); }
        done(ok, reason || '', qty);
    }
    function poll() {
        if (finished) { return; }
        var qty = options.read();
        if (!options.valid()) { finish(false, 'stale', qty); return; }
        if (!bayeQtyAckState(qty)) { finish(false, 'invalid', qty); return; }
        if (bayeQtyNativeClosed(qty)) { finish(false, 'closed', qty); return; }
        if (!Number(qty.active) || Number(qty.session) !== session) {
            finish(false, 'owner', qty); return;
        }
        if (!sent && bayeQtyReceiptBarrier) {
            var pending = bayeQtyReceiptBarrier;
            var pendingNext = pending.before === 0xffffffff ? 1 : pending.before + 1;
            if (pending.session !== session) {
                bayeQtyReceiptBarrier = null;
            } else if (pending.failed) {
                finish(false, 'receipt', qty); return;
            } else if (Number(qty.inputSeq) !== pending.before) {
                if (Number(qty.inputSeq) !== pendingNext || Number(qty.lastKey) !== pending.code) {
                    pending.failed = true;
                } else if (Number(qty.ready)) {
                    bayeQtyReceiptBarrier = null;
                }
            }
            if (bayeQtyReceiptBarrier === pending && pending.failed) { finish(false, 'receipt', qty); return; }
            if (bayeQtyReceiptBarrier) {
                if (Date.now() >= deadline) {
                    pending.failed = true;
                    finish(false, 'timeout', qty);
                    return;
                }
                timer = setTimeout(poll, 4);
                return;
            }
        }
        if (!sent && Number(qty.ready)) {
            if (code == null) { finish(true, '', qty); return; }
            before = Number(qty.inputSeq);
            sent = true;
            receipt = { session: session, before: before, code: code, failed: false };
            bayeQtyReceiptBarrier = receipt;
            try { options.send(code); } catch (error) {
                receipt.failed = true;
                finish(false, 'send', qty);
                return;
            }
            // Sending may synchronously run a mock or a native callback.
            poll();
            return;
        }
        if (sent && Number(qty.inputSeq) !== before) {
            var expected = before === 0xffffffff ? 1 : before + 1;
            if (Number(qty.inputSeq) !== expected || Number(qty.lastKey) !== code) {
                receipt.failed = true;
                finish(false, 'receipt', qty); return;
            }
            if (Number(qty.ready)) {
                if (bayeQtyReceiptBarrier === receipt) { bayeQtyReceiptBarrier = null; }
                finish(true, '', qty); return;
            }
        }
        if (Date.now() >= deadline) {
            if (receipt) { receipt.failed = true; }
            finish(false, 'timeout', qty); return;
        }
        timer = setTimeout(poll, 4);
    }
    poll();
    return function () {
        finished = true;
        if (timer) { clearTimeout(timer); }
    };
}

function bayeQtyKeyboardCode(keyCode) {
    if (keyCode >= 48 && keyCode <= 57) { return 0x40 + keyCode - 48; }
    return { 37: VK_LEFT, 38: VK_UP, 39: VK_RIGHT, 40: VK_DOWN,
        72: VK_HELP, 70: VK_SEARCH, 83: VK_SEARCH }[keyCode];
}

function onKeyDown(e) {
    var event = e?e:window.event;
    if (bayeInputIgnored(event)) {
        return;
    }

    switch (event.keyCode) {
        case 13:
            sendKey(VK_ENTER);
            break;
        case 72:
            sendKey(VK_HELP);
            break;
        case 70:
            sendKey(VK_SEARCH);
            break;
        case 83:
            sendKey(VK_SEARCH);
            break;
        case 32:
            sendKey(VK_EXIT);
            break;
        case 27:
            sendKey(VK_EXIT);
            break;
        case 38:
            sendKey(VK_UP);
            break;
        case 40:
            sendKey(VK_DOWN);
            break;
        case 37:
            sendKey(VK_LEFT);
            break;
        case 39:
            sendKey(VK_RIGHT);
            break;
        case 48: case 49: case 50: case 51: case 52:
        case 53: case 54: case 55: case 56: case 57:
            sendKey(0x40 + (event.keyCode - 48));
            break;
    }
}

function bin2hex (s) {

  var i, l, o = "", n;

  s += "";

  for (i = 0, l = s.length; i < l; i++) {
    n = s.charCodeAt(i).toString(16)
    o += n.length < 2 ? "0" + n : n;
  }

  return o;
}

function binarray2hex (arr) {

  var i, l, o = "", n;

  for (i = 0, l = arr.length; i < l; i++) {
    n = arr[i].toString(16)
    o += n.length < 2 ? "0" + n : n;
  }

  return o;
}

function clearLib(then) {
    window.localStorage.removeItem('baye//data/dat.lib');
    window.localStorage.removeItem('baye/libname');
    window.localStorage.removeItem('baye/libpath');
    libCacheClear(then);
}

function getLibName() {
    return window.BayeOriginalGame ? BayeOriginalGame.title : window.localStorage['baye/libname'] || "Unnamed";
}

if (typeof(Storage) === "undefined") {
    alert("你的浏览器不支持存档");
}


var layoutType = 0;
var keypadWidth = 250;


function layoutKeyboard() {
    var w = window.innerWidth
    var h = window.innerHeight

    if (h / w > lcdHeight/lcdWidth) {
        var availableHeight = h - w * lcdHeight/lcdWidth;
        var isCompatLayout = (layoutType == 1 || layoutType == 2);

        var kbWidth = isCompatLayout ? keypadWidth : w;

        var ratio = availableHeight / 3 / kbWidth * 100;
        if (ratio > 30) {
            ratio = 30;
        }

        $(".dummy30").css("margin-top", ratio + "%");
        $(".keypad").removeAttr("style");

        if (isCompatLayout) {
            $(".keypad").css("width", keypadWidth);
            if (layoutType == 1) {
                $(".keypad").css("float", 'right');
            } else {
                $(".keypad").css("float", 'left');
            }
        }

        if (layoutType == 3) {
            $("#keypad1").hide();
            $("#keypad2").show();
        } else {
            $("#keypad2").hide();
            $("#keypad1").show();
        }
    }
}

function saveKeyboardLayout() {
    window.localStorage['baye.kb.layout'] = String(layoutType);
}

function loadKeyboardLayout() {
    layoutType = parseInt(window.localStorage['baye.kb.layout']);
    if (!layoutType) {
        layoutType = 3;
    }
    layoutKeyboard();
}

function switchLayout() {
    layoutType += 1;
    layoutType %= 4;
    saveKeyboardLayout();
    layoutKeyboard();
}

loadKeyboardLayout();

String.prototype.format = function(args) {
    var result = this;
    if (arguments.length > 0) {
        if (arguments.length == 1 && typeof (args) == "object") {
            for (var key in args) {
                if(args[key]!=undefined){
                    var reg = new RegExp("({" + key + "})", "g");
                    result = result.replace(reg, args[key]);
                }
            }
        }
        else {
            for (var i = 0; i < arguments.length; i++) {
                if (arguments[i] != undefined) {
                    var reg = new RegExp("({[" + i + "]})", "g");
                    result = result.replace(reg, arguments[i]);
                }
            }
        }
    }
    return result;
}

function ajaxGet(path, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', path, true);
    xhr.responseType = 'blob';

    xhr.onload = function(e) {
      if (this.status == 200) {
        var blob = this.response;
        callback(blob);
      }
    };

    xhr.send();
}

var dynLib = null;

function libCacheClear(then) {
    var store = new IdbKvStore('baye');
    store.remove('lib', then);
}

function libCacheSet(data, then) {
    var store = new IdbKvStore('baye');
    store.set('lib', data, then);
}

function libCacheGet(ok, err) {
    var store = new IdbKvStore('baye')
    store.get('lib', function (e, value) {
        if (e) {
            console.log("no DB");
            err();
        } else if (value) {
            console.log(`lib found in DB, size=${value.length}`);
            dynLib = bin2hex(value);
            ok();
        } else {
            console.log("no lib in DB");
            err();
        }
    })
}

function loadLibFromUrl(url, then) {
    console.log("trying to load from DB");
    libCacheGet(then, () => {
        console.log("loading from " + url);
        ajaxGet(url, function(file){
            console.log("ajax ok");
            var reader = new FileReader();
            reader.onload = function() {
                libCacheSet(reader.result);
                dynLib = bin2hex(reader.result);
                console.log("read ok");
                then();
            }
            reader.readAsBinaryString(file);
        });
    });
}

function loadLib(files) {
    var reader = new FileReader();
    reader.onload = function() {
        libCacheSet(reader.result, () => {
            window.localStorage['baye/libname'] = '自定义';
            window.localStorage['baye/libpath'] = undefined;
            window.location.reload();
        });
    }
    reader.readAsBinaryString(files[0]);
}

function loadLibDefault(then) {
    var status = document.getElementById('game-load-status');
    function failed(error) {
        var message = '原版加载失败，请重新加载。' + (error && error.message ? ' ' + error.message : '');
        if (status) { status.hidden = false; status.textContent = message; status.setAttribute('role', 'alert'); }
        else alert(message);
        var retry = document.getElementById('game-load-retry');
        if (retry) retry.hidden = false;
    }
    if (!window.BayeOriginalGame) { failed(new Error('启动资源未就绪')); return; }
    return BayeOriginalGame.load(function () {
        if (status) status.hidden = true;
        then();
    }, failed).catch(function () { /* The visible retry message handles startup failure. */ });
}

function bayeMain() {
    loadLibDefault(function () {
        // Prepare the known HD opening before native playback begins. The
        // optional PC module invokes this callback once, including fallback.
        if (window.BayeHdSpe && typeof BayeHdSpe.prepareStart === 'function') {
            BayeHdSpe.prepareStart(_main);
        } else {
            _main();
        }
    });
}

function chooseLib(title, path, self_) {
    var self = $(self_);
    self.html("请稍候...");
    self.attr("disabled", "disabled");

    clearLib(() => {
		//http direct
		if (0 === path.indexOf('http')){
			location.href=path;
			return;
		}

        if (path && path.length > 0) {
            window.localStorage['baye/libname'] = title;
            window.localStorage['baye/libpath'] = path;
        }
        redirect();
    });
}


function loadDetail(id, path) {
    var e = $(id);
    if (e.is(":hidden")) {
        if (e.attr("data-loaded")) {
            e.show();
        } else {
            e.show();
            $.get(path, {}, function(text) {
                e.html(text.replace(/(?:\r\n|\r|\n)/g, '<br />'));
                e.attr("data-loaded", "1");
            }).fail(function(req){
                if (req.status == 404) {
                    e.html("待补充");
                    e.attr("data-loaded", "1");
                } else {
                    e.html("错误: " + req.status);
                }
                e.show();
            });
        }
    } else {
        e.hide();
    }
}

function loadLibLists(container) {

    $.ajax({
         type:"GET",
         url:"libs.json?ver=2023111705",
         dataType:"json",
     }).success(function(json) {
        var tpl = $("#item_temp").html();

        html = "";
        for (i in json) {
            html += tpl.format(
            {
             title: json[i]["title"],
             libpath: json[i]["path"],
             descid: i,
             descpath: json[i]["desc"]?json[i]["desc"]:json[i]["path"]+'.about',
            }
            );
        }
        $(container).html(html);
    });
}

function redirect(page) {
    var uiKind = window.localStorage['baye/uiKind'];

    switch (uiKind) {
        case "mobile":
            isMobile = true;
            break;
        case "desktop":
            isMobile = false;
            break;
        default:
            isMobile = "detect";
            break;
    }

    if (isMobile == "detect") {
        isMobile = navigator.userAgent.match(/(iPhone|iPod|Android|ios|Mobile|ARM)/i);
    }

    if(isMobile){
        var defaultMPage = "m.html";
        switch (window.localStorage['baye/mpage']) {
        case '0':
            defaultMPage = "m.html"
            break;
        case '1':
            defaultMPage = "m-old.html"
            break;
        case '2':
            defaultMPage = "m-ges.html"
            break;
        case '3':
            defaultMPage = "m-ktouch.html"
            break;
        }
        console.log('page:' + page);
        console.log('defpage:' + defaultMPage);
        page = page || defaultMPage;
    } else {
        page = "pc.html";
    }
    var now = new Date().getTime() / 1000;
    var name = window.BayeOriginalGame ? BayeOriginalGame.title : '三国霸业-词典原版';
    var hash = isMobile ? "#" + now : "";
    var assetVer = (window.BAYE_ASSET_VER || '20261010b');
    window.location.href = page + "?name=" + encodeURIComponent(name) + "&ver=" + encodeURIComponent(assetVer) + hash;
}

function goHome() {
    window.location.href = "index.html";
}

function disablePageScroll() {
    document.body.addEventListener('touchmove', function(event) {
        // Mobile HD menus own scrollable panes. Keep the page/LCD locked,
        // while allowing a browser pan inside a currently displayed HD shell.
        var target = event.target, body = document.body;
        while (target && target !== body) {
            if (body.classList && ((target.id === 'hd-city-menu' && body.classList.contains('hd-mobile-city-on')) ||
                (target.id === 'hd-dialog' && body.classList.contains('hd-mobile-dialog-on')) ||
                (target.id === 'hd-system-ui' && body.classList.contains('hd-mobile-page') &&
                    body.getAttribute('data-hd-mobile-system') === 'hd') ||
                (target.id === 'hd-mobile-battle-side' && body.classList.contains('hd-mobile-page') &&
                    body.getAttribute('data-hd-mobile-battle') === 'hd'))) { return; }
            target = target.parentElement || target.parentNode;
        }
        event.preventDefault();
    }, {
        passive: false,
        capture: false
    });
    window.onscroll = function() {  window.scrollTo(0, 0); }
}

function touchPadInit(elementID) {
    var activeTouch = null;
    var originX = 0;
    var originY = 0;
    var lastX = 0;
    var lastY = 0;
    var touchMoved = false;
    var xMoved = 0;
    var yMoved = 0;
    var previousMovingTime = 0;
    var previousX = 0;
    var previousY = 0;
//    var normalBackgroundColor = "#fff";
    function convertTouch(touch) {
        switch (lcdRotateMode) {
        case 0:
            break;
        case 1:
            return {
                x: touch.screenY,
                y: window.screen.width-touch.screenX,
            };
        case 2:
            return {
                x: window.screen.height-touch.screenY,
                y: touch.screenX,
            };
        }
        return {
            x: touch.screenX,
            y: touch.screenY,
        };
    }

    function raiseKey(key) {
        sendKey(key);
    }

    function resetTouch() {
        activeTouch = null;
        touchMoved = false;
        xMoved = 0;
        yMoved = 0;
        previousX = 0;
        previousY = 0;
        // todo: reset color
    }

    function touchBegan(event) {
        if (activeTouch || event.targetTouches.length < 1) {
            return;
        }
        activeTouch = event.targetTouches[0];
        previousMovingTime = event.timeStamp;
        var touch = convertTouch(activeTouch);
        previousX = lastX = originX = touch.x;
        previousY = lastY = originY = touch.y;
        touchMoved = false;
        // todo: color
    }

    function find(touches, touch) {
         for (var i in touches) {
            if (touch.identifier == touches[i].identifier) {
                return touches[i];
            }
         }
         return null;
    }

    function touchEnded(event) {
        if (activeTouch && find(event.changedTouches, activeTouch)) {
            resetTouch();
        }
    }

    function processPointMove(point,
                        previousPoint,
                        previousStayPoint,
                        dT,
                        stepMax,
                        stepMin,
                        speedMax,
                        speedThreshold,
                        vkUp,
                        vkDown)
    {
        var speed = (point - previousPoint) / dT;
        var dP = point - previousStayPoint;


        speed = Math.abs(speed);
        if (speed > speedThreshold) {
            speed -= speedThreshold;
        }
        else {
            speed = 0;
        }

        speed = Math.pow(speed, 3);
        speedMax = Math.pow(speedMax, 3);
        speed = Math.min(speed, speedMax);

        var step = stepMax - speed / speedMax * (stepMax - stepMin);
        var count = Math.floor(Math.abs(dP) / step);
        if (count > 0) {
            for (var i = 0; i < count; i++) {
                raiseKey( dP < 0 ? vkUp : vkDown);
            }
            return point;
        }
        return previousStayPoint;
    }

    function touchMove(event) {
        if (activeTouch) {
            var newTouch = find(event.changedTouches, activeTouch);
            if (!newTouch) {
                return;
            }

            var touch = convertTouch(newTouch);
            var x = touch.x;
            var y = touch.y;

            var dt = event.timeStamp - previousMovingTime;
            previousMovingTime = event.timeStamp;

            var dX = x - previousX;
            var dY = y - previousY;
            var speedX = dX / dt;
            var speedY = dX / dt;
            var ratio = Math.abs(speedX / speedY);

            lastY = processPointMove(y, previousY, lastY, dt, 30, 0.3, 2000, 800, VK_UP, VK_DOWN);
            lastX = processPointMove(x, previousX, lastX, dt, 30, 8, 1000, 500, VK_LEFT, VK_RIGHT);

            previousX = x;
            previousY = y;

            touchMoved = true;
        }
    }

    var element = document.getElementById(elementID);

    element.addEventListener("touchstart", touchBegan);
    element.addEventListener("touchmove", touchMove);
    element.addEventListener("touchend", touchEnded);
    element.addEventListener("touchcancel", touchEnded);
    disablePageScroll();
}

var lcdRotateMode = 0;

function touchScreenInit(lcdID) {
    var lcd = document.getElementById(lcdID);
    if (lcd._bayeTouchController) { return lcd._bayeTouchController; }
    var activeTouch = null;
    var blocked = false;
    var VT_TOUCH_DOWN = 1
    var VT_TOUCH_UP = 2
    var VT_TOUCH_MOVE = 3
    var VT_TOUCH_CANCEL = 4

    function position(touch) {
        var rect = lcd.getBoundingClientRect();
        if (!rect || !(rect.width > 0 && rect.height > 0) ||
            !['left', 'top', 'width', 'height'].every(function (name) { return typeof rect[name] === 'number' && isFinite(rect[name]); }) ||
            ![lcdWidth, lcdHeight].every(function (size) { return typeof size === 'number' && isFinite(size) && size > 0 && Math.floor(size) === size; }) ||
            typeof touch.clientX !== 'number' || typeof touch.clientY !== 'number' ||
            !isFinite(touch.clientX) || !isFinite(touch.clientY) ||
            document.hidden || [0, 1, 2].indexOf(lcdRotateMode) < 0) { return null; }
        var webX = touch.clientX - rect.left;
        var webY = touch.clientY - rect.top;
        if (webX < 0 || webY < 0 || webX >= rect.width || webY >= rect.height) { return null; }
        var gameX = webX / rect.width * lcdWidth;
        var gameY = webY / rect.height * lcdHeight;

        switch (lcdRotateMode) {
        case 0:
            break;
        case 1:
            gameX = webY / rect.height * lcdWidth;
            gameY = (rect.width - webX) / rect.width * lcdHeight;
            break;
        case 2:
            gameX = (rect.height - webY) / rect.height * lcdWidth;
            gameY = webX / rect.width * lcdHeight;
            break;
        }
        return { x: Math.min(lcdWidth - 1, Math.max(0, Math.floor(gameX))),
            y: Math.min(lcdHeight - 1, Math.max(0, Math.floor(gameY))),
            rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
            rotation: lcdRotateMode, nativeWidth: lcdWidth, nativeHeight: lcdHeight };
    }

    function sameGeometry(point) {
        return point && activeTouch && point.rotation === activeTouch.rotation &&
            point.nativeWidth === activeTouch.nativeWidth && point.nativeHeight === activeTouch.nativeHeight &&
            ['left', 'top', 'width', 'height'].every(function (name) {
                return Math.abs(point.rect[name] - activeTouch.geometry[name]) < 0.5;
            });
    }

    function raiseTouchEvent(key, point) {
        if (window.bayeDebugMode) {
            $('#info').html(sprintf('game:(%d,%d)', point.x, point.y));
        }
        _bayeSendTouchEvent(key, point.x, point.y);
    }

    function cancelTouch() {
        if (!activeTouch) { return; }
        var point = activeTouch.point;
        activeTouch = null;
        // CANCEL uses the last accepted game coordinates, never the new layout.
        raiseTouchEvent(VT_TOUCH_CANCEL, point);
    }

    function prevent(event) {
        if (event.cancelable) { event.preventDefault(); }
    }

    function touchBegan(event) {
        prevent(event);
        if (event.touches.length > 1) { blocked = true; cancelTouch(); return; }
        if (blocked || activeTouch || event.targetTouches.length !== 1) { return; }
        var touch = event.targetTouches[0], point = position(touch);
        if (!point) { return; }
        activeTouch = { identifier: touch.identifier, point: point, geometry: point.rect, rotation: point.rotation,
            nativeWidth: point.nativeWidth, nativeHeight: point.nativeHeight };
        raiseTouchEvent(VT_TOUCH_DOWN, point);
    }

    function find(touches, touch) {
         for (var i = 0; i < touches.length; i++) {
            if (touch.identifier == touches[i].identifier) {
                return touches[i];
            }
         }
         return null;
    }

    function touchEnded(event) {
        prevent(event);
        if (activeTouch) {
            var touch = find(event.changedTouches, activeTouch);
            if (touch) {
                var point = position(touch);
                if (sameGeometry(point)) {
                    activeTouch = null;
                    raiseTouchEvent(VT_TOUCH_UP, point);
                } else { cancelTouch(); }
            }
        }
        if (!event.touches.length) { blocked = false; }
    }

    function touchMove(event) {
        prevent(event);
        if (activeTouch) {
            var touch = find(event.changedTouches, activeTouch);
            if (touch) {
                var point = position(touch);
                if (sameGeometry(point)) {
                    activeTouch.point = point;
                    raiseTouchEvent(VT_TOUCH_MOVE, point);
                } else { blocked = true; cancelTouch(); }
            }
        }
    }

    function touchCanceled(event) {
        prevent(event);
        if (activeTouch && (!event.changedTouches.length || find(event.changedTouches, activeTouch))) { cancelTouch(); }
        if (!event.touches.length) { blocked = false; }
    }

    function visibilityChanged() { if (document.hidden) { cancelTouch(); } }
    // A second finger can land outside the LCD and still invalidate its gesture.
    function globalTouchBegan(event) {
        if (activeTouch && event.touches.length > 1) { blocked = true; cancelTouch(); }
    }
    function globalTouchFinished(event) { if (!event.touches.length) { blocked = false; } }
    var events = { touchstart: touchBegan, touchmove: touchMove, touchend: touchEnded, touchcancel: touchCanceled };
    Object.keys(events).forEach(function (name) { lcd.addEventListener(name, events[name], { passive: false }); });
    window.addEventListener('blur', cancelTouch);
    window.addEventListener('resize', cancelTouch);
    window.addEventListener('orientationchange', cancelTouch);
    document.addEventListener('visibilitychange', visibilityChanged);
    document.addEventListener('touchstart', globalTouchBegan, true);
    document.addEventListener('touchend', globalTouchFinished, true);
    document.addEventListener('touchcancel', globalTouchFinished, true);
    var controller = { cancel: cancelTouch, destroy: function () {
        cancelTouch();
        Object.keys(events).forEach(function (name) { lcd.removeEventListener(name, events[name]); });
        window.removeEventListener('blur', cancelTouch);
        window.removeEventListener('resize', cancelTouch);
        window.removeEventListener('orientationchange', cancelTouch);
        document.removeEventListener('visibilitychange', visibilityChanged);
        document.removeEventListener('touchstart', globalTouchBegan, true);
        document.removeEventListener('touchend', globalTouchFinished, true);
        document.removeEventListener('touchcancel', globalTouchFinished, true);
        delete lcd._bayeTouchController;
    } };
    lcd._bayeTouchController = controller;
    disablePageScroll();
    return controller;
}

// --------- Engine callbacks ---------

function bayeFlushLcdBuffer(buffer) {
    lcdFlushBuffer(buffer);
}

function bayeStart() {
    _bayeSetLcdSize(lcdWidth, lcdHeight);
}

function bayeExit() {
    goHome();
}

function bayeLoadFileContent(filename) {
    if (filename === 'baye//data/dat.lib') return dynLib;
    return BayeSaveStorage.readFile(filename);
}

function bayeBindTap(selector) {
    function tap(){
        var action = $(this).attr("ontap");
        $(this).bind( "tap", function(e){
            eval(action);
            e.stopPropagation();
        });
    }
    $(selector).each(tap);
}

function bayeSaveFileContent(filename, content) {
    return BayeSaveStorage.stage(filename, content);
}

Module = window.Module || {};
Module.memoryInitializerPrefixURL = "../baye-engine/";
Module.noInitialRun = true;
Module.locateFile = function (path, prefix) {
    prefix = prefix || '';
    if (/\.(wasm|map)$/.test(path)) {
        return prefix + path + '?ver=' + (window.BAYE_ASSET_VER || '20261007f');
    }
    return prefix + path;
};

baye = {
    preScriptInit: function() {
        if (baye.data.g_scale > 2) {
            baye.blurScreen(true);
        }
    },
};
