var assert = require('assert'),

    ResourceUsage = require('../index').ResourceUsage;

describe('ResourceUsage', function () {
    it('#constructor name required', function () {
        assert.throws(function () {
            new ResourceUsage();
        }, /name required/i);
    });

    it('#constructor tags always array', function () {
        assert.ok(Array.isArray(new ResourceUsage('dummy').tags));
    });

    it('#constructor info always object', function () {
        assert.equal(typeof(new ResourceUsage('dummy').info), 'object');
    });

    it('#toObject', function () {
        assert.deepEqual(new ResourceUsage('dummy', 'type', { tags: ['tag'] }).toObject(), {
            name: 'dummy',
            type: 'type',
            tags: ['tag'],
            info: {}
        });
    });

    it('#available default false', function () {
        assert.strictEqual(new ResourceUsage('dummy').available(), false);
    });

    it('#values default empty array', function () {
        assert.deepEqual(new ResourceUsage('dummy').values(), []);
    });

    describe('consumable', function () {
        var usage;

        beforeEach(function () {
            usage = ResourceUsage.fromObject({
                name: 'dummy',
                type: 'consumable',
                total: 5,
                avail: 3,
                inuse: 1
            });
            assert.ok(usage);
        });

        it('#available', function () {
            assert.equal(usage.available(1), true);
            assert.equal(usage.available(4), false);
        });

        it('#values', function () {
            assert.deepEqual(usage.values(), [5, 3, 1]);
        });
    });

    describe('countable', function () {
        var usage;

        beforeEach(function () {
            usage = ResourceUsage.fromObject({
                name: 'dummy',
                type: 'countable',
                avail: 3
            });
        });

        it('#available', function () {
            assert.equal(usage.available(1), true);
            assert.equal(usage.available(4), false);
        });

        it('#values', function () {
            assert.deepEqual(usage.values(), [3]);
        });
    });

    describe('sharable', function () {
        var usage;

        beforeEach(function () {
            usage = ResourceUsage.fromObject({
                name: 'dummy',
                type: 'sharable'
            });
        });

        it('#available', function () {
            assert.equal(usage.available(1), true);
            assert.equal(usage.available(4), true);
        });

        it('#values', function () {
            assert.deepEqual(usage.values(), []);
        });
    });

    describe('static methods', function () {
        it('#fromObject with invalid type', function () {
            assert.equal(ResourceUsage.fromObject({ name: 'dummy' }), null);
        });

        it('#importUsages', function () {
            var usages = ResourceUsage.importUsages([
                { name: 'dummy1', type: 'consumable', total: 100, avail: 50, inuse: 50 },
                { name: 'dummy2', type: 'countable', avail: 10 },
                { name: 'dummy3', type: 'sharable' }
            ]);
            assert.ok(Array.isArray(usages));
            usages.forEach(function (usage) { assert.ok(usage instanceof ResourceUsage); });
        });
    });
});
