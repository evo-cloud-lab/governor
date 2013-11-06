/** @fileoverview
 * Collector collects resource usages from all nodes in the cluster.
 * Member nodes only monitors local usage changes, and reports to Master.
 * Master nodes manages all resource usages from members. Allocation
 * only happens on master.
 */

var Class = require('js-class'),
    StateMachine = require('evo-elements').StateMachine,
    Message = require('evo-neuron').Message,

    ResourceUsage = require('./ResourceUsage'),
    ResourcePool  = require('./ResourcePool'),
    UsageMonitor  = require('./UsageMonitor');

/** @class
 * @description The resource usage tracker
 */
var Collector = Class({
    constructor: function (neuron, logger, opts) {
        this.logger = logger;
        this.neuron = neuron;

        // track dendrites which report usages
        this._extUsageNames = {};

        // resource usages of the whole cluster
        this._resourcePool = new ResourcePool(opts);

        // local resource usages only
        (this._localUsages = new UsageMonitor(opts))
            .on('changed', this.onLocalUsagesChanged.bind(this));

        // This state machine helps manage resource usages different
        // when this node becomes master or member. The 'immunized'
        // state is a transit state, for intermediate node states
        // like announcing, connecting.
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
            .subscribe('update',  'connector', this.onConnectorUpdate.bind(this))
            .subscribe('message', 'connector', this.onConnectorMessage.bind(this))
            .dispatch('collect.usages', this.handleUsages.bind(this))
        ;
    },

    /** @function
     * @description Report local resource usages to Master
     */
    reportUsages: function () {
        this.neuron.send('connector', Message.make('send', {
            msg: Message.make('collect.usages', { usages: this._localUsages.exportUsages() }),
            dst: 'master'
        }));
    },

    /** @function
     * @description Collect resource usages from a member node
     */
    updateResourcePool: function (src, usages) {
        this._resourcePool.updateUsages(src, usages);
    },

    /** @function
     * @description Sync resource pool when topology changes
     */
    syncResourcePool: function (nodeIds) {
        this._resourcePool.syncSources(nodeIds);
    },

    /** @function
     * @description Remove everything from resource pool
     */
    clearResourcePool: function () {
        this._resourcePool.clear();
    },

    // Triggered when local usages monitor detects a significant change
    onLocalUsagesChanged: function () {
        this._states.process('localUsages', this._localUsages);
    },

    // When a dendrite disconnects, all usages reported by it should be removed
    onDendriteDisconnect: function (id) {
        var names = this._extUsageNames[id];
        if (names) {
            delete this._extUsageNames[id];
            this._localUsages.updateUsages([], Object.keys(names));
        }
    },

    // node state changed
    onConnectorState: function (msg) {
        if (msg.data.state) {
            this._states.process('nodeState', msg.data.state);
        }
    },

    // topology changed
    onConnectorUpdate: function (msg) {
        this._states.process('nodeUpdate', msg.data);
    },

    // node message
    onConnectorMessage: function (wrappedMsg) {
        var msg = wrappedMsg.data.msg;
        if (msg && msg.event == 'collect.usages' && msg.data) {
            var usages = ResourceUsage.importUsages(msg.data.usages);
            usages && this._states.process('memberUsages', wrappedMsg.data.src, usages);
        }
    },

    // usages reported from dendrites
    handleUsages: function (req) {
        var usages = ResourceUsage.importUsages(req.data.usages);
        if (usages) {
            var names = this._extUsageNames[req.src];
            names || (names = this._extUsageNames[req.src] = {});
            usages.forEach(function (usage) {
                names[usage.name] = true;
            });
            this._localUsages.updateUsages(usages);
        }
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
    },

    transit: function () {
        this._transit.apply(undefined, arguments);
    },

    nodeState: function (state) {
        this.transit(state);
    }
});

var ImmunizedState = Class(StateBase, {
    constructor: function () {
        StateBase.prototype.constructor.apply(this, arguments);
    },

    memberUsages: function (src, usages) {
        this.collector.updateResourcePool(src, usages);
    },

    nodeUpdate: function (clusterInfo) {
        Array.isArray(clusterInfo.nodes) &&
            this.collector.syncResourcePool(
                clusterInfo.nodes.map(function (node) { return node.id; })
            );
    }
});

var MasterState = Class(ImmunizedState, {
    constructor: function () {
        ImmunizedState.prototype.constructor.apply(this, arguments);
    }
});

var MemberState = Class(StateBase, {
    constructor: function () {
        StateBase.prototype.constructor.apply(this, arguments);
    },

    enter: function () {
        this.collector.clearResourcePool();
    },

    localUsages: function () {
        this.collector.reportUsages();
    }
});

module.exports = Collector;
