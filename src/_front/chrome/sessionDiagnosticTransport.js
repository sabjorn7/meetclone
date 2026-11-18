// Self-contained, ES5 syntax: embedded in the existing HTML watchdog AND imported by the module.
// No second recorder/watchdog. All network permission, sampling, dedup and budget live here.
export function createDiagnosticTransport(options) {
    var fetch = options.fetch, now = options.now || Date.now;
    var schedule = options.schedule || setTimeout, cancel = options.cancel || clearTimeout;
    var visible = options.visible || function () { return true; };
    var online = options.online || function () { return true; };
    var draw = (options.random || Math.random)(), release = options.release;
    var selected = false, stopped = false, attempts = 0, busy = false, config = null;
    var lastConfig = 0, lastAttempt = -Infinity, started = null, refreshing = null;
    var reported = Object.create(null), stopListeners = [], began = now(), phase = 0;
    var marks = [[0, 0]], bootObserved = false;
    function bounded(n, max) { return typeof n === 'number' && isFinite(n) ? Math.max(0, Math.min(max, Math.floor(n))) : 0; }
    function stop() {
        if (stopped) return;
        stopped = true; selected = false; config = null; marks.length = 0;
        stopListeners.splice(0).forEach(function (fn) { try { fn(); } catch (_) {} });
    }
    function request(url, readText) {
        var controller = typeof AbortController === 'function' ? new AbortController() : null, timer;
        var deadline = new Promise(function (_, reject) {
            timer = schedule(function () { if (controller) controller.abort(); reject(new Error('diagnostic timeout')); }, 3000);
        });
        var operation = Promise.resolve().then(function () {
            return fetch(url, { method: 'GET', credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', mode: 'same-origin', signal: controller ? controller.signal : undefined });
        }).then(function (r) {
            if (!r.ok) throw new Error('diagnostic transport');
            return readText ? r.text() : r;
        });
        return Promise.race([deadline, operation]).then(function (r) { cancel(timer); return r; }, function (e) { cancel(timer); throw e; });
    }
    function valid(c) {
        return c && c.version === 1 && c.enabled === true && typeof c.sampleRate === 'number' && isFinite(c.sampleRate) && c.sampleRate > 0 && c.sampleRate <= 1 && c.maxReports === 3 &&
            ['route', 'auth', 'http', 'page'].every(function (k) { var n = c.thresholdMs && c.thresholdMs[k]; return typeof n === 'number' && n % 1 === 0 && n >= 1000 && n <= 300000; });
    }
    function refresh() {
        if (stopped) return Promise.resolve(false);
        if (refreshing) return refreshing;
        refreshing = request('/_t/session-diagnostic.json', true).then(function (text) {
            if (text.length > 4096) throw new Error('diagnostic config');
            var c = JSON.parse(text);
            if (!valid(c) || draw >= c.sampleRate) { stop(); return false; }
            if (stopped) return false;
            config = c; selected = true; lastConfig = now(); return true;
        }).catch(function () { stop(); return false; });
        refreshing = refreshing.then(function (ok) { refreshing = null; return ok; });
        return refreshing;
    }
    function start() {
        if (!started) {
            if (!/^[0-9a-f]{7,40}$/.test(release || '')) { stop(); started = Promise.resolve(false); }
            else started = refresh();
        }
        return started;
    }
    function send(reason, data, key) {
        // A pre-mount error is one bootstrap incident. The existing watchdog owns its report.
        if (options.bootEnabled && phase < 7 && reason !== 7) return Promise.resolve(false);
        if (!selected || stopped || busy || attempts >= 3 || !visible() || !online() || now() - lastAttempt < 10000 || reported[key]) return Promise.resolve(false);
        if (typeof data !== 'string' || data.length > 1100 || data.indexOf('1.' + release + '.' + reason + '.') !== 0 || !/^1\.[0-9a-f]{7,40}\.[1-7]\.[01]\.[0-9]{1,5}\.(?:[1-9]|1[0-3])-(?:[0-9]|[1-3][0-9]|40)-[0-6]-[0-9]{1,2}-[0-9]{1,4}-[0-9]{1,7}-[0-9]{1,7}-[0-9]-(?:0|[1-5][0-9]{2})-[0-2](?:_(?:[1-9]|1[0-3])-(?:[0-9]|[1-3][0-9]|40)-[0-6]-[0-9]{1,2}-[0-9]{1,4}-[0-9]{1,7}-[0-9]{1,7}-[0-9]-(?:0|[1-5][0-9]{2})-[0-2]){0,43}$/.test(data)) return Promise.resolve(false);
        reported[key] = true; attempts++; lastAttempt = now(); busy = true;
        return refresh().then(function (ok) {
            if (!ok || !visible() || !online()) return false;
            return request('/_l/session-v1?d=' + data, false).then(function () { return true; });
        }).catch(function () { return false; }).then(function (ok) {
            busy = false; if (attempts >= 3) stop(); return ok;
        });
    }
    function mark(value) {
        if (stopped || typeof value !== 'number' || value % 1 || value < 0 || value > 7 || value <= phase) return;
        phase = value; marks.push([value, bounded(now() - began, 9999999)]);
    }
    function boot(eligible) {
        if (stopped || !options.bootEnabled || bootObserved || phase >= 7 || !eligible || !visible() || !online()) return Promise.resolve(false);
        bootObserved = true;
        var rows = marks.map(function (m, i) { return '13-0-0-' + m[0] + '-' + (i + 1) + '-0-' + m[1] + '-0-0-2'; });
        rows.push('13-0-5-' + phase + '-9-0-' + bounded(now() - began, 9999999) + '-0-0-2');
        var data = '1.' + release + '.7.0.0.' + rows.join('_');
        return start().then(function () { return send(7, data, 'boot'); });
    }
    return {
        start: start, refresh: refresh, send: send, stop: stop, mark: mark, boot: boot,
        onStop: function (fn) { if (stopped) fn(); else stopListeners.push(fn); },
        state: function () { return { selected: selected, stopped: stopped, attempts: attempts, busy: busy, config: config, lastConfig: lastConfig, phase: phase, bootObserved: bootObserved }; }
    };
}
