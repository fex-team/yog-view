// todo 用更好的方式继承 app.response.

var response = require('./lib/response.js');
var swig = require('yog-swig');
var path = require('path');

var view = module.exports = function(options) {
    return function(req, res, next) {

        var origin = res.__proto__;

        res.__proto__ = response;
        response.__proto__ = origin;
        origin = null;

        next();
    }
};

view.engines = {
    'swig': swig
}

view.create = function(settings, app) {
    var Engine;

    settings = settings || {};

    if (app) {
        settings.views = app.get('views');
    }

    Engine = view.engines[settings.engine];

    return function(filepath, options, done) {
        var res = options.response;
        var bigpipe = res.bigpipe;

        if (!res.fis) {
            throw new Error('Fis Resource middleware is required!')
            done('error', 'fis is required!');
        }

        var fis = res.fis;
        var prototols = createHanlder(fis, bigpipe, settings.views);
        var engine = new Engine(settings, prototols);
        var bufs = [];

        // 这个模式表示是一次请求局部内容的请求。
        // 不需要把框架吐出来了。
        // 只需输出 mode="quicking" 的 widget.
        var isQuickingMode = bigpipe.isQuickingMode();
        var flush = function() {
            if (isQuickingMode) {
                return;
            }

            while((d = bufs.shift())) {
                d = fis.filter(d);
                res.write(d);
            }
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

            engine.removeAllListeners();

            if (bigpipe && (~idx || isQuickingMode)) {
                if (~idx) {
                    idx += identify.length;
                    clouser = output.substring(idx);
                    output = output.substring(0, idx);
                }
                bufs.push(output);
                flush();

                bigpipe.render(res, function() {
                    bufs.push(clouser);
                    flush();
                    done();
                });

                return;
            }

            bufs.push(output);
            flush();
            done();
        });

        engine.on('error', function(reason) {
            engine.removeAllListeners();
            done(reason);
        });

        options._yog = prototols;
        engine.renderFile(filepath, options);
    }
};

// 创建一个处理器给模板引擎使用。
function createHanlder(fis, bigpipe, views) {
    var api = {};

    ['addScript', 'addStyle', 'load', 'getUri'].forEach(function(key) {
        api[key] = function() {
            return fis[key].apply(fis, arguments);
        }
    });

    bigpipe && ['addPagelet'].forEach(function(key) {
        api[key] = function() {
            return bigpipe[key].apply(bigpipe, arguments);
        }
    });

    api.resolve = function(id) {
        if (!~id.indexOf(':')) {
            return id;
        }
        return path.join(views, fis.getUri(id));
    };

    api.setFramework = function(js) {
        this.fis.framework = js;
    };

    api.supportBigPipe = function() {
        return !!bigpipe;
    };

    api.fork = function(fis, bigpipe, views) {
        if (arguments.length === 0 ) {
            fis = this.fis;
            bigpipe = this.bigpipe;
            views = this.views;
        } else if (arguments.length === 1) {
            bigpipe = this.bigpipe;
            views = this.views;
        } else if (arguments.length === 2) {
            views = this.views;
        }

        var forked = createHanlder(fis, bigpipe, views);
        return forked;
    };

    api.fis = fis;
    api.bigpipe = bigpipe;
    api.views = views;

    return api;
}