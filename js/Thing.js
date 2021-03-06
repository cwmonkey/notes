;(function(ThingDebug, debug, undefined) {

var Thing = function(params) {
  me.debug && this.log(' new Thing', params);
  var self = this;

  var values = {};

  if ( params ) {
    values = params.values || {};

    this.onChange = params.onChange;

    this.onLoad = params.onLoad;
  }

  // Long property name vs. stored short name
  this.attrs = [
    {property: 'gdfileid', alias: 'f', gd: true}, // specific to google drive files
    {property: 'gdupdated', alias: 'p', gd: true},
    {property: 'gdsaving', alias: 's', gd: true},
    {property: 'deleted', alias: 'd'}, // maybe get rid of these
    {property: 'updated', alias: 'u'}
  ];

  this.aliasToProperty = {};

  this.type = null;

  // For prototyping Thing:
  this.setup(params);

  // Add long properties as attributes to this
  this.attrs.forEach(function(val) {
    self[val.property] = values[val.property] || values[val.alias] || undefined;
    self.aliasToProperty[val.alias] = val.property;
  });

  // Existing things
  this.id = values.id;

  if ( !this.id ) {
    this.id = Date.now().toString(36);
  }

  // For prototyping Thing:
  this.init(params);
};

var me = Thing;

// Debugging
me.debug = ThingDebug || debug;

var debug_styles = {
  name: 'background:#000;font-weight:bold;color:#f7933c;border-top-left-radius:3px;border-bottom-left-radius:3px;',
  method: 'background:#000;color:#fff;border-top-right-radius:3px;border-bottom-right-radius:3px;'
};

Thing.prototype.icon = String.fromCodePoint(128217);
Thing.prototype.name = 'Thing';

Thing.prototype.logPrepend = function() {
  return [this.icon + ' %c ' + this.name + '%c', debug_styles.name, debug_styles.method];
};

Thing.prototype.log = function() {
  var args = Array.prototype.slice.call(arguments);
  var arg1 = args.shift();
  args.unshift.apply(args, this.logPrepend());
  args[0] = args[0] + arg1 + ' ';
  console.log.apply(console, args);
};

Thing.prototype.trace = function() {
  var args = Array.prototype.slice.call(arguments);
  var arg1 = args.shift();
  args.unshift.apply(args, this.logPrepend());
  args[0] = args[0] + arg1 + ' ';
  console.trace.apply(console, args);
};

// Prototypes

// For prototyping, run after base attrs are set
Thing.prototype.setup = function() { };

// For prototyping, run after attrs and id are set up
Thing.prototype.init = function() { };

// Update property, set updated flag
Thing.prototype.update = function(name, value) {
  me.debug && this.log('.update', name, value);
  var changes = {};
  var changed = false;

  if ( this[name] !== value ) {
    this[name] = value;
    this.updated = Date.now().toString(36);
    changes[name] = true;
    changed = true;
  }


  if ( changed && this.onChange ) {
    this.onChange(this, changes);
  }
};

// Save multiple values with the format {name1: value1, name2: value2, ...}
Thing.prototype.saveObj = function(values) {
  me.debug && this.log('.saveObj', values);
  var self = this;
  var modified = false;
  var changes = {};

  for ( var key in values ) {
    if ( values.hasOwnProperty(key) ) {
      var name = self.aliasToProperty[key];

      if ( name ) {
        var value = values[key] || undefined;

        if ( value !== self[name] ) {
          self[name] = value;
          modified = true;
          changes[name] = true;
        }
      }
    }
  }

  if ( modified ) {
    this.updated = Date.now().toString(36);
  }

  this.onChange(this, changes);
};

// Save multiple values with the format [{name: name1, value: value1}, ...]
Thing.prototype.save = function(values) {
  me.debug && this.log('.save', values);
  var self = this;
  var modified = false;
  var changes = {};

  values.forEach(function(val) {
    var value = val.value || undefined;

    if ( value !== self[val.name] ) {
      self[val.name] = value;
      modified = true;
      changes[val.name] = true;
    }
  });

  if ( modified ) {
    this.updated = Date.now().toString(36);
  }

  this.onChange(this, changes);
};

// Empty object
Thing.prototype.del = function() {
  me.debug && this.log('.del', this);

  this.save([{name: 'deleted', value: 1}]);

  return true;
};

// Export to simple array
Thing.prototype.export = function(skip_gd) {
  me.debug && this.log('.export', this);
  var ret = {};
  var self = this;

  this.attrs.forEach(function(val) {
    if ( self[val.property] !== undefined && (!skip_gd || !val.gd) ) {
      ret[val.alias] = self[val.property];
    }
  });

  return ret;
};

window.Thing = Thing;

})(window.ThingDebug, window.debug);