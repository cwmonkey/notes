;(function(ThingDebug, ThingCollectionDebug, debug, undefined) {

var ThingCollection = function(name, constructor, save_fn, load_fn, delete_fn) {
  me.debug && this.log(' new ThingCollection', name);

  this.name = name;
  this.constructor = constructor;
  this.saveFn = save_fn;
  this.loadFn = load_fn;
  this.deleteFn = delete_fn;
  this.length = 0;

  this.things = {};
};

var me = ThingCollection;

// Debugging
me.debug = debug || ThingDebug || ThingCollectionDebug;

var debug_styles = {
  name: 'background:#000;font-weight:bold;color:#a6d7a5;border-top-left-radius:3px;border-bottom-left-radius:3px;',
  method: 'background:#000;color:#fff;border-top-right-radius:3px;border-bottom-right-radius:3px;'
};

me.prototype.icon = String.fromCodePoint(128218);
me.prototype.__name = 'ThingCollection';

me.prototype.logPrepend = function() {
  return [this.icon + ' %c ' + this.__name + '%c', debug_styles.name, debug_styles.method];
};

me.prototype.log = function() {
  var args = Array.prototype.slice.call(arguments);
  var arg1 = args.shift();
  args.unshift.apply(args, this.logPrepend());
  args[0] = args[0] + arg1 + ' ';
  console.log.apply(console, args);
};

me.prototype.trace = function() {
  var args = Array.prototype.slice.call(arguments);
  var arg1 = args.shift();
  args.unshift.apply(args, this.logPrepend());
  args[0] = args[0] + arg1 + ' ';
  console.trace.apply(console, args);
};

// Prototypes

ThingCollection.prototype.get = function(id) {
  return this.things[id];
};

// params = an object {attr1: val1, attr2: val2 ... }
ThingCollection.prototype.getByParams = function(params) {
  var found = [];

  for ( var key in this.things ) {
    if ( this.things.hasOwnProperty(key) ) {
      var thing = this.things[key];

      var matches = true;
      for ( var p in params ) {
        if ( params.hasOwnProperty(p) ) {
          if ( thing[p] !== params[p] ) {
            matches = false;
            break;
          }
        }
      }

      if ( matches ) {
        found.push(thing);
      }
    }
  }

  return found;
};

// params = {name1: val1, name2: val2 ... }
ThingCollection.prototype.add = function(params) {
  me.debug && this.log('.add', this.name, params);
  var data = {
    values: params,
    onLoad: this.loadFn,
    onChange: this.saveFn,
  };

  var thing = new this.constructor(data);

  if ( !thing.deleted ) {
    this.things[thing.id] = thing;

    this.length++;

    thing.onLoad(thing);
  }

  return thing;
};

ThingCollection.prototype.del = function(id) {
  me.debug && this.log('.del', this.name, id);

  var thing = this.things[id];

  if ( thing ) {
    delete this.things[id];

    this.deleteFn(thing);
  }
};

ThingCollection.prototype.save = function() {
  me.debug && this.log('.save');
  this.saveFn(this.name, this.things);
};

ThingCollection.prototype.export = function() {
  me.debug && this.trace('.export', this.name, this);
  var things_export = {};

  for ( var key in this.things ) {
    if ( this.things.hasOwnProperty(key) ) {
      var thing = this.things[key];
      things_export[key] = thing.export();
    }
  }

  return things_export;
};

ThingCollection.prototype.sync = function(data) {
  me.debug && this.log('.sync', this.name, data);
  var new_things;
  var changed = false;
  var is_different = false;

  try {
    if ( typeof data === 'string' ) {
      new_things = JSON.parse(data || '{}');
    } else {
      new_things = data;
    }
  } catch(e) {
    new_things = {};
  }

  var key;

  // Sync things
  for ( key in new_things ) {
    if ( new_things.hasOwnProperty(key) ) {
      var new_thing = new_things[key];
      new_thing.id = key;
      var thing = this.things[key];

      // Thing exists already
      if ( thing ) {
        var updated = parseInt(new_thing.u, 36);

        // Update?
        if (
          new_thing.u &&
          (
            (updated && !thing.updated)
            || updated > parseInt(thing.updated, 36)
          )
        ) {
          var save_thing = [];

          // convert short attrs to long attrs
          for ( var i = 0, l = thing.attrs.length, a; i < l; i++ ) {
            a = thing.attrs[i];
            save_thing.push({
              name: a.property,
              value: new_thing[a.alias] || undefined
            });
          }

          thing.save(save_thing);
          changed = true;
        }
      // Thing doesn't exist, add it
      } else if ( !new_thing.d ) {
        this.add(new_thing);
        changed = true;
      }
    }
  }

  // See if we have more objects
  for ( key in this.things ) {
    if ( this.things.hasOwnProperty(key) ) {
      if ( !new_things[key] ) {
        changed = true;
        break;
      }
    }
  }

  if ( changed ) {
    me.debug && this.log('.sync', this.name, 'changed', this);
    this.save();
  }

  me.debug && this.log('.sync', this.name, 'end', this);
};

window.ThingCollection = ThingCollection;

})(window.ThingDebug, window.ThingCollectionDebug, window.debug);