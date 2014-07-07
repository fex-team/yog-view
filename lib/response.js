var proto = module.exports = {

    render: function(path, options, next) {
        options = options || {};
        options['response'] = this;
        
        var ret =  proto.__proto__.render.call(this, path, options, next);
        
        delete options.response;
        return ret;
    }

};