var Class = require('js-class');

var UsageMonitor = Class(process.EventEmitter, {
    constructor: function (opts) {
        this._policies = {};
        this._notifyTimeThreshold = 3000;
        this._usages = {};
    },

    get usages() {
        return this._usages;
    },

    updateUsage: function (usages, removes) {
        var notify, notifyTime = Date.now();
        Array.isArray(usages) || (usages = [usages]);
        usages.forEach(function (usage) {
            if (!notify) {
                var last = this._usages[usage.name];
                var policy = this._policies[usage.name];
                if (last) {
                    var diff = usage.diff(last);
                    if (policy && policy.changed(diff) ||
                        (diff.reduce(function (sum, val) { return sum + Math.abs(val); }, 0) != 0 &&
                         (!policy || !this._lastNotifiedTime || notifyTime - this._lastNotifiedTime >= this._notifyTimeThreshold))) {
                        notify = true;
                    }
                } else {
                    notify = true;
                }
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
        return Object.keys(this._usages).map(function (name) { return this._usages[name]; }, this);
    },

    notify: function () {
        this._lastNotifiedTime = Date.now();
        this.emit('changed');
    }
});

module.exports = UsageMonitor;
