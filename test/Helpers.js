var Class = require('js-class');

var MockedNeuron = Class(process.EventEmitter, {
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

    request: function () {
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

module.exports = {
    MockedNeuron: MockedNeuron,
    waitUntil: waitUntil
};
