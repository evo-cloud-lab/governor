/** @fileoverview
 * Base Sampler class
 */

var Class = require('js-class');

var Sampler = Class({
    constructor: function (name, collector, opts) {
        this.name = name;
        this.collector = collector;
        var samplers = opts.samplers || {};
        this.options = samplers[name] || {};
    },

    start: function () {
    },

    stop: function () {
    },

    sample: function (done) {
        this._sample(function (err, usages) {
            if (!err && usages) {
                usages = this.collector.importUsages(usages);
            }
            done && done(err, usages);
        });
    }
});

module.exports = Sampler;
