var proto = module.exports = {

    render: function(path, options, next) {
        options = options || {};
        options['response'] = this;
        return proto.__proto__.render.apply(this, arguments);
    }

};