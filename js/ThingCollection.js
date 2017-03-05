;(function(ThingDebug, ThingCollectionDebug, debug, undefined) {

debug = debug || ThingDebug || ThingCollectionDebug;

var ThingCollection = function(name, constructor, save_fn, load_fn, delete_fn) {
  debug && console.log('ThingCollection', name, constructor, save_fn, load_fn, delete_fn);

  this.name = name;
  this.constructor = constructor;
  this.saveFn = save_fn;
  this.loadFn = load_fn;
  this.deleteFn = delete_fn;
  this.length = 0;

  this.things = {};
};

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
  debug && console.log('ThingCollection.add', params);
  var data = {
    values: params,
    onLoad: this.loadFn,
    onChange: this.saveFn,
  };

  var thing = new this.constructor(data);
  this.things[thing.id] = thing;

  this.length++;

  return thing;
};

ThingCollection.prototype.del = function(id) {
  debug && console.log('ThingCollection.del', id);

  var thing = this.things[id];

  delete this.things[id];

  this.deleteFn(thing);
};

ThingCollection.prototype.save = function() {
  debug && console.log('ThingCollection.save');
  this.saveFn(this.name, this.things);
};

ThingCollection.prototype.export = function() {
  debug && console.log('ThingCollection.export', this);
  var things_export = {};

  for ( var key in this.things ) {
    if ( this.things.hasOwnProperty(key) ) {
      var thing = this.things[key];
      things_export[key] = thing.export();
    }
  }

  return things_export;
};

ThingCollection.prototype.sync = function(data, skip_save) {
  debug && console.log('ThingCollection.sync', this, data);
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

          thing.save(save_thing, true);
          changed = true;
        }
      // Thing doesn't exist, add it
      } else if ( !new_thing.d ) {
        this.add(new_thing, true);
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

  if ( changed && !skip_save ) {
    debug && console.log('ThingCollection.sync, changed', this);
    this.save();
  }

  debug && console.log('ThingCollection.sync, end', this);
};

window.ThingCollection = ThingCollection;

})(window.ThingDebug, window.ThingCollectionDebug, window.debug);