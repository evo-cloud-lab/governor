var assert = require('assert'),
    Try    = require('evo-elements').Try,

    ResourceUsage = require('../index').ResourceUsage,
    UsageMonitor  = require('../index').UsageMonitor;

describe('UsageMonitor', function () {
    var monitor;

    beforeEach(function () {
        monitor = new UsageMonitor({
            policies: {
                percent: {
                    measure: 'percentage',
                    threshold: 10
                },

                absolute: {
                    measure: 'absolute',
                    threshold: 20
                }
            },

            notifyInterval: 200
        });
        monitor.notifyCount = 0;
        monitor
            .on('changed', function () { this.notifyCount ++; }.bind(monitor))
            .updateUsages(ResourceUsage.importUsages([
                { name: 'percent', type: 'consumable', total: 100, avail: 50, inuse: 40 },
                { name: 'absolute', type: 'consumable', total: 100, avail: 50, inuse: 40 },
                { name: 'default', type: 'consumable', total: 100, avail: 50, inuse: 40 }
            ]));
        assert.equal(monitor.notifyCount, 1);
    });

    it('#exportUsages', function () {
        var usages = monitor.exportUsages();
        assert.ok(Array.isArray(usages));
        assert.equal(usages.length, 3);
    });

    it('#updateUsages percentage', function () {
        monitor.updateUsages(ResourceUsage.importUsages([
            { name: 'percent', type: 'consumable', total: 100, avail: 54, inuse: 40 }
        ]));
        assert.equal(monitor.notifyCount, 1);
        assert.equal(monitor.usages['percent'].avail, 54);
        monitor.updateUsages(ResourceUsage.importUsages([
            { name: 'percent', type: 'consumable', total: 100, avail: 55, inuse: 40 }
        ]));
        assert.equal(monitor.notifyCount, 2);
        assert.equal(monitor.usages['percent'].avail, 55);
        monitor.updateUsages(ResourceUsage.importUsages([
            { name: 'percent', type: 'consumable', total: 100, avail: 55, inuse: 36 }
        ]));
        assert.equal(monitor.notifyCount, 3);
        assert.equal(monitor.usages['percent'].inuse, 36);
    });

    it('#updateUsages absolute', function () {
        monitor.updateUsages(ResourceUsage.importUsages([
            { name: 'absolute', type: 'consumable', total: 100, avail: 40, inuse: 40 }
        ]));
        assert.equal(monitor.notifyCount, 1);
        assert.equal(monitor.usages['absolute'].avail, 40);
        monitor.updateUsages(ResourceUsage.importUsages([
            { name: 'absolute', type: 'consumable', total: 100, avail: 20, inuse: 40 }
        ]));
        assert.equal(monitor.notifyCount, 2);
        assert.equal(monitor.usages['absolute'].avail, 20);
        monitor.updateUsages(ResourceUsage.importUsages([
            { name: 'absolute', type: 'consumable', total: 120, avail: 20, inuse: 40 }
        ]));
        assert.equal(monitor.notifyCount, 3);
        assert.equal(monitor.usages['absolute'].total, 120);
    });

    it('#updateUsages default', function () {
        monitor.updateUsages(ResourceUsage.importUsages([
            { name: 'default', type: 'consumable', total: 100, avail: 50, inuse: 40 }
        ]));
        assert.equal(monitor.notifyCount, 1);
        assert.equal(monitor.usages['default'].avail, 50);
        monitor.updateUsages(ResourceUsage.importUsages([
            { name: 'default', type: 'consumable', total: 100, avail: 51, inuse: 40 }
        ]));
        assert.equal(monitor.notifyCount, 2);
        assert.equal(monitor.usages['default'].avail, 51);
    });

    it('#updateUsages exceeding notifyInterval', function (done) {
        monitor.updateUsages(ResourceUsage.importUsages([
            { name: 'default', type: 'consumable', total: 100, avail: 50, inuse: 40 }
        ]));
        assert.equal(monitor.notifyCount, 1);
        assert.equal(monitor.usages['default'].avail, 50);
        setTimeout(function () {
            monitor.updateUsages(ResourceUsage.importUsages([
                { name: 'default', type: 'consumable', total: 100, avail: 50, inuse: 40 }
            ]));
            Try.final(function () {
                assert.equal(monitor.notifyCount, 2);
                assert.equal(monitor.usages['default'].avail, 50);
            }, done);
        }, 500);
    });
});
