var Class  = require('js-class'),
    neuron = require('evo-neuron'),
    idioms = require('evo-idioms'),

    Collector = require('./Collector');

var Program = Class(neuron.Program, {
    constructor: function () {
        ProgramBase.prototype.constructor.call(this, 'governor', { neuron: { connects: ['connector'] } });

        this.connector = new idioms.ConnectorClient(this.neuron);
        this.collector = new Collector(this.connector, this.logger, this.options);

        this
            .dispatch('collect.usages', { schema: { usages: 'array' } })    // no response
        ;
    },

    'neuron:collect.usages': function (req, params) {
        this.collector.importUsages(req.src, params.usages);
    }
});

module.exports = Program;
