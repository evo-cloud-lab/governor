/** @fileoverview
 * Sample CPU and loadavg statistics
 */

var Class = require('js-class'),
    os = require('os'),

    IntervalSampler = require('./IntervalSampler');

var CPUSampler = new Class(IntervalSampler, {
    constructor: function (collector, opts) {
        IntervalSampler.prototype.constructor.call(this, 'cpu', collector, opts);
    },

    _sample: function (callback) {
        var loadavg = os.loadavg();
        callback(null, [
            {
                name: 'cpu',
                type: 'countable',
                avail: os.cpus().length,
                tags: [os.arch()]
            },
            {
                name: 'cpu.load',
                type: 'rankable',
                score: loadavg[0] * 100 / os.cpus().length,
                info: {
                    loadavg: loadavg
                }
            }
        ]);
    }
});

module.exports = CPUSampler;
