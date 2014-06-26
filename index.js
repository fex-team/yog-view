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

        // 让 response.render 的时候，将 response 实例作为 locals 参数携带进来。
        hackResponse(app);

        settings.views = app.get('views');
        Engine = view.engines[settings.engine || 'swig'];

        return function(filepath, options, done) {
            
            var res = options.response;
            var bigpipe = res.bigpipe;
            var prototols = api(res.fis, bigpipe, settings.views);
            var engine = new Engine(settings, prototols);

            // 这个模式表示是一次请求局部内容的请求。
            // 不需要把框架吐出来了。
            // 只需输出 mode="quicking" 的 widget.
            var isQuickingMode = bigpipe && bigpipe.isQuickingMode();

            var finish = function(err, data) {
                if (err) {
                    return done(err);
                }
                data && res.write(data);
                // prototols.destroy();
                res = finish = bigpipe = prototols = engine = null;
                done();
            };


            options._yog = prototols;
            engine.renderFile(filepath, options, function(err, output) {
                
                if (err) {
                    return finish(err);
                }

                output = prototols.filter(output);

                var identify = prototols.BIGPIPE_HOOK;
                var idx = identify ? output.indexOf(identify) : -1;
                var clouser = '';
                
                // bigpipe mode
                if (bigpipe && (~idx || isQuickingMode)) {
                    
                    if (~idx) {
                        clouser = output.substring(idx + identify.length);
                        output = output.substring(0, idx);
                    }

                    isQuickingMode || res.write(output);

                    // then chunk out pagelets
                    return bigpipe.render(res, finish.bind(this, null, isQuickingMode ? '' : clouser));
                }

                // otherwise 
                finish(null, output);
            });
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