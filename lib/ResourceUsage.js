/** @fileoverview
 * Define the resource usage
 *
 * A resource is identified by its name, e.g. 'memory'
 * Its type determines how the usage is measured, see classed below.
 * The 'tags' defines extra trivil strings which can be used
 * for matching a resource request to usage in fine granularity. E.g.
 * a resource request demands resource: name = 'cpu', tags = ['64bit', '~arm']
 * this means a cpu must be 64bit and not ARM processor. Correspondingly,
 * when the resource usage is reported, it should be like:
 *     name = 'cpu', tags = ['64bit', 'x86']
 * 'info' is just informative and opaque here.
 */
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
     * @description Make a new copy of the instance
     */
    dup: function () {
        return new ResourceUsage(this.name, this.type, { tags: this.tags, info: this.info });
    },

    /** @function
     * @description Check if request can be satisfied
     * @returns true/false
     */
    available: function (request) {
        return false;
    },

    /** @function
     * @description Get dimensions of usage values
     */
    values: function () {
        return [];
    },

    /** @function
     * @description Make reservation
     */
    reserve: function (request) {
        // do nothing by default
    }
}, {
    statics: {
        /** @static
         * @function
         * @description Create an instance from plain object
         */
        fromObject: function (obj) {
            if (!obj.name) {
                return null;
            }
            switch (obj.type) {
                case 'consumable':
                    return new ConsumableResourceUsage(obj.name, obj);
                case 'countable':
                    return new CountableResourceUsage(obj.name, obj);
                case 'sharable':
                    return new SharableResourceUsage(obj.name, obj);
                case 'rankable':
                    return new RankableResourceUsage(obj.name, obj);
                default:
                    return null;
            }
        },

        /** @static
         * @function
         * @description Converts an array of plain object into ResourceUsage instances
         */
        importUsages: function (usages) {
            if (Array.isArray(usages)) {
                var imported = [];
                usages.forEach(function (usageObj) {
                    var usage = ResourceUsage.fromObject(usageObj);
                    usage && imported.push(usage);
                });
                return imported;
            }
            return null;
        }
    }
});

/* ConsumableResourceUsage measures usage of type 'consumable'.
 * A 'consumable' resource has a limited number of units (total units), and the usage
 * can be reported with available units (avail) and units already in use (inuse).
 * 'total' >= 'avail' + 'inuse'. The reason using '>=' here is when 'total' is larger
 * than the sum, some unusable units are indicated. A common example is 'memory'.
 */
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

    dup: function () {
        return new ConsumableResourceUsage(this.name, {
            tags: this.tags,
            info: this.info,
            total: this.total,
            avail: this.avail,
            inuse: this.inuse
        });
    },

    available: function (request) {
        return this.avail >= request;
    },

    values: function () {
        return [this.total, this.avail, this.inuse];
    },

    reserve: function (request) {
        this.avail -= request;
    }
});

/* CountableResourceUsage measures usage of type 'countable'.
 * A 'countable' resource has a number of units which doesn't decrement when it is consumed.
 * An example is the number of CPUs or cores of one physical CPU.
 */
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

    dup: function () {
        return new CountableResourceUsage(this.name, {
            tags: this.tags,
            info: this.info,
            avail: this.avail
        });
    },

    available: function (request) {
        return this.avail >= request;
    },

    values: function () {
        return [this.avail];
    }
});

/* SharableResourceUsage measures usage of type 'sharable'.
 * A 'sharable' resource isn't related to units. It usually indicates the presents of
 * a certain resource. Like 'public-network'.
 */
var SharableResourceUsage = Class(ResourceUsage, {
    constructor: function (name, opts) {
        ResourceUsage.prototype.constructor.call(this, name, 'sharable', opts);
    },

    dup: function () {
        return new SharableResourceUsage(this.name, {
            tags: this.tags,
            info: this.info
        });
    },

    available: function (request) {
        return true;
    }
});

/* RankableResourceUsages measures usage of type 'rankable'.
 * A 'rankable' resource simply provides a score to indicate how the resource is
 * being used. E.g. loadavg of the CPUs converted into percentage. 100% means all
 * CPUs are fully used and no consumer is busy waiting. Over 100% means the system
 * is too busy where some consumers are completing CPU resource. And less than 100%
 * means the system is sometimes idle, not fully utilized. 'Rankable' resource is not
 * used in resource request as it's unmeasurable for an individual consumer.
 */
var RankableResourceUsage = Class(ResourceUsage, {
    constructor: function (name, opts) {
        ResourceUsage.prototype.constructor.call(this, name, 'rankable', opts);
        this.score = opts.score || 0;
    },

    toObject: function () {
        return _.extend(ResourceUsage.prototype.toObject.call(this), {
            score: this.score
        });
    },

    dup: function () {
        return new RankableResourceUsage(this.name, {
            tags: this.tags,
            info: this.info,
            score: this.score
        });
    },

    values: function () {
        return [this.score];
    }
});

module.exports = ResourceUsage;
