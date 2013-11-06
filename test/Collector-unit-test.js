var assert = require('assert'),
    Class  = require('js-class'),
    Try    = require('evo-elements').Try,
    Config = require('evo-elements').Config,
    Logger = require('evo-elements').Logger,

    Collector = require('../index').Collector;

describe('Collector', function () {
    var NeuronStub = Class(process.EventEmitter, {
        constructor: function (sendHook) {
            this.branches = {};
            this.dispatchers = {};
            this.sendHook = sendHook;
        },

        subscribe: function (event, branch, handler) {
            var handlers = this.branches[branch];
            handlers || (handlers = this.branches[branch] = {});
            handlers[event] = handler;
            return this;
        },

        dispatch: function (event, handler) {
            this.dispatchers[event] = handler;
            return this;
        },

        send: function () {
            this.sendHook && this.sendHook.apply(this, arguments);
            return this;
        },

        publish: function (branch, event, data) {
            var handlers = this.branches[branch];
            var handler = handlers && handlers[event];
            handler && handler({ event: event, data: data });
        },

        invoke: function (event, data) {
            var handler = this.dispatchers[event];
            handler && handler({ src: 'src', event: event, data: data });
        }
    });

    function waitUntil(logic, next, interval) {
        interval || (interval = 10);
        var waitFn = function () {
            logic() ? next() : setTimeout(waitFn, interval);
        };
        waitFn();
    }

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

    var logger, collector;

    before(function () {
        var conf = Config.conf([]);
        logger = new Logger('test', 'Connector', conf);
    });

    beforeEach(function () {
        var neuron = new NeuronStub();
        collector = new Collector(neuron, logger, {});
    });

    function fillResourcePoolAndWait(done) {
        collector.neuron.publish('connector', 'message', USAGES_MSG);
        waitUntil(function () { return !!collector._resourcePool._usages['src']; }, function () {
            Try.final(function () {
                assert.ok(Array.isArray(collector._resourcePool._usages['src']));
                assert.equal(collector._resourcePool._usages['src'].length, 2);
            }, done);
        });
    }

    function neverReport(done) {
        var sendCount = 0;
        collector.neuron.sendHook = function () {
            sendCount ++;
        };
        collector.neuron.invoke(USAGES_MSG.msg.event, USAGES_MSG.msg.data);
        setTimeout(function () {
            Try.final(function () {
                assert.equal(sendCount, 0);
            }, done);
        }, 100);
    }

    function nodesUpdate(done) {
        fillResourcePoolAndWait(function (err) {
            err ? done(err) : (function () {
                collector.neuron.publish('connector', 'update', { nodes: [] });
                waitUntil(function () { return Object.keys(collector._resourcePool._usages).length == 0; }, done);
            })();
        });
    }

    function dendriteDisconnect(done) {
        collector.neuron.invoke(USAGES_MSG.msg.event, USAGES_MSG.msg.data);
        waitUntil(function () {
            return collector._localUsages.usages['memory'] && collector._localUsages.usages['disk'];
        }, function () {
            collector.neuron.emit('disconnect', 'src');
            waitUntil(function () {
                return Object.keys(collector._localUsages.usages).length == 0;
            }, done);
        });
    }

    describe('Immunized state', function () {
        beforeEach(function () {
            assert.equal(collector._states.currentName, 'immunized');
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
            collector.neuron.publish('connector', 'state', { state: 'master' });
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
            assert.equal(collector._states.currentName, 'immunized');
            fillResourcePoolAndWait(function (err) {
                err ? done(err) : (function () {
                    collector.neuron.publish('connector', 'state', { state: 'member' });
                    waitUntil(function () { return collector._states.currentName == 'member'; }, function () {
                        Try.final(function () {
                            assert.deepEqual(collector._resourcePool._usages, {});
                        }, done);
                    });
                })();
            });
        });

        it('report usages to master', function (done) {
            collector.neuron.sendHook = function (branch, msg) {
                Try.final(function () {
                    assert.equal(branch, 'connector');
                    assert.equal(msg.event, 'send');
                    assert.equal(msg.data.dst, 'master');
                    assert.equal(msg.data.msg.event, 'collect.usages');
                    assert.ok(Array.isArray(msg.data.msg.data.usages));
                }, done);
            };
            collector.neuron.publish('connector', 'state', { state: 'member' });
            waitUntil(function () { return collector._states.currentName == 'member'; }, function () {
                collector.neuron.invoke(USAGES_MSG.msg.event, USAGES_MSG.msg.data);
            });
        });

        it('clear usages when dendrite disconnects', function (done) {
            dendriteDisconnect(done);
        });
    });
});
