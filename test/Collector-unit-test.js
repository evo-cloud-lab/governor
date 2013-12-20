var assert = require('assert'),
    Class  = require('js-class'),
    Try    = require('evo-elements').Try,
    Config = require('evo-elements').Config,
    Logger = require('evo-elements').Logger,
    ConnectorClient = require('evo-idioms').ConnectorClient,

    Helpers = require('./Helpers'),
    waitUntil = Helpers.waitUntil,
    Collector = require('../index').Collector;

describe('Collector', function () {
    var USAGES_MSG = {
        src: 'src',
        msg: {
            event: 'collect.usages',
            data: {
                usages: [
                    { name: 'memory', type: 'consumable', total: 1024, avail: 768, inuse: 128 },
                    { name: 'disk', type: 'consumable', total: 2048, avail: 1024, inuse: 512 }
                ]
            }
        }
    };

    var logger, neuron, connector, collector;

    before(function () {
        var conf = Config.conf([]);
        logger = new Logger('test', 'Connector', conf);
    });

    beforeEach(function () {
        neuron = new Helpers.MockedNeuron();
        connector = new ConnectorClient(neuron);
        collector = new Collector(connector, logger, {});
    });

    function fillResourcePoolAndWait(done) {
        neuron.publish('connector', 'message', USAGES_MSG);
        waitUntil(function () { return !!collector._resourcePool._usages['src']; }, function () {
            Try.final(function () {
                var nodeUsages = collector._resourcePool._usages['src'];
                assert.ok(nodeUsages._actualUsages);
                assert.ok(nodeUsages._effectUsages);
                assert.equal(Object.keys(nodeUsages._actualUsages).length, 2);
                assert.equal(Object.keys(nodeUsages._effectUsages).length, 2);
            }, done);
        });
    }

    function neverReport(done) {
        var sendCount = 0;
        neuron.sendHook = function () {
            sendCount ++;
        };
        collector.importUsages(USAGES_MSG.msg.data.usages, 'src');
        setTimeout(function () {
            Try.final(function () {
                assert.equal(sendCount, 0);
            }, done);
        }, 100);
    }

    function nodesUpdate(done) {
        fillResourcePoolAndWait(function (err) {
            err ? done(err) : (function () {
                neuron.publish('connector', 'update', { nodes: [] });
                waitUntil(function () { return Object.keys(collector._resourcePool._usages).length == 0; }, done);
            })();
        });
    }

    function dendriteDisconnect(done) {
        collector.importUsages(USAGES_MSG.msg.data.usages, 'src');
        waitUntil(function () {
            return collector._localUsages.usages['memory'] && collector._localUsages.usages['disk'];
        }, function () {
            neuron.emit('disconnect', 'src');
            waitUntil(function () {
                return Object.keys(collector._localUsages.usages).length == 0;
            }, done);
        });
    }

    describe('Default state', function () {
        beforeEach(function () {
            assert.equal(collector._states.currentName, 'default');
        });

        it('collect usages into resource pool', function (done) {
            fillResourcePoolAndWait(done);
        });

        it('never reports when local usages changed', function (done) {
            neverReport(done);
        });

        it('sync resource pool', function (done) {
            nodesUpdate(done);
        });

        it('clear usages when dendrite disconnects', function (done) {
            dendriteDisconnect(done);
        });
    });

    describe('Master state', function () {
        beforeEach(function (done) {
            neuron.publish('connector', 'state', { state: 'master' });
            waitUntil(function () { return collector._states.currentName == 'master'; }, done);
        });

        it('collect usages into resource pool', function (done) {
            fillResourcePoolAndWait(done);
        });

        it('never reports when local usages changed', function (done) {
            neverReport(done);
        });

        it('sync resource pool', function (done) {
            nodesUpdate(done);
        });

        it('clear usages when dendrite disconnects', function (done) {
            dendriteDisconnect(done);
        });
    });

    describe('Member state', function () {
        it('clear resource pool when state enters', function (done) {
            assert.equal(collector._states.currentName, 'default');
            fillResourcePoolAndWait(function (err) {
                err ? done(err) : (function () {
                    neuron.publish('connector', 'state', { state: 'member' });
                    waitUntil(function () { return collector._states.currentName == 'member'; }, function () {
                        Try.final(function () {
                            assert.deepEqual(collector._resourcePool._usages, {});
                        }, done);
                    });
                })();
            });
        });

        it('report usages to master', function (done) {
            neuron.sendHook = function (branch, msg) {
                Try.final(function () {
                    assert.equal(branch, 'connector');
                    assert.equal(msg.event, 'send');
                    assert.equal(msg.data.dst, 'master');
                    assert.equal(msg.data.msg.event, 'collect.usages');
                    assert.ok(Array.isArray(msg.data.msg.data.usages));
                }, done);
            };
            neuron.publish('connector', 'state', { state: 'member' });
            waitUntil(function () { return collector._states.currentName == 'member'; }, function () {
                collector.importUsages(USAGES_MSG.msg.data.usages, 'src');
            });
        });

        it('clear usages when dendrite disconnects', function (done) {
            dendriteDisconnect(done);
        });
    });
});
