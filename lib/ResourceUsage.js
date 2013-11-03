var Class = require('js-class'),
    _     = require('underscore');

var ResourceUsage = Class({
    constructor: function (name, type, opts) {
        if (!name) {
            throw new Error('Invalid argument: name required');
        }
        opts || (opts = {});
        this.name = name;
        this.type = type;
        this.tags = Array.isArray(opts.tags) ? opts.tags : [];
        this.info = opts.info || {};
    },

    toObject: function () {
        return {
            name: this.name,
            type: this.type,
            tags: this.tags,
            info: this.info
        };
    },

    // overridable methods

    /** @function
     * @description Check if request can be satisfied
     * @returns true/false
     */
    available: function (request) {
        return false;
    },

    /** @function
     * @description Get changes from previous usage
     * @returns an array of deltas of key factors
     */
    diff: function (usage) {
        return [];
    }
}, {
    statics: {
        fromObject: function (obj) {
            if (!obj.name) {
                return null;
            }
            switch (obj.type) {
                case 'consumable':
                    return ConsumableResourceUsage(obj.name, obj);
                case 'countable':
                    return CountableResourceUsage(obj.name, obj);
                case 'sharable':
                    return SharableResourceUsage(obj.name, obj);
                default:
                    return null;
            }
        }
    }
});

var ConsumableResourceUsage = Class(ResourceUsage, {
    constructor: function (name, opts) {
        ResourceUsage.prototype.constructor.call(this, name, 'consumable', opts);
        this.total = opts.total || 0;
        this.avail = opts.avail || 0;
        this.inuse = opts.inuse || 0;
    },

    toObject: function () {
        return _.extend(ResourceUsage.prototype.toObject.call(this), {
            total: this.total,
            avail: this.avail,
            inuse: this.inuse
        });
    },

    available: function (request) {
        return this.avail >= request;
    },

    diff: function (usage) {
        return [this.total - usage.total, this.avail - usage.avail, this.inuse - usage.inuse];
    }
});

var CountableResourceUsage = Class(ResourceUsage, {
    constructor: function (name, opts) {
        ResourceUsage.prototype.constructor.call(this, name, 'countable', opts);
        this.avail = opts.avail || 0;
    },

    toObject: function () {
        return _.extend(ResourceUsage.prototype.toObject.call(this), {
            avail: this.avail
        });
    },

    available: function (request) {
        return this.avail >= request;
    },

    diff: function (usage) {
        return [this.avail - usage.avail];
    }
});

var SharableResourceUsage = Class(ResourceUsage, {
    constructor: function (name, opts) {
        ResourceUsage.prototype.constructor.call(this, name, 'sharable', opts);
    },

    available: function (request) {
        return true;
    }
});

module.exports = ResourceUsage;
