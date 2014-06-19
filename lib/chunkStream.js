var stream = require('stream');
var util = rquire('util');
var Writeable = stream.Writeable;

var ChunkSteam = module.exports = function ChunkSteam() {
    Writeable.call(this);
}

util.inherits(ChunkSteam, Writeable);

ChunkSteam.prototype._write = function(chunk, enc, cb) {

};

ChunkSteam.prototype.flush = function() {

};