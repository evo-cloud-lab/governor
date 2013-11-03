var Class = require('js-class'),
    StateMachine = require('evo-elements').StateMachine,

    ResourceUsage = require('./ResourceUsage'),
    ResourcePool = require('./ResourcePool'),
    UsageMonitor = require('./UsageMonitor');

var Collector = Class({
    constructor: function (neuron, logger, opts) {
        this.logger = logger;
        this.neuron = neuron;

        this._extUsageNames = {};

        this._resourcePool = new ResourcePool(opts);

        (this._localUsages = new UsageMonitor(opts))
            .on('changed', this.onLocalUsagesChanged.bind(this));

        this._states = new StateMachine()
            .state('immunized', new ImmunizedState(this))
                .when('master').to('master')
                .when('member').to('member')
                .fallback('immunized')
            .state('master', new MasterState(this))
                .when('member').to('member')
                .when('master').to('master')
                .fallback('immunized')
            .state('member', new MemberState(this))
                .when('master').to('master')
                .when('member').to('member')
                .fallback('immunized')
            .start();

        neuron
            .on('disconnect', this.onDendriteDisconnect.bind(this))
            .subscribe('state',   'connector', this.onConnectorState.bind(this))
            .subscribe('message', 'connector', this.onConnectorMessage.bind(this))
            .dispatch('collect.usages', this.handleUsages.bind(this))
        ;
    },

    onLocalUsagesChanged: function () {
        this._states.process('localUsages', this._localUsages);
    },

    onDendriteDisconnect: function (id) {
        var names = this._extUsageNames[id];
        if (names) {
            delete this._extUsageNames[id];
            this._localUsages.updateUsages([], Object.keys(names));
        }
    },

    onConnectorState: function (msg) {
        if (msg.data.state) {
            this._states.process('nodeState', msg.data.state);
        }
    },

    onConnectorMessage: function (wrappedMsg) {
        var msg = wrappedMsg.data.msg;
        if (msg && msg.event == 'collect.usages' && msg.data) {
            var usages = this._importUsages(msg.data.msg.data.usages);
            usages && this._resourcePool.updateUsages(msg.data.src, usages);
        }
    },

    handleUsages: function (req) {
        var usages = this._importUsages(req.data.usages);
        if (usages) {
            var names = this._extUsageNames[req.src];
            names || (names = this._extUsageNames[req.src] = {});
            usages.forEach(function (name) {
                names[name] = true;
            });
            this._localUsages.updateUsages(usages);
        }
    },

    _importUsages: function (usages) {
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
});

var StateBase = Class({
    constructor: function (collector) {
        this.collector = collector;
    },

    process: function (transit, event) {
        this._transit = transit;
        var method = this[event];
        method && method.apply(this, [].slice.call(arguments, 2));
    }
});

var ImmunizedState = Class(StateBase, {
    constructor: function () {
        StateBase.prototype.constructor.apply(this, arguments);
    }
});

var MasterState = Class(StateBase, {
    constructor: function () {
        StateBase.prototype.constructor.apply(this, arguments);
    }
});

var MemberState = Class(StateBase, {
    constructor: function () {
        StateBase.prototype.constructor.apply(this, arguments);
    }
});

module.exports = Collector;
