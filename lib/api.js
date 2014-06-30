var path = require('path');

var createHanlder = module.exports = function(fis, bigpipe, views) {

    var loaded = [];

    // include all async files
    var asyncs = [];

    // include all sync files
    var syncs = [];

    var framework;

    // collect all inner script
    var scripts = [];

    // collect all inner style
    var styles = [];

    var asyncToSync = {};

    var loadDeps = function(res, async) {
        if (res['deps']) {
            res['deps'].forEach(function (id) {
                load(id, async);
            });
        }

        if (res['extras'] && res['extras']['async']) {
            res['extras']['async'].forEach(function (id) {
                load(id, true);
            });
        }
    };

    var load = function(id, async) {
        var uri = '';
        var info, pkgInfo, url, type;

        if (loaded[id]) {
            if (!async && asyncs[id] && !asyncToSync[id]) {
                info = asyncs[id];
                loadDeps(info, async);
                syncs[info['type']] = syncs[info['type']] || [];
                syncs[info['type']].push(info['uri']);
                asyncToSync[id] = info['uri'];
            }
            return loaded[id];
        } else {
            info = fis.getInfo(id, true);

            if (info) {
                type = info['type'];
                if (info['pkg']) {
                    pkgInfo = fis.getPkgInfo(info['pkg']);
                    uri = pkgInfo['uri'];

                    if (pkgInfo['has']) {
                        pkgInfo['has'].forEach(function (id) {
                            loaded[id] = uri;
                        });

                        pkgInfo['has'].forEach(function (id) {
                            loadDeps(fis.getInfo(id, true), async);
                        });
                    }
                } else {
                    uri = info['uri'];
                    loaded[id] = uri;
                    loadDeps(info, async);
                }

                //only the javascript file maybe is a async file.
                if (!async || type == 'css') {
                    syncs[type] = syncs[type] || [];
                    syncs[type].push(uri);
                } else {
                    asyncs[id] = info;
                }

                return uri;
            } else {
                // log.warning('not found resource, resource `id` = ' + id);
            }
        }
    };

    return {

        CSS_HOOK: '<!--FIS_CSS_HOOK-->',
        JS_HOOK: '<!--FIS_JS_HOOK-->',
        BIGPIPE_HOOK: bigpipe ? '<!--FIS_BIGPIPE_HOOK-->' : '',
        
        /**
         * collect all inner js.
         * @param script  the code between <script> and </script>.
         */
        addScript: function (script) {
            scripts.push(script);
        },

        /**
         * collect all inner css
         * @param style  the code between <style> and </style>
         */
        addStyle: function (style) {
            styles.push(style);
        },

        setFramework: function(js) {
            framework = fis ? fis.resolve(js) : js;
        },

        getFramework: function() {
            return framework;
        },

        load: function() {
            fis && load.apply(this, arguments);
        },

        resolve: function(id) {
            var resolved = fis && fis.resolve(id);
            
            if (resolved) {
                return path.join(views, resolved);
            }

            return id;
        },

        supportBigPipe: function() {
            return !!bigpipe;
        },

        addPagelet: function() {
            return bigpipe && bigpipe.addPagelet.apply(bigpipe, arguments);
        },

        fork: function(fis, bigpipe, views) {
            
            if (arguments.length === 0) {
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
        },

        getResourceMap: function() {
            var id, rMap, res, pkg;

            for (id in asyncs) {
                res = asyncs[id];

                if (res['type'] != 'js') {
                    continue;
                }

                rMap = rMap || {};
                rMap['res'] = rMap['res'] || {};
                rMap['pkg'] = rMap['pkg'] || {};

                rMap['res'][id] = {
                    'url': res['uri'],
                    'deps': res['deps'] || [],
                }

                if (res['pkg']) {
                    rMap['res'][id]['pkg'] = res['pkg'];
                }

                if (asyncs[id]['pkg'] && this.fis) {
                    pkg = fis.getPkgInfo(asyncs[id]['pkg']);
                    rMap['pkg'][asyncs[id]['pkg']] = {
                        'url': pkg['uri']
                    }
                }
            }
            return rMap;
        },

        getScripts: function() {
            return {
                urls: syncs.js,
                embed: scripts
            }
        },

        getStyles: function() {
            return {
                urls: syncs.css,
                embed: styles
            }
        },

        filter: function(content) {
            if(~content.indexOf(this.JS_HOOK)) {
                content = this.filterJs(content);
            }

            if(~content.indexOf(this.CSS_HOOK)) {
                content = this.filterCss(content);
            }

            return content;
        },

        filterJs: function(content) {
            var resourceMap = this.getResourceMap();
            var scripts = this.getScripts();
            var js = '';
            

            var loadModjs = (scripts.urls || resourceMap) && framework;
            var p;

            if (loadModjs) {
                //if need `mod.js`, keep it first.
                js += '<script src="' + framework + '"></script>';
                if (resourceMap) {
                    js += '<script type="text/javascript">require.resourceMap(' + JSON.stringify(resourceMap) + ');</script>';
                }
            }

            if (scripts.urls) {
                if ((p = scripts.urls.indexOf(framework)) !== -1) {
                    scripts.urls.splice(p, 1); //remove `mod.js`
                }

                js += '<script type="text/javascript" src="' + scripts.urls.join('"></script>\n<script type="text/javascript" src="') + '"></script>';
            }

            if (scripts.embed.length) {
                js += '\n<script type="text/javascript">\n!function() {' + scripts.embed.join('}();\n!function() {') + '}();</script>\n';
            }

            return content.replace(this.JS_HOOK, js);
        },

        filterCss: function(content) {
            var css = '';
            var styles = this.getStyles();

            if (styles.urls) {
                css += '<link rel="stylesheet" href="' + styles.urls.join('" />\n<link rel="stylesheet" href="') + '" />';
            }

            if (styles.embed.length) {
                css += '\n<style type="text/css">' + styles.embed.join('\n') + '</style>';
            }

            return content.replace(this.CSS_HOOK, css);
        },

        destroy: function() {
            loaded = asyncs = syncs = scripts = styles = asyncToSync = null;
            this.fis = this.bigpipe = this.views = null;
            fis = bigpipe = views = null;
        },

        // references
        fis: fis,
        bigpipe: bigpipe,
        views: views
    }
};