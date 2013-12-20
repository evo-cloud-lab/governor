/** @fileoverview
 * A simple reader for reading stream with content like
 * key:value per line
 */

var Class = require('js-class'),
    fs = require('fs'),
    _  = require('underscore');

var KeyValueReader = Class(process.EventEmitter, {
    constructor: function () {
        this._lines = [];
    },

    data: function (data) {
        if (Buffer.isBuffer(data)) {
            data = data.toString();
        }
        if (typeof(data) != 'string') {
            return;
        }
        var lines = data.split("\n");
        if (this._noEOL && this._lines.length > 0) {
            this._lines[this._lines.length - 1] += lines[0];
            lines.shift();
        }
        this._lines = this._lines.concat(lines);
        this._noEOL = lines.length <= 0 || lines[lines.length - 1] == '';

        this._flushLines();
    },

    end: function () {
        this._flushLines(true);
        this.emit('end');
    },

    _flushLines: function (ending) {
        while (this._lines.length > 0 &&
               (ending || !this._noEOL || this._lines.length > 1)) {
            var line = this._lines.shift();
            if (line == '') {
                continue;
            }
            var pos = line.indexOf(':');
            if (pos < 0) {
                this.emit('line', line);
            } else {
                this.emit('entry', line.substr(0, pos).trim(), line.substr(pos + 1).trim());
            }
        }
    }
}, {
    statics: {
        readStream: function (stream) {
            var reader = new KeyValueReader();
            stream.on('data', function (data) {
                reader.data(data);
            }).on('end', function () {
                reader.end();
            });
            return reader;
        },

        readFile: function (path, opts) {
            var fsOpts = _.extend({}, opts || {});
            fsOpts.autoClose = true;
            return KeyValueReader.readStream(fs.createReadStream(path, fsOpts));
        }
    }
});

module.exports = KeyValueReader;
