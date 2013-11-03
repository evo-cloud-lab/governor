var Class = require('js-class'),
    ProgramBase = require('evo-neuron').Program,

    Collector = require('./Collector');

var Program = Class(ProgramBase, {
    constructor: function () {
        ProgramBase.prototype.constructor.call(this, 'governor', { neuron: { connects: ['connector'] } });

        this.collector = new Collector(this.neuron, this.logger, this.options);
    }
});

module.exports = Program;
