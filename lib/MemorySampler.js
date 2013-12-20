/** @fileoverview
 * Sample memory statistics
 */

var Class = require('js-class'),

    KeyValueReader  = require('./KeyValueReader'),
    IntervalSampler = require('./IntervalSampler');

function _parseAndSetInMB(obj, key, val, roundDown) {
    var vals = val.split(' ');
    val = parseInt(vals[0]);
    if (!isNaN(val)) {
        obj[key] = roundDown ? val >> 10 : Math.ceil(val / 1024);
    }
}

var MemorySampler = new Class(IntervalSampler, {
    constructor: function (collector, opts) {
        IntervalSampler.prototype.constructor.call(this, 'memory', collector, opts);
    },

    _sample: function (callback) {
        var info = {
            memTotal: 0,
            memFree: 0,
            buffers: 0,
            cached: 0,
            swapTotal: 0,
            swapFree: 0
        };
        var reader = KeyValueReader.readFile('/proc/meminfo');
        reader.on('entry', function (key, val) {
            switch (key) {
                case 'MemTotal': _parseAndSetInMB(info, 'memTotal', val, true); break;
                case 'MemFree':  _parseAndSetInMB(info, 'memFree', val, true); break;
                case 'Buffers':  _parseAndSetInMB(info, 'buffers', val, false); break;
                case 'Cached':   _parseAndSetInMB(info, 'cached', val, false); break;
                case 'SwapTotal': _parseAndSetInMB(info, 'swapTotal', val, true); break;
                case 'SwapFree': _parseAndSetInMB(info, 'swapFree', val, true); break;
            }
        }).on('end', function () {
            var swapUsed = info.swapTotal - info.swapFree;
            swapUsed >= 0 || (swapUsed = 0);
            var memAvail = info.memFree + info.buffers + info.cached - swapUsed;
            callback(null, [
                {
                    name: 'memory',
                    type: 'consumable',
                    total: info.memTotal,
                    avail: memAvail,
                    inuse: info.memTotal - memAvail,
                    info: info
                }
            ]);
        });
    }
});

module.exports = MemorySampler;
