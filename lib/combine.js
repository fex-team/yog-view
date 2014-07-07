var Transform = require('stream').Transform;

module.exports = function(layer) {
    var stream = new Transform();
    var bigpipe = layer.bigpipe;
    var isQuickingMode = bigpipe && bigpipe.isQuickingMode();
    var identify = layer.BIGPIPE_HOOK;

    stream._transform = function(chunk, encoding, done) {
        var output = isQuickingMode ? '' : layer.filter(chunk.toString());
        var idx = identify ? output.indexOf(identify) : -1;
        var clouser = '';
        
        // bigpipe mode
        if (bigpipe && (~idx || isQuickingMode)) {
            
            if (~idx) {
                clouser = output.substring(idx + identify.length);
                output = output.substring(0, idx);
            }

            this.push(output);

            // bigpipe is a readable stream.
            return bigpipe

                .on('data', function(chunk) {
                    stream.push(chunk);
                })

                .on('end', function() {
                    stream.push(clouser);
                    done();
                })

                .on('error', function(reason) {
                    done(reason || 'bigpipe render error!');
                });
        }
        
        this.push(output);
        return done();
    };

    return stream;
};