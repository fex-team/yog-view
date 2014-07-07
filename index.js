// todo 用更好的方式继承 app.response.

var response = require('./lib/response.js');
var swig = require('yog-swig');
var path = require('path');
var layer = require('./lib/layer.js');
var combine = require('./lib/combine.js');
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

        return function(filepath, locals, done) {
            
            // 关于 response 来源，请查看 hackResponse 方法。
            // 以及 lib/reponse.js
            var res = locals.response;

            // 创建一个新对象。
            var options = mixin({}, settings);
            
            // 初始化 layer 层。
            // 提供 addScript, addStyle, resolve, addPagelet 各种接口。
            // 用来扩展模板层能力。
            var prototols = layer(res.fis, res.bigpipe, settings.views);

            // 模本文件路径
            options.view = filepath;

            // 模板变量。
            // locals._yog 用来指向 layer 层。
            options.locals = mixin(locals, {_yog: prototols});

            var tpl = new Engine(options, prototols);

            tpl
                // 合并 tpl 流 和 bigpipe 流。
                .pipe(combine(prototols))

                // 直接输出到 response.
                .pipe(res);

                // 如果不需要调用 done 方法，可以直接 .pipe(res);
                // .on('data', function(chunk) {
                //     res.write(chunk);
                // })

                // .on('end', function() {
                //     done();
                // })

                // .on('error', function(reason) {
                //     done(reason || 'tpl error!');
                // });
        }
    }
};

function mixin(a, b) {
    if (a && b) {
        for (var key in b) {
            a[key] = b[key];
        }
    }
    return a;
}

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