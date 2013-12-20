var Class  = require('js-class'),
    neuron = require('evo-neuron'),
    idioms = require('evo-idioms'),

    Collector     = require('./Collector'),
    Allocator     = require('./Allocator'),
    CPUSampler    = require('./CPUSampler'),
    MemorySampler = require('./MemorySampler');

var Program = Class(neuron.Program, {
    constructor: function () {
        ProgramBase.prototype.constructor.call(this, 'governor', { neuron: { connects: ['connector'] } });

        this.connector = new idioms.ConnectorClient(this.neuron);
        this.collector = new Collector(this.connector, this.logger, this.options);
        this.allocator = new Allocator(this.connector, this.collector, this.logger, this.options);

        this
            .dispatch('collect.usages', { schema: { usages: 'array' } })
            .dispatch('reserve.request', { schema: { id: 'string', resources: 'object' } })
            .dispatch('reserve.cancel', { schema: { id: 'string' } })
            .dispatch('reserve.commit', { schema: { id: 'string' } })
        ;

        this.samplers = [
            new CPUSampler(this.collector, this.options),
            new MemorySampler(this.collector, this.options)
        ];
    },

    run: function () {
        neuron.Program.prototype.run.apply(this, arguments);
        this.samplers.forEach(function (sampler) { sampler.start(); });
    },

    'neuron:collect.usages': function (req, params) {
        this.collector.importUsages(params.usages, req.src);
    },

    'neuron:reserve.request': function (req, params) {
        this.allocator.reserveRequest(params.id, params.resources, req.src);
    },

    'neuron:reserve.cancel': function (req, params) {
        this.allocator.reserveCancel(params.id);
    },

    'neuron:reserve.commit': function (req, params) {
        this.allocator.reserveCommit(params.id);
    }
});

module.exports = Program;
