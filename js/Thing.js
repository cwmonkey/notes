;(function(ThingDebug, debug, undefined) {

debug = ThingDebug || debug;

var Thing = function(params) {
  debug && console.log('Thing', params);
  var self = this;

  var values = {};

  if ( params ) {
    values = params.values || {};

    this.onChange = params.onChange;

    this.onLoad = params.onLoad;
  }

  // Long property name vs. stored short name
  this.attrs = [
    {property: 'deleted', alias: 'd'},
    {property: 'updated', alias: 'u'}
  ];

  // For prototyping Thing:
  this.setup(params);

  // Add long properties as attributes to this
  this.attrs.forEach(function(val) {
    self[val.property] = values[val.property] || values[val.alias] || undefined;
  });

  // Existing things
  this.id = values.id;

  if ( !this.id ) {
    this.id = Date.now().toString(36);
  }

  // For prototyping Thing:
  this.init(params);

  if ( !this.deleted && this.onLoad ) {
    this.onLoad(this);
  }
};

// For prototyping, run after base attrs are set
Thing.prototype.setup = function() { };

// For prototyping, run after attrs and id are set up
Thing.prototype.init = function() { };

// Update property, set updated flag
Thing.prototype.update = function(name, value) {
  debug && console.log('Thing.update', name, value);
  if ( this[name] !== value ) {
    this[name] = value;
    this.updated = Date.now().toString(36);
  }

  if ( this.onChange ) {
    this.onChange(this);
  }
};

// Save multiple values with the format [{name: name1, value: value1}, ...]
Thing.prototype.save = function(values) {
  debug && console.log('Thing.save', values);
  var self = this;
  var modified = false;

  values.forEach(function(val) {
    var value = val.value || undefined;

    if ( value !== self[val.name] ) {
      self[val.name] = value;
      modified = true;
    }
  });

  if ( modified ) {
    this.updated = Date.now().toString(36);
  }

  if ( this.onChange ) {
    this.onChange(this);
  }
};

// Empty object
Thing.prototype.del = function() {
  debug && console.log('Thing.del', this);

  var del_params = [];
  this.attrs.forEach(function(val) {
    if ( val.property == 'deleted' ) {
      del_params.push({name: val.property, value: 1});
    } else {
      del_params.push({name: val.property, value: undefined});
    }
  });

  this.save(del_params);

  return true;
};

// Export to simple array
Thing.prototype.export = function() {
  debug && console.log('Thing.export', this);
  var ret = {};
  var self = this;

  this.attrs.forEach(function(val) {
    if ( self[val.property] !== undefined ) {
      ret[val.alias] = self[val.property];
    }
  });

  return ret;
};

window.Thing = Thing;

})(window.ThingDebug, window.debug);