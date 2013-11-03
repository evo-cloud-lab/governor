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
    }
});

module.exports = ResourcePool;
