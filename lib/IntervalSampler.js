/** @fileoverview
 * Base class for sampling by interval
 */

var Class = require('js-class'),

    Sampler = require('./Sampler');

var IntervalSampler = Class(Sampler, {
    constructor: function () {
        Sampler.prototype.constructor.apply(this, arguments);
        this.interval = this.options.interval || 5000;
    },

    start: function () {
        delete this._stopped;
        if (!this._timer) {
            this._timer = setTimeout(this._intervalSample.bind(this), this.interval);
        }
    },

    stop: function () {
        if (this._timer) {
            clearTimeout(this._timer);
            delete this._timer;
        }
        this._stopped = true;
    },

    _intervalSample: function () {
        delete this._timer;
        this.sample(function () {
            if (!this._stopped) {
                this.start();
            }
        }.bind(this));
    }
});

module.exports = IntervalSampler;
