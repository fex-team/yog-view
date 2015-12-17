'use strict';

var layer = require('./lib/layer.js');
var combine = require('./lib/combine.js');
var _ = require('./lib/util.js');

function yogViewEngine(app, engine, settings) {
    // 将res注入到locals中提供模板渲染时使用
    app.use(function (req, res, next) {
        res.locals.__res__ = res;
        next();
    });

    settings.views = app.get('views');
    var EngineClass = _.resolveEngine(engine);
    this.engine = new EngineClass(app, settings);
    this.settings = settings;
}

yogViewEngine.prototype.cleanCache = function () {
    this.engine.cleanCache && this.engine.cleanCache();
};

yogViewEngine.prototype.renderFile = function (filepath, locals, done) {
    var res = locals.__res__;
    var settings = this.settings;
    var me = this;
    // 初始化 layer 层。
    // 提供 addScript, addStyle, resolve, addPagelet 各种接口。
    // 用来扩展模板层能力。
    var prototols = layer(res, settings);

    if (prototols.bigpipe.isSpiderMode) {
        // 获取所有异步pagelet信息
        prototols.bigpipe.prepareAllSources().then(function (data) {
            render();
        }).catch(function (err) {
            // prepareAllSources 不会因为数据准备异常而触发异常，而是错误的 bind 才会引发异常，比如没有返回一个 Promise
            done(err);
        });
    }
    else {
        render();
    }

    function render() {
        var sentData = false;

        me.engine.makeStream(filepath, _.mixin(locals, {
                _yog: prototols
            }))
            // 合并 tpl 流 和 bigpipe 流。
            .pipe(combine(prototols))
            // 设置默认content-type
            .on('data', function () {
                sentData = true;
                if (!res.get('Content-Type')) {
                    res.type('html');
                }
                setImmediate(function () {
                    res.flush();
                });
            })
            // bigpipe异步回调异常
            .on('error', function (error) {
                // 属于 chunk error
                if (sentData) {
                    if (typeof settings.chunkErrorHandler === 'function') {
                        settings.chunkErrorHandler(error, res);
                    }
                    else {
                        res.write('<script>window.console && console.error("chunk error", "' + error.message.replace(
                            /"/g,
                            '\\\"') + '")</script>');
                    }
                    res.end();
                }
                else {
                    // 模板渲染前报错，传递至next
                    done(error);
                }
            })
            // 直接输出到 response.
            .pipe(res);
    }
};

module.exports = yogViewEngine;
