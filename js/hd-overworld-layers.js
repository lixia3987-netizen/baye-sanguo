/* Pure map-space image clipping. The caller owns visibility and LIB provenance. */
(function (global) {
    'use strict';

    function number(value) { return typeof value === 'number' && isFinite(value); }
    function rectangle(value) {
        return !!value && number(value.x) && number(value.y) && number(value.w) && number(value.h) &&
            value.w > 0 && value.h > 0 && number(value.x + value.w) && number(value.y + value.h);
    }
    function arrayRectangle(value) {
        if (!Array.isArray(value) || value.length !== 4) { return null; }
        var rect = { x: value[0], y: value[1], w: value[2], h: value[3] };
        return rectangle(rect) ? rect : null;
    }
    function intersection(a, b) {
        var x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
        var w = Math.min(a.x + a.w, b.x + b.w) - x;
        var h = Math.min(a.y + a.h, b.y + b.h) - y;
        return w > 0 && h > 0 ? { x: x, y: y, w: w, h: h } : null;
    }
    function imageSize(image) {
        if (!image || image.complete === false) { return null; }
        var intrinsic = 'naturalWidth' in image || 'naturalHeight' in image;
        var w = intrinsic ? image.naturalWidth : image.width;
        var h = intrinsic ? image.naturalHeight : image.height;
        return number(w) && number(h) && w > 0 && h > 0 && Math.floor(w) === w && Math.floor(h) === h
            ? { w: w, h: h } : null;
    }
    function candidate(layer, size, original, clipped, viewport, destination, instanceIndex) {
        var source = [(clipped.x - original.x) / original.w * size.w,
            (clipped.y - original.y) / original.h * size.h,
            clipped.w / original.w * size.w, clipped.h / original.h * size.h];
        var target = [destination.x + (clipped.x - viewport.x) / viewport.w * destination.w,
            destination.y + (clipped.y - viewport.y) / viewport.h * destination.h,
            clipped.w / viewport.w * destination.w, clipped.h / viewport.h * destination.h];
        if (!arrayRectangle(source) || !arrayRectangle(target)) { return null; }
        var operation = { id: layer.id, path: layer.path, source: source, destination: target };
        if (instanceIndex !== undefined) { operation.instanceIndex = instanceIndex; }
        return operation;
    }
    function paint(ctx, image, opacity, operation) {
        var saved = false, drawn = false;
        try {
            ctx.save(); saved = true;
            ctx.globalAlpha = opacity;
            ctx.globalCompositeOperation = 'source-over';
            ctx.drawImage(image, operation.source[0], operation.source[1], operation.source[2], operation.source[3],
                operation.destination[0], operation.destination[1], operation.destination[2], operation.destination[3]);
            drawn = true;
        } catch (e) { drawn = false; }
        finally {
            if (saved) {
                try { ctx.restore(); } catch (e) { drawn = false; }
            }
        }
        return drawn;
    }
    function draw(ctx, layers, images, viewport, destination) {
        var result = { drawn: 0, skipped: 0, operations: [] };
        if (!Array.isArray(layers)) { result.skipped = 1; return result; }
        if (!rectangle(viewport) || !rectangle(destination) || !ctx || typeof ctx.save !== 'function' ||
            typeof ctx.restore !== 'function' || typeof ctx.drawImage !== 'function') {
            result.skipped = layers.length; return result;
        }
        function apply(layer, image, size, original, clipped, index) {
            var operation = clipped && candidate(layer, size, original, clipped, viewport, destination, index);
            if (operation && paint(ctx, image, layer.opacity, operation)) {
                result.drawn += 1; result.operations.push(operation);
            } else { result.skipped += 1; }
        }
        for (var i = 0; i < layers.length; i++) {
            try {
                var layer = layers[i], world = layer && arrayRectangle(layer.worldRect);
                if (!layer || layer.draw !== true || typeof layer.id !== 'string' || !layer.id ||
                    typeof layer.path !== 'string' || !layer.path || !world ||
                    !number(layer.opacity) || layer.opacity <= 0 || layer.opacity > 1 ||
                    !Array.isArray(layer.pixelSize) || layer.pixelSize.length !== 2 ||
                    (layer.kind !== 'raster' && layer.kind !== 'stamps') || !images ||
                    !Object.prototype.hasOwnProperty.call(images, layer.path)) { result.skipped += 1; continue; }
                var image = images[layer.path], size = imageSize(image);
                if (!size || size.w !== layer.pixelSize[0] || size.h !== layer.pixelSize[1]) {
                    result.skipped += 1; continue;
                }
                if (layer.kind === 'raster') {
                    apply(layer, image, size, world, intersection(world, viewport));
                } else if (!Array.isArray(layer.instances) || !layer.instances.length) {
                    result.skipped += 1;
                } else {
                    for (var j = 0; j < layer.instances.length; j++) {
                        try {
                            var original = layer.instances[j] && arrayRectangle(layer.instances[j].rect);
                            var clipped = original && intersection(original, world);
                            apply(layer, image, size, original, clipped && intersection(clipped, viewport), j);
                        } catch (e) { result.skipped += 1; }
                    }
                }
            } catch (e) { result.skipped += 1; }
        }
        return result;
    }
    global.BayeHdOverworldLayers = { draw: draw };
})(window);
