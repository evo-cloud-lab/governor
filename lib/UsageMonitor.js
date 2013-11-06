/** @fileoverview
 * Manages local resource usages and notifies when
 * significant changes detected. A 'significant'
 * change happens if the change exceeds the defined
 * threshold
 */

var Class = require('js-class'),
    _     = require('underscore');

function detectChangeByPercentage(curr, orig, threshold) {
    if (orig == 0) {
        return true;
    }
    var delta = Math.abs((curr - orig) * 100 / orig);
    return delta >= threshold;
}

function detectChangeByAbsoluteDelta(curr, orig, threshold) {
    return Math.abs(curr - orig) >= threshold;
}

function changedDefault(curr, last) {
    return curr.some(function (val, index) {
        return val != last[index];
    });
}

/** @class
 * Local resource usages monitor
 */
var UsageMonitor = Class(process.EventEmitter, {
    constructor: function (opts) {
        this._policies = {};
        typeof(opts.policies) == 'object' &&
            Object.keys(opts.policies).forEach(function (name) {
                var threshold = opts.policies[name].threshold;
                if (threshold) {
                    var changed;
                    switch (opts.policies[name].measure) {
                        case 'percentage':
                            changed = detectChangeByPercentage;
                            break;
                        default:
                            changed = detectChangeByAbsoluteDelta;
                            break;
                    }
                    this._policies[name] = Object.create({
                        changed: function (curr, last) {
                            return curr.some(function (val, index) {
                                return changed(val, last[index], threshold);
                            });
                        }
                    });
                }
            }, this);
        this._notifyInterval = opts.notifyInterval || 3000;
        this._usages = {};
        this._lastUsages = {};
    },

    get usages() {
        return this._usages;
    },

    updateUsages: function (usages, removes) {
        var notify, notifyTime = Date.now();
        Array.isArray(usages) || (usages = [usages]);
        usages.forEach(function (usage) {
            if (!notify) {
                var last = this._lastUsages[usage.name];
                var policy = this._policies[usage.name];
                notify = !last ||
                         !this._lastNotifiedTime ||
                         notifyTime - this._lastNotifiedTime >= this._notifyInterval ||
                         ((policy && policy.changed) || changedDefault)(usage.values(), last.values());
            }
            this._usages[usage.name] = usage;
        }, this);

        Array.isArray(removes) && removes.forEach(function (name) {
            this._usages[name] && (notify = true);
            delete this._usages[name];
        }, this);

        notify && this.notify();
    },

    exportUsages: function () {
        return Object.keys(this._usages).map(function (name) { return this._usages[name].toObject(); }, this);
    },

    notify: function () {
        this._lastNotifiedTime = Date.now();
        this._lastUsages = _.clone(this._usages);
        this.emit('changed');
    }
});

module.exports = UsageMonitor;
