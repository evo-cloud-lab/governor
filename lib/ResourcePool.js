var Class = require('js-class');

var ResourcePool = Class({
    constructor: function (opts) {
        this._usages = {};
    },

    updateUsages: function (id, usages) {
        if (usages) {
            this._usages[id] = usages;
        } else {
            delete this._usages[id];
        }
    },

    syncSources: function (ids) {
        var presents = {}, removes = [];
        ids.forEach(function (id) { presents[id] = true; });
        Object.keys(this._usages).forEach(function (id) {
            presents[id] || removes.push(id);
        });
        removes.forEach(function (id) {
            delete this._usages[id];
        }, this);
    },

    clear: function () {
        this._usages = {};
    }
});

module.exports = ResourcePool;
