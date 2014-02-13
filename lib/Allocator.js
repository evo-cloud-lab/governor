/** @fileoverview
 * Allocator provides unified interface for resource reservation.
 * Resource allocation completes in several phases:
 *    1. Reserve resource on a certain node
 *    2. Application notify the node with reservation Id
 *    3. The node performs tasks which may consume resource
 *    4. The node commits the reservation with latest resource usage
 */

var Class   = require('js-class'),
    Message = require('evo-neuron').Message,
    elements = require('evo-elements'),
    Logger = elements.Logger,
    BiMap  = elements.Catalog,
    idioms  = require('evo-idioms');

var Allocator = Class({
    constructor: function (connector, collector, logger, opts) {
        this.connector = connector;
        this.logger = Logger.clone(logger, { prefix: '<allocator> ' });

        this._resourcePool = collector.resourcePool;
        this._collector = collector;

        this._states = new idioms.ConnectorStates(this.connector, {
            master: {
                'msg:reserve.request': this._reserveRequest,
                'msg:reserve.cancel':  this._reserveCancel,
                'msg:reserve.commit':  this._reserveCommit,
                'msg:reserve.state': this._reserveState
            },
            default: {
                'msg:reserve.state': this._reserveState
            },
            context: this
        }).start();

        this._reservations = new BiMap('resv', 'client');

        this.connector.neuron.on('disconnect', this.onDendriteDisconnect.bind(this));
    },

    reserveRequest: function (id, resources, src) {
        this._reservations.add(id, src, true);
        this.connector.send(Message.make('reserve.request', { id: id, resources: resources }), 'master');
    },

    reserveCancel: function (id) {
        this.connector.send(Message.make('reserve.cancel', { id: id }), 'master');
    },

    reserveCommit: function (id) {
        this.connector.send(Message.make('reserve.commit', { id: id, usages: this._collector.exportUsages() }), 'master');
    },

    onDendriteDisconnect: function (id) {
        this._reservations.removeAll(id, 'client');
    },

    // message handlers on master
    _reserveRequest: function (msg, src) {
        var reservation = { id: msg.data.id, resources: msg.data.resources, src: src };
        if (reservation.id && typeof(reservation.resources) == 'object') {
            var nodeId = this._resourcePool.reserve(reservation);
            this._notifyReserveState(reservation, nodeId, nodeId ? 'ok' : 'busy');
        }
    },

    _reserveCancel: function (msg, src) {
        this._removeReservation(msg.data.id);
    },

    _reserveCommit: function (msg, src) {
        this._removeReservation(msg.data.id, msg.data.usages, src);
    },

    _removeReservation: function (id, usages, src) {
        var reservation = this._resourcePool.unreserve(id);
        if (usages && src) {
            usages = ResourceUsage.importUsages(usages);
            usages && this._resourcePool.updateUsages(src, usages);
        }
        reservation && this._notifyReserveState(reservation, null, usages ? 'commit' : 'cancel');
    },

    _notifyReserveState: function (reservation, nodeId, state) {
        this.connector.send(Message.make('reserve.state', { id: reservation.id, node: nodeId, state: state }), reservation.src);
    },

    // message handlers on all node states
    _reserveState: function (msg) {
        var clientIds = this._reservations.keys(msg.data.id, 'resv');
        this.connector.neuron.cast(msg, { target: clientIds });
        if (!msg.data.node) {
            this._reservations.removeAll(msg.data.id, 'resv');
        }
    }
});

module.exports = Allocator;
