// todo 用更好的方式继承 app.response.

var response = require('./lib/response.js');
var swig = require('yog-swig');
var path = require('path');
var api = require('./lib/api.js');
var hacked = false;

var view = module.exports = {
    engines: {
        'swig': swig,
    },

    create: function(settings, app) {
        var Engine;

        if (arguments.length === 1) {
            app = settings;
            settings = {};
        }

        hackResponse(app);

        settings.views = app.get('views');

        Engine = view.engines[settings.engine || 'swig'];

        return function(filepath, options, done) {
            
            var res = options.response;
            var bigpipe = res.bigpipe;
            var fis = res.fis;
            var prototols = api(fis, bigpipe, settings.views);
            var engine = new Engine(settings, prototols);
            
            var bufs = [];

            // 这个模式表示是一次请求局部内容的请求。
            // 不需要把框架吐出来了。
            // 只需输出 mode="quicking" 的 widget.
            var isQuickingMode = bigpipe && bigpipe.isQuickingMode();
            var flush = function() {
                if (isQuickingMode) {
                    return;
                }

                while((d = bufs.shift())) {
                    d = prototols.filter(d);
                    res.write(d);
                }
            };

            var finish = function(err, data) {
                engine.destroy();
                options.response = engine = bigpipe = fis = null;

                if (err) {
                    return done(err);
                }

                bufs.push(data || '');
                flush();
                
                res.end();
                //res = null;

                done();
            };

            engine.on('data', function(d) {
                bufs.push(d);
            });

            engine.on('flush', flush);

            engine.on('end', function(output) {
                output = output || bufs.pop() || '';

                var identify = '</body>';
                var idx = output.indexOf(identify);
                var clouser = '';
                
                // bigpipe mode
                if (bigpipe && (~idx || isQuickingMode)) {
                    
                    if (~idx) {
                        idx += identify.length;
                        clouser = output.substring(idx);
                        output = output.substring(0, idx);
                    }

                    // flush framework.
                    bufs.push(output);
                    flush();

                    // then chunk out pagelets
                    return bigpipe.render(res, finish.bind(this, null, clouser));
                }

                // otherwise 
                finish(null, output);
            });

            engine.on('error', finish);
            options._yog = prototols;
            engine.renderFile(filepath, options);
        }
    }
};

// hack into response class.
function hackResponse(app) {
    if (hacked) return;
    hacked = true;

    app.use(function hackResponse(req, res, next) {
        var origin = res.__proto__;
        response.__proto__ = origin;
        res.__proto__ = response;
        origin = null;

        next();
    });
}