/*
TODO:
Fix problem with not updating note when app is closed while uploading image

Don't show menu when scrolling on ios
Remember what was being typed per category and have an indicator for text typed when changing categories

Figure out why deleted category call 404's
Color schemes
Delete all notes in category
Smarter deleting
Tests - at least in-browser ones
Red/green indicators on status messages
Check for rate limiting
Edit revisions

*/

;(function(
  $, Tpl, GoogleDriveAPI, showdown, moment,
  Thing, ThingCollection, Note, Category, Preference,
  ImageClipboard, Clipboard, Imgur,
  notesDebug, debug, undefined) {

// TODO: Move stuff in here
var App = function() {

};

// Debugging
var debug_icon = String.fromCodePoint(128196);
var debug_name = 'notes.js';
var debug_styles = {
  nameStart: 'background:#252627;border-top-left-radius:3px;border-bottom-left-radius:3px;',
  nameEnd: 'background:#252627;border-top-right-radius:3px;border-bottom-right-radius:3px;color:#fff',
  reset: 'background:transparent'
};
var debug_prepend = [debug_icon + ' %c %c' + debug_name + ' %c', debug_styles.nameStart, debug_styles.nameEnd, debug_styles.reset];

App.debug = debug || notesDebug;
App.log = function() {
  var args = Array.prototype.slice.call(arguments);
  args.unshift.apply(args, debug_prepend);
  console.log.apply(console, args);
};

App.trace = function() {
  var args = Array.prototype.slice.call(arguments);
  args.unshift.apply(args, debug_prepend);
  console.trace.apply(console, args);
};

var me = App;

me.log('loading...');

/**
 * Sort a list of elements and apply the order to the DOM.
 *
 * https://gist.github.com/mindplay-dk/6825439
 */
jQuery.fn.order = function(asc, fn) {
  fn = fn || function (el) {
    return $(el).text().replace(/^\s+|\s+$/g, '');
  };
  var T = asc !== false ? 1 : -1,
      F = asc !== false ? -1 : 1;
  this.sort(function (a, b) {
    a = fn(a), b = fn(b);
    if (a == b) return 0;
    return a < b ? F : T;
  });
  this.each(function (i) {
    this.parentNode.appendChild(this);
  });
};

var note_order = function (el) {
  var thing = $(el).data('__thing');
  var ret = parseInt(thing.order || thing.id, 36) || 1000;

  return ret;
};

  /////////////////////////////
 // Textarea resizer
/////////////////////////////

var $autosize_holder;
var autosize = function(el) {
  if ( !$autosize_holder ) {
    $autosize_holder = $('<span style="width:0;display:inline-block"></span>');
  }

  var $el = $(el);
  var height = $el.outerHeight(true);

  $autosize_holder
    .css({height: height})
    .insertAfter($el);

  var w = el.style.width;
  el.style.cssText = 'height:auto;' + (w?'width:'+w:'');
  height = $el.outerHeight(true);
  el.style.cssText = 'padding-top:0; padding-bottom:0; border-top:0; border-bottom:0;' + (w?'width:'+w:'');
  var extra = height - $el.outerHeight(true);
  el.style.cssText = 'height:' + (el.scrollHeight + extra) + 'px;' + (w?'width:'+w:'');
  $autosize_holder.detach();
  $el.trigger('autosize');
};

  /////////////////////////////
 // Clipboard setup
/////////////////////////////

var $copyr = $('#copyr');

new Clipboard('.copy', {
  target: function(trigger) {
    var $note = $(trigger).closest('[data-type="tpl"]');
    var note = $note.data('__thing');
    $copyr.val(note.body);

    return $copyr[0];
  }
});

  /////////////////////////////
 // Markdown setup
/////////////////////////////

var converter = new showdown.Converter({
  tasklists: false,
  tables: true,
  strikethrough: true,
  simplifiedAutoLink: true,
  simpleLineBreaks: true,
});

var md = function(text) {
  var html = converter.makeHtml(text);

  return html;
};

  /////////////////////////////
 // App setup
/////////////////////////////

var app_name = '__notes';
var app_data_name = app_name + '--data';
var note_body_data_name = app_name + '--note-body';
var collections = [];
var $document = $(document);

// Image Uploads
var imgur = new Imgur('a0d384a3667ce2a');

  /////////////////////////////
 // Google Drive Auth Buttons
/////////////////////////////

var $gdauthorize = $('[data-type="gdauthorize"]');
//var $gddisable = $('[data-type="gddisable"]');
var $gdsync = $('[data-type="gdsync"]');
var $gdstatus = $('[data-type="gdstatus"]');
var filename_reg = /^__notes--data--([a-z]+)--([a-zA-Z0-9_]+)/;
var gdloading = false;
var filename = app_data_name;
var gdfiles = {};
var gdfiles_by_name = {};

var gd = new GoogleDriveAPI({
  clientId: '935193854133-pt3okf2v2qo7mbds6as2l6sll7in68kb.apps.googleusercontent.com'
});

if ( me.debug ) {
  window.gd = gd;
}

var gdstatus = function(text) {
  var log = text + ' - ' + moment().format('h:mm:ssa');
  me.debug && me.log('gdstatus', log);
  $gdstatus.html(log);
};

var gdauthfail = function(error, resp) {
  me.debug && me.log('gdauthfail', error, resp);
  gdstatus('Could not authorize. Please log in again.');
  $gdauthorize.show();
  $gdsync.hide();
};

var gdsavenew = function(thing) {
  thing.save([
    {name: 'gdsaving', value: 1}
  ]);

  gdstatus('Adding to Google Drive...');

  var gdname = filename + '--' + thing.type + '--' + thing.id;
  gd.addFile(gdname, JSON.stringify(thing.export(true)), function(resp) {
    gdstatus('Added to Google Drive.');

    gdfiles_by_name[gdname] = resp;
    gdfiles[resp.id] = {
      id: resp.id,
      modifiedTime: resp.modifiedDate
    };

    thing.save([
      {name: 'gdfileid', value: resp.id},
      {name: 'gdupdated', value: resp.modifiedDate},
      {name: 'gdsaving', value: undefined}
    ]);

    if ( thing.$el ) {
      thing.$el.removeClass('saving');
    }

    if ( thing.$els ) {
      thing.$els.removeClass('saving');
    }
  }, function(error, resp) {
    me.debug && me.log('gdsavenew', error, resp);
    if ( resp.error.code == 403 ) {
      gdstatus('Google Drive rate limit exceeded.');
      gdratelimited = true;
      return;
    }

    gdstatus('Could not add to Google Drive. Trying to re-authorize...');

    gd.checkAuth(function() {
      gdsavenew(thing);
    }, gdauthfail);
  });
};

var gdsave = function(thing) {
  thing.save([
    {name: 'gdsaving', value: 1}
  ]);

  gdstatus('Saving update to Google Drive...');
  // TODO: detect an edit before a save could happen
  var file = gdfiles[thing.gdfileid];
  gd.updateFile(file, JSON.stringify(thing.export(true)), function(resp) {
    gdstatus('Saved update to Google Drive.');

    gdfiles_by_name[resp.title] = resp;
    gdfiles[resp.id] = {
      id: resp.id,
      modifiedTime: resp.modifiedDate
    };

    thing.save([
      {name: 'gdfileid', value: resp.id},
      {name: 'gdupdated', value: resp.modifiedDate},
      {name: 'gdsaving', value: undefined}
    ]);

    if ( thing.$el ) {
      thing.$el.removeClass('saving');
    }

    if ( thing.$els ) {
      thing.$els.removeClass('saving');
    }
  }, function(error, resp) {
    me.debug && me.log('gdsave', error, resp, file);
    if ( resp.error.code == 403 ) {
      gdstatus('Google Drive rate limit exceeded.');
      gdratelimited = true;
      return;
    }

    if ( resp.error.code === 404 ) {
      // TODO
    } else {
      gdstatus('Could not save update to Google Drive. Trying to re-authorize...');

      gd.checkAuth(function() {
        gdsave(thing);
      }, gdauthfail);
    }
  });
};

var gddelete = function(thing) {
  gdstatus('Deleting from Google Drive...');
  thing.save([
    {name: 'gdsaving', value: 1}
  ]);

  // TODO: detect a delete before a save could happen
  var file = gdfiles[thing.gdfileid];
  gd.deleteFile(file, function(resp) {
    gdstatus('Deleted from Google Drive.');

    collection_obj[plurals[thing.type]].del(thing.id);
  }, function(error, resp) {
    me.debug && me.log('gddelete', error, resp);
    if ( resp.error.code == 403 ) {
      gdstatus('Google Drive rate limit exceeded.');
      gdratelimited = true;
      return;
    }

    gdstatus('Could not delete from Google Drive. Trying to re-authorize...');

    gd.checkAuth(function() {
      gdsave(thing);
    }, gdauthfail);
  });
};

var gdqueue = [];
var gdratelimited = false;
var self = this;
var gdrundownloadqueue = function() {
  if ( gdratelimited ) {
    me.debug && me.log('gdrundownloadqueue', 'Rate limited, bailing');
    return;
  }

  var q = gdqueue[0];

  if ( !q ) {
    return;
  }

  gd.getFile(q[0], function() {
    q[1].apply(self, arguments);
    gdqueue.shift();
    gdrundownloadqueue();
  }, q[2]);
};

var gdqueuedownload = function(file, onload, onerror) {
  gdqueue.push([file, onload, onerror]);
  if ( gdqueue.length === 1 ) {
    gdrundownloadqueue();
  }
};

var plurals = {'note': 'notes', 'category': 'categories', 'preference': 'preferences'};
var singles = {'notes': 'note', 'categories': 'category', 'preferences': 'preference'};
var gdaddthing = function(id, type, file) {
  gdstatus('Retrieving from Google Drive...');

  gdqueuedownload(file, function(content) {
    gdstatus('Retrieved from Google Drive.');
    var thing = collection_obj[plurals[type]].get(id);

    var data = content;

    if ( typeof content === 'string' ) {
      data = JSON.parse(content);
    }

    if ( thing ) {
      thing.saveObj(data);
    } else {
      data.gdfileid = file.id;
      data.gdupdated = file.modifiedTime;
      data.id = id;

      thing = collection_obj[plurals[type]].add(data);

      if ( thing.deleted ) {
        // File got saved after being deleted - shouldn't be possible
        gddelete(thing);
      }
    }
  }, function(error, resp) {
    me.debug && me.log('gdaddthing', error, resp);

    if ( resp.error.code == 403 ) {
      gdstatus('Google Drive rate limit exceeded.');
      gdratelimited = true;
      return;
    }

    gdstatus('Could retrieve from Google Drive. Trying to re-authorize...');

    gd.checkAuth(function() {
      gdaddthing(id, type, file);
    }, gdauthfail);
  });
};

var gdonloadfiles = function(files, last) {
  gdloading = false;
  gdstatus('Remote data loaded.');

  var new_file;
  var file;
  var matches;
  var thing;

  for ( var key in files ) {
    if ( files.hasOwnProperty(key) ) {
      new_file = files[key];
      new_file.found = true;
      me.debug && me.log('File Meta:', new_file);

      if ( (matches = new_file.name.match(filename_reg)) ) {
        file = gdfiles[key];

        try {
          thing = collection_obj[plurals[matches[1]]].get(matches[2]);
        } catch(e) {
          thing = undefined;
        }

        if ( !file && !thing ) {
          // download file and save
          gdaddthing(matches[2], matches[1], new_file);
          gdfiles[key] = new_file;
        } else if ( file && Date.parse(file.modifiedTime) < Date.parse(new_file.modifiedTime) ) {
          // download file and update
          gdaddthing(matches[2], matches[1], new_file);
          gdfiles[key] = new_file;
        } else {
          gdfiles[key] = new_file;
        }

        gdfiles_by_name[new_file.name] = new_file;
      }
    }
  }

  if ( last ) {
    send_things_to_gd();
  }
};

var send_things_to_gd = function() {
  for ( var i = 0, l = collections.length; i < l; i++ ) {
    var collection = collections[i];

    for ( var key in collection.things ) {
      if ( collection.things.hasOwnProperty(key) ) {
        var thing = collection.things[key];
        // Maybe saved but didn't make it to GD
        if ( !thing.gdfileid ) {
          var gdfile = gdfiles_by_name[filename + '--' + thing.type + '--' + thing.id];
          if ( gdfile ) {
            thing.update('gdfileid', gdfile.id);
          } else {
            gdsavenew(thing, singles[collection.name]);
          }
        // Deleted remotely
        } else if ( thing.gdfileid && !gdfiles[thing.gdfileid].found ) {
          //thing.del();
          collection.del(key);
        }
      }
    }
  }
};

var gdonerrorfiles = function(error, resp) {
  gdloading = false;
  me.debug && me.log('gdonerrorfiles', error, resp);
  if ( resp.error.code == 403 ) {
    gdstatus('Google Drive rate limit exceeded.');
    gdratelimited = true;
    return;
  }

  gdstatus('Could not load remote data. Trying to re-authorize...');

  gd.checkAuth(function() {
    gdload();
  }, gdauthfail);
};

var gdload = function() {
  if ( gdloading ) {
    me.debug && me.log('gdload', 'cannot load, already loading');
    return;
  }

  gdloading = true;
  gdstatus('Loading remote data...');

  for ( var key in gdfiles ) {
    if ( gdfiles.hasOwnProperty(key) ) {
      gdfiles[key].found = false;
    }
  }

  gd.loadAllFiles(gdonloadfiles, gdonerrorfiles);
};

gdstatus('Loading Google Drive...');
var gdonload = function() {
  $gdauthorize.hide();
  $gdsync.show();

  gdload();
};

var gdonerror = function(error, resp) {
  $gdauthorize.show();
  $gdsync.hide();

  me.debug && me.log('gdonerror', error, resp);
  gdstatus('Please login to Google Drive');
};

gd.load(gdonload, gdonerror);

$(window).bind('focus', function() {
  gdload();
});

$gdauthorize.bind('click', function() {
  gd.checkAuthManual(gdonload, gdonerror);
});

$gdsync.bind('click', function() {
  gdload();
});

  /////////////////////////////
 // Swipe to categories
/////////////////////////////

var $app_wrapper = $('[data-type="notes-wrapper"]');
//var $notes_wrapper = $('[data-type="notes-wrapper"]');

var scroll = 0;
var scroll_width;
var mousedown = false;
var scrolled = false;

var to_left = function() {
  $app_wrapper.animate({scrollLeft: 0}, 100);
  scroll = 0;
  move_edit_form_back();
};

var to_right = function(do_scroll_width) {
  if ( do_scroll_width ) {
    scroll_width = $app_wrapper.prop('scrollWidth');
  }

  $app_wrapper.animate({scrollLeft: scroll_width}, 100);
  scroll = scroll_width;
};

$(window).bind('resize', function() {
  if ( scroll === 0 ) {
    to_left();
  } else {
    to_right();
  }
});

var check_scroll = function() {
  var width = $app_wrapper.width();
  scroll_width = $app_wrapper.prop('scrollWidth');
  var scroll_left = $app_wrapper.prop('scrollLeft');

  if ( scroll === 0 && scroll_left > 20 ) {
    to_right();
  } else if ( scroll === scroll_width && scroll_width - scroll_left - width > 20 ) {
    to_left();
  } else if ( scroll === 0 ) {
    to_left();
  } else {
    to_right();
  }
};

$app_wrapper.scroll(function() {
  if ( mousedown ) {
    scrolled = true;
  }
});

$document
  .delegate('[data-type="primary"]', 'click', function(e) {
    if ( scroll === 0 ) {
      e.preventDefault();
      e.stopPropagation();
      to_right(true);
    }
  })
  .delegate('[data-type="notes-wrapper"]', 'mousedown touchstart', function() {
    mousedown = true;
    scrolled = false;
  })
  .delegate('[data-type="notes-wrapper"]', 'mouseup touchend', function() {
    if ( mousedown && scrolled ) {
      mousedown = true;
      scrolled = false;
      check_scroll();
    }
  })
  .delegate('[data-type="show-categories"]', 'click', function(e) {
    e.preventDefault();
    e.stopPropagation();

    if ( scroll === 0 ) {
      to_right(true);
    } else {
      to_left();
    }
  })
  ;

  /////////////////////////////
 // localStorage wrapper
/////////////////////////////

var can_store;
var can_store_val = 'can_store_val';

try {
  localStorage.setItem(can_store_val, can_store_val);
  localStorage.removeItem(can_store_val);
  can_store = true;
} catch(e) {
  can_store = false;
}

var store = {
  get: function(name) {
    if ( !can_store ) return;
    return localStorage.getItem(name);
  },
  set: function(name, value) {
    if ( !can_store ) return;
    if ( typeof value !== 'string' ) value = JSON.stringify(value);
    return localStorage.setItem(name, value);
  },
  remove: function(name) {
    if ( !can_store ) return;
    return localStorage.removeItem(name);
  },
};

  /////////////////////////////
 // Save/Load handlers
/////////////////////////////

var loading = false;
var saver_timeout;

var _save = function() {
  if ( loading ) {
    return;
  }

  var save_data = {};

  for ( var i = 0, l = collections.length; i < l; i++ ) {
    var collection = collections[i];
    save_data[collection.name] = collection.export();
  }

  me.debug && me.log('saver', save_data);
  store.set(app_data_name, save_data);
};

var saver = function() {
  clearTimeout(saver_timeout);
  saver_timeout = setTimeout(_save, 10);
};

var loader = function(text) {
  var data = JSON.parse(text);
  me.debug && me.log('loader', data);

  for ( var i = 0, l = collections.length; i < l; i++ ) {
    var collection = collections[i];
    var collection_data = data[collection.name];

    if ( collection_data ) {
      collection.sync(collection_data); // TODO: Do I need this?
    }

    for ( var key in collection.things ) {
      if ( collection.things.hasOwnProperty(key) ) {
        var thing = collection.things[key];

        if ( thing.deleted && thing.gdsaving ) {
          // Assume we weren't able to delete this item and try again
          gddelete(thing);
        } else if ( thing.deleted && !thing.gdsaving ) {
          // Not sure why you're here, go away
          collection.del(thing.id);
        } else {
          gdfiles[thing.gdfileid] = {
            id: thing.gdfileid,
            modifiedTime: thing.gdupdated
          };
        }
      }
    }
  }

  general_category.update('nodelete', 1);

  scroll_notes_window();
};

  /////////////////////////////
 // Collections
/////////////////////////////

var collection_obj = {};

var add_colection = function(name, constructor, change_fn, load_fn, delete_fn) {
  var collection = new ThingCollection(name, constructor, change_fn, load_fn, delete_fn);
  collections.push(collection);
  collection_obj[name] = collection;
  return collection;
};

// Categories

var category_objs = {};
var $categories = $();
var $category_navs = $();

var category_load = function(thing) {
  var $thing = $(category_nav_tpl(thing));
  $thing.data('__thing', thing);
  $category_navs_section.append($thing);

  $category_navs = $category_navs.add($thing);

  var $option = $(category_option_tpl(thing));
  $edit_note.find('[data-type="category-options"]').append($option);

  var $category = $(category_tpl(thing));
  $notes_section.append($category);
  $category.hide();
  $category.find('[data-note-list]').sortable({
    handle: '.handle',
    axis: 'y',
    scrollSpeed: 10,
    update: function( event, ui ) {
      var $this = ui.item;
      var thing = $this.data('__thing');
      var prev = $this.prev().data('__thing');
      var next = $this.next().data('__thing');
      var prev_order = prev ? parseInt(prev.order || prev.id, 36) : 0;
      var next_order;

      if ( next ) {
        next_order = parseInt(next.order || next.id, 36);
      } else if ( prev ) {
        next_order = prev_order + 1024;
      } else {
        return;
      }

      var diff = next_order - prev_order;

      // TODO: After enough sorting it's possible this could be the same as one of the two other numbers
      var new_order = Math.floor((diff) / 2) + prev_order;

      setTimeout(function() {
        thing.update('order', new_order.toString(36));
        gdsave(thing);
      }, 0);
    }
  });

  if ( thing.todo ) {
    $category.addClass('todo_list');
  }

  $categories = $categories.add($category);

  thing.$nav = $thing;
  thing.$category = $category;
  thing.$els = $thing.add($option.add($category));

  $category_navs_section.children().order(true, note_order);

  saver();

  return thing;
};

var categories = category_objs.categories = add_colection('categories', Category,
// change
function(thing, changes) {
  if ( active_category && active_category.id === thing.id ) {
    $category_name.html(thing.title);
  }

  if ( thing.$category ) {
    if ( thing.todo ) {
      thing.$category.addClass('todo_list');
    } else {
      thing.$category.removeClass('todo_list');
    }
  }

  if ( changes.todo ) {
    var fnotes = notes.getByParams({category: thing.id});

    for ( var i = 0, note; (note = fnotes[i]); i++ ) {
      arrange_note(note);
    }

    changes.order = true;
  }

  if ( thing.$els ) {
    thing.$els.find('[data-type="title"]').html(thing.title);

    if ( thing.saving ) {
      thing.$els.addClass('saving');
    }
  }

  if ( changes.order ) {
    // TODO: DRY
    $category_navs_section.children().order(true, note_order);
    scroll_notes_window();
  }

  saver();
},
// load
category_load,
// delete
function(thing) {
  if ( active_category.id === thing.id ) {
    set_active_category(general_category);
  }

  if ( thing.$els ) {
    thing.$els.remove();
  }
  saver();
});

// Notes

var arrange_note = function(thing) {
  var id = thing.category || '_';
  var category = categories.get(thing.category) || general_category;
  var $category = category.$category;

  var $todo = thing.$el.find('[data-type="todo"]');
  if ( thing.todo && category.todo ) {
    $category.find('[data-type="todo-done"]').append(thing.$el);

    $todo.prop({
      checked: true,
      indeterminate: false
    });
  } else if ( thing.sticky ) {
    $category.find('[data-type="notes-sticky"]').append(thing.$el);
  } else {
    $category.find('[data-type="todo-new"]').append(thing.$el);

    $todo.prop({
      checked: false,
      indeterminate: false
    });
  }
};

var notes = category_objs.notes = add_colection('notes', Note,
// change
function(thing, changes) {
  if ( changes.body || changes.image ) {
    var $thing = $(note_tpl(thing));

    // Open links in new window
    // TODO: DRY
    if ( thing.image ) {
      thing.image = thing.image.replace('http:', '');
    }
    $thing.find('a').attr('target', '_blank');

    thing.$el.replaceWith($thing);

    $thing.data('__thing', thing);
    thing.$el = $thing;
  }

  if ( changes.category ) {
    var category = categories.get(thing.category) || general_category;
    category.$category.append(thing.$el);
  }

  if ( thing.gdsaving && thing.$el ) {
    thing.$el.addClass('saving');
  }

  if ( changes.todo || changes.sticky ) {
    arrange_note(thing);

    changes.order = true;
  }

  if ( changes.order ) {
    var id = thing.category || '_';
    var $category = $categories.filter('[data-id="' + id + '"]');

    // TODO: DRY
    $category.find('[data-note-list="true"]').each(function() {
      $(this).find('[data-thing="note"]').order(true, note_order);
    });
  }

  saver();
// load
}, function(thing) {
  var $thing = $(note_tpl(thing));

  // Open links in new window
  // TODO: DRY
  if ( thing.image ) {
    thing.image = thing.image.replace('http:', '');
  }
  $thing.find('a').attr('target', '_blank');

  if ( thing.gdsaving ) {
    $thing.addClass('saving');
  }
  thing.$el = $thing;
  $thing.data('__thing', thing);
  //$notes_section.append($thing);
  var id = thing.category || '_';
  var $category = $categories.filter('[data-id="' + id + '"]');
  // In case we have notes that don't have associated categories.
  // Shouldn't be able to happen
  if ( !$category.length ) {
    $category = $categories.filter('[data-id="_"]');
  }
  $category.append($thing);

  arrange_note(thing);

  // TODO: DRY
  $category.find('[data-note-list="true"]').each(function() {
    $(this).find('[data-thing="note"]').order(true, note_order);
  });

  saver();
  scroll_notes_window();
// delete
}, function(thing) {
  thing.$el.remove();

  saver();
});

// Preferences

var preferences = category_objs.preferences = add_colection('preferences', Preference,
// change
function(thing, changes) {
  if ( thing.id === 'last_category' ) {
    _set_active_category(categories.get(thing.value));
  }

  saver();
// load
}, function(thing) {
  saver();
// delete
}, function(thing) {
  saver();
});

  /////////////////////////////
 // Templates
/////////////////////////////

Tpl.addFilter('md', md);

var note_tpl = Tpl.compile($('[data-type="note-tpl"]').text());
//var preference_toggle_tpl = Tpl.compile($('[data-type="preference-toggle-tpl"]').text());
var category_nav_tpl = Tpl.compile($('[data-type="category-nav-tpl"]').text());
var category_option_tpl = Tpl.compile($('[data-type="category-option-tpl"]').text());
var category_tpl = Tpl.compile($('[data-type="category-tpl"]').text());
var add_edit_note_form_tpl = Tpl.compile($('[data-type="add-edit-note-form-tpl"]').text());
var add_edit_category_form_tpl = Tpl.compile($('[data-type="add-edit-category-form-tpl"]').text());

// Sections

var $notes_section = $('[data-type="notes"]');
var $category_navs_section = $('[data-type="category-navs"]');
var $add_note_wrapper = $('[data-type="add-note-wrapper"]');
var $add_category_wrapper = $('[data-type="add-category-wrapper"]');

var $add_note = $(add_edit_note_form_tpl());
var $edit_note = $(add_edit_note_form_tpl({edit: true}));

var $add_category = $(add_edit_category_form_tpl());
var $edit_category = $(add_edit_category_form_tpl({edit: true}));

$add_note_wrapper.append($add_note);
$add_category_wrapper.append($add_category);

// Make categories sortable
// TODO: DRY
$category_navs_section.sortable({
  axis: 'y',
  scrollSpeed: 10,
  cancel: '',
  update: function( event, ui ) {
    var $this = ui.item;
    var thing = $this.data('__thing');
    var prev = $this.prev().data('__thing');
    var next = $this.next().data('__thing');
    var prev_order = prev ? parseInt(prev.order || prev.id, 36) || 0 : 0;
    var next_order;

    if ( next ) {
      next_order = parseInt(next.order || next.id, 36) || 0;
    } else if ( prev ) {
      next_order = prev_order + 1024;
    } else {
      return;
    }

    var diff = next_order - prev_order;

    // TODO: After enough sorting it's possible this could be the same as one of the two other numbers
    var new_order = Math.floor((diff) / 2) + prev_order;

    setTimeout(function() {
      thing.update('order', new_order.toString(36));
      gdsave(thing);
    }, 0);
  }
});

loading = true;
// Make an undeletable category
var general_category = categories.add({
  id: '_',
  title: 'General',
  nodelete: 1
});

//general_category = category_load(general_category);
// Load local data

var $notes_window = $('[data-type="notes-window"]');
var scroll_notes_window_timeout;
var scroll_notes_window = function() {
  clearTimeout(scroll_notes_window_timeout);

  scroll_notes_window_timeout = setTimeout(function() {
    $notes_window.animate({scrollTop: $notes_window.prop('scrollHeight')}, 100);
  }, 100);
};

loader(store.get(app_data_name) || '{}', true);

scroll_notes_window();

setTimeout(function() {
  to_right(true);
}, 100);

// Load preferences

var last_category = preferences.get('last_category');

var active_category = general_category;
if ( last_category && last_category.value ) {
  active_category = categories.get(last_category.value) || general_category;
}

var $category_name = $('[data-type="category-name"]');
var $category_input = $add_note.find('[name="category"]');

var _set_active_category = function(thing) {
  thing = thing || general_category;
  $categories.hide().filter('[data-id="' + (thing.id || '_') + '"]').show();
  $category_navs.removeClass('active').filter('[data-id="' + (thing.id || '_') + '"]').addClass('active');
  $category_name.html(thing.title);
  to_right(true);
  scroll_notes_window();
  $category_input.val(thing.id);
  active_category = thing;
};

var set_active_category = function(thing) {
  var last_category = preferences.get('last_category');
  // Don't think this can happen anymore
  if ( thing.id && !last_category ) {
    last_category = preferences.add({
      id: 'last_category',
      value: thing.id
    });
    gdsavenew(last_category);
  // Don't think this can happen anymore
  } else if ( !thing.id && last_category ) {
    last_category.del();
    gddelete(last_category);
  // It will always be this
  } else {
    last_category.save([
      {name: 'value', value: thing.id}
    ]);
    gdsave(last_category);
  }
};

_set_active_category(active_category);

loading = false;

var $add_category_form = $('[data-type="add-category"]');

// Edit form
var move_edit_form_back = function() {
  $edit_note.detach();
};

// Edit form
var $edit_note_body = $edit_note.find('[name="body"]');
var $edit_note_category = $edit_note.find('[name="category"]');
var $edit_note_id = $edit_note.find('[name="id"]');

// Category add form
var $category_title = $('[data-type="category"] [name="title"]');

var note_edit;

// Notes

var $preview_image = $('[data-type="preview-image"]');
var $preview_image_wrapper = $('[data-type="preview-image-wrapper"]');
var $form_wrapper;

var reset_canvas_image = function() {
  var canvas = $form_wrapper.find('canvas')[0];
  var ctx = canvas.getContext("2d");

  canvas.width = 0;
  canvas.height = 0;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  canvas_image = null;
};

var reset_upload_image = function() {
  var $preview_image_wrapper = $form_wrapper.find('[data-type="preview-image-wrapper"]');
  var $upload_image_file = $form_wrapper.find('[data-type="upload-image-file"]');
  var $note_body = $form_wrapper.find('[data-type="note-body"]');

  $preview_image_wrapper.hide();
  $upload_image_file.val('').trigger('change');
  reset_canvas_image();
  $note_body.focus();
};

// Paste image
var canvas_image;
var edit;
new ImageClipboard(function(pastedImage) {
  if ( edit ) {
    $form_wrapper = $edit_note;
  } else {
    $form_wrapper = $add_note;
  }

  var $canvas = $form_wrapper.find('canvas');
  var canvas = $canvas[0];
  var ctx = canvas.getContext("2d");

  //resize
  canvas.width = pastedImage.width;
  canvas.height = pastedImage.height;
  ctx.drawImage(pastedImage, 0, 0);

  var $upload_image_file = $form_wrapper.find('[data-type="upload-image-file"]');
  var $preview_image_wrapper = $form_wrapper.find('[data-type="preview-image-wrapper"]');
  var $note_body = $form_wrapper.find('[data-type="note-body"]');

  $upload_image_file.val('').trigger('change');
  $preview_image_wrapper.show();
  canvas_image = canvas;
  $note_body.focus();
  dropped_file = null;
});

var dropped_file;

var add_edit_note = function(note, do_scroll) {
  var $this = $(this);
  $form_wrapper = $this.closest('[data-type="add-edit-note-form"]');
  var $upload_image_file = $form_wrapper.find('[data-type="upload-image-file"]');
  var $canvas = $form_wrapper.find('canvas');
  var canvas = $canvas[0];

  var file;
  var i;

  if ( do_scroll ) {
    scroll_notes_window();
  }

  if ( dropped_file ) {
    file = dropped_file;
  } else if ( canvas && canvas.width && canvas.height ) {
    var dataURL = canvas.toDataURL();
    var blobBin = atob(dataURL.split(',')[1]);
    var array = [];

    for ( i = 0; i < blobBin.length; i++ ) {
      array.push(blobBin.charCodeAt(i));
    }

    file = new Blob([new Uint8Array(array)], {type: 'image/png'});
  } else {
    var files = $upload_image_file[0].files;

    for ( i = 0; (file = files[i]); i++ ) {
      break;
    }
  }

  if ( file ) {
    if ( file.type.match(/image.*/) ) {
      if ( note.image && note.deletehash && confirm('Do you want to delete the replaced image from imgur?') ) {
        imgur.delete(note.deletehash);
      }

      gdstatus('Uploading file to Imgur...');
      imgur.upload(file, function(data) {
        gdstatus('File uploaded to Imgur.');
        note.save([
          {name: 'image', value: data.data.link},
          {name: 'deletehash', value: data.data.deletehash}
        ]);

        gdsave(note);

        if ( do_scroll ) {
          scroll_notes_window();
        }
      });
    }
  }

  reset_upload_image();
  this.reset();
};

var command_reg = /^\//;

var stored_note_body = store.get(note_body_data_name);
if ( stored_note_body ) {
  $('[data-type="add-note-wrapper"] [data-type="note-body"]').val(stored_note_body);
  store.remove(note_body_data_name);
}

var note_down_timeout;

$document
  // Submit when ctrl+enter is pressed
  .delegate('[data-type="note-body"]', 'keydown', function(e) {
    if ( (e.ctrlKey || e.metaKey) && (e.keyCode === 13 || e.keyCode === 10) ) {
      $(this).closest('form').trigger('submit');
    }
  })
  // Save textarea data
  .delegate('[data-type="add-note-wrapper"] [data-type="note-body"]', 'keyup input', function() {
    var $this = $(this);
    var val = $this.val();

    store.set(note_body_data_name, val);
  })
  // Add Note
  .delegate('[data-type="add-note-wrapper"] form', 'submit', function(ev) {
    ev.preventDefault();
    edit = false;
    var $this = $(this);

    var $body = $this.find('[name="body"]');
    var body = $body.val();

    if ( body.match(command_reg) ) {
      if ( body === '/delete all notes' ) {
        /*localStorage.removeItem(app_data_name);
        gdstatus('Deleting all remote data...');
        gd.deleteFile(filename, function() {
          gdstatus('Remote data deleted.');
        }, function(error, resp) {
          gdstatus('Failed to delete remote data.');
          console.log(error, resp);
        });*/
      } else if ( body === '/delete local data' ) {
        localStorage.removeItem(app_data_name);
        document.location.reload();
      }

      $body.val('');
    } else if ( body ) {
      var data = $this.serializeObject();
      var note = notes.add(data);

      add_edit_note.call(this, note, true);

      gdsavenew(note);
    }

    setTimeout(function() {
      $body.trigger('change');
    }, 0);

    store.remove(note_body_data_name);
  })
  .delegate('[data-type="upload-image-file"]', 'change', function() {
    var $this = $(this);
    $form_wrapper = $this.closest('[data-type="add-edit-note-form"]');
    var $preview_image = $form_wrapper.find('[data-type="preview-image"]');
    var $note_body = $form_wrapper.find('[data-type="note-body"]');
    var $preview_image_wrapper = $form_wrapper.find('[data-type="preview-image-wrapper"]');
    var files = this.files;

    $preview_image.empty();

    for ( var i = 0, l = files.length, file; i < l; i++ ) {
      file = files[i];

      if ( file.type.match(/image.*/) ) {
        reset_canvas_image();
        dropped_file = null;
        var reader = new FileReader();

        reader.onload = function (e) {
          var $img = $('<img>').attr('src', e.target.result);
          $preview_image.append($img);
          $preview_image_wrapper.show();

          setTimeout(function() {
            $notes_window.animate({scrollTop: $notes_window.prop('scrollTop') + $preview_image_wrapper.height()}, 100);
          }, 100);
        };

        reader.readAsDataURL(file);
        break;
      }
    }

    $note_body.focus();
  })
  .delegate('body', 'dragover', function(e) {
    e.stopPropagation();
    e.preventDefault();
    e.originalEvent.dataTransfer.dropEffect = 'copy';
  })
  .delegate('body', 'drop', function(e) {
    e.stopPropagation();
    e.preventDefault();

    var files = e.originalEvent.dataTransfer.files; // Array of all files

    $preview_image.empty();

    for (var i=0, file; (file = files[i]); i++) {
      if (file.type.match(/image.*/)) {
        reset_upload_image();
        reset_canvas_image();

        dropped_file = file;
        var reader = new FileReader();

        reader.onload = function(e2) {
          // finished reading file data.
          var $img = $('<img>').attr('src', e2.target.result);
          $preview_image.append($img);
          $preview_image_wrapper.show();
        };

        reader.readAsDataURL(file); // start reading the file data.
      }
    }
  })
  .delegate('[data-type="remove-image"]', 'click', reset_upload_image)
  .delegate('[data-type="add-note-wrapper"] textarea', 'input drop paste cut delete click change', function() {
    autosize(this);
  })
  // Delete Note
  .delegate('[data-type="notes-window"] [data-type="delete"]', 'click', function(ev) {
    ev.preventDefault();
    var $this = $(this);
    var $thing = $this.closest('[data-type="tpl"]');
    var thing = $thing.data('__thing');

    if ( confirm('Really delete?') ) {
      if ( thing.deletehash && confirm('Also delete imgur image?') ) {
        imgur.delete(thing.deletehash);
      }

      thing.del();

      gddelete(thing);
    }
  })
  // Edit Note
  .delegate('[data-type="notes-window"] [data-type="edit"]', 'click', function() {
    var $this = $(this);
    var $note = $this.closest('[data-type="tpl"]');
    note_edit = $note.data('__thing');

    $edit_note_body.val(note_edit.body);
    $edit_note_category.val(note_edit.category);
    $edit_note_id.val(note_edit.id);
    $note.append($edit_note);
    $edit_note_body.focus();
  })
  .delegate('[data-thing="note"] form', 'submit', function(ev) {
    ev.preventDefault();
    var $this = $(this);
    var data = $this.serializeArray();
    $edit_note.detach();

    note_edit.save(data);

    note_edit.$el.addClass('saving');
    gdsave(note_edit);

    add_edit_note.call(this, note_edit);
  })
  .delegate('[data-type="notes-window"] [data-type="cancel"]', 'click', function(ev) {
    ev.preventDefault();
    $edit_note.detach();
  })
  .delegate('[data-type="delete-image"]', 'click', function() {
    var $this = $(this);
    var $thing = $this.closest('[data-type="tpl"]');
    var thing = $thing.data('__thing');

    if ( confirm("Really delete image?") ) {
      $thing.find('[data-type="image"]').remove();

      imgur.delete(thing.deletehash);

      thing.save([
        {name: 'image', value: undefined},
        {name: 'deletehash', value: undefined}
      ]);
    }
  })
  // Mobile note tools show
  .delegate('[data-touched="false"]', 'touchstart', function() {
    $(this).attr('data-touched', 'true');
  })
  .delegate('[data-touched="false"] [data-thing="note"]', 'mouseover', function() {
    var $this = $(this);
    $('[data-thing="note"]').removeClass('hover');
    $this.addClass('hover');
  })
  .delegate('[data-thing="note"]', 'touchstart', function() {
    has_scrolled = false;
  })
  .delegate('*', 'touchmove', function() {
    has_scrolled = true;
  })
  .delegate('[data-thing="note"]', 'touchend', function() {
    var $this = $(this);
    if ( !has_scrolled ) {
      $('[data-thing="note"]').removeClass('focus');
      $this.addClass('focus');
    }

    has_scrolled = false;
  })
  // Note checks
  .delegate('[data-thing="note"] [data-type="todo"]', 'click', function(ev) {
    ev.preventDefault();
    // TODO: DRY
    var $this = $(this);
    var $thing = $this.closest('[data-type="tpl"]');
    var thing = $thing.data('__thing');
    var value;

    if ( !thing.todo ) {
      value = 1;
    }

    thing.update('todo', value);

    gdsave(thing);
  })
  // Note sort
  .delegate('[data-touched="true"] [data-thing="note"] .handle', 'mouseover', function(ev) {
    return false;
  })
  // Sticky Note
  .delegate('[data-type="notes-window"] [data-type="sticky"]', 'click', function(ev) {
    ev.preventDefault();
    var $this = $(this);
    var $thing = $this.closest('[data-type="tpl"]');
    var thing = $thing.data('__thing');
    var value;

    if ( !thing.sticky ) {
      value = 1;
    }

    thing.update('sticky', value);

    gdsave(thing);
  })
  ;

var has_scrolled = false;

// Add/Edit Category

$document
  .delegate('[data-type="category-nav"]', 'click', function(ev) {
    ev.preventDefault();
    var $this = $(this);
    var $thing = $this.closest('[data-type="tpl"]');
    var thing = $thing.data('__thing');

    set_active_category(thing);
  })
  .delegate('[data-type="add-edit-category-form"] [data-type="cancel"]', 'click', function(ev) {
    ev.preventDefault();
    $edit_category.detach();
  })
  // Delete category
  .delegate('[data-type="add-edit-category-form"] [data-type="delete"]', 'click', function(ev) {
    ev.preventDefault();
    var $this = $(this);
    var $thing = $this.closest('[data-type="tpl"]');
    var thing = $thing.data('__thing');

    if ( confirm('Really delete category? Any notes will be moved to "General"') ) {
      $edit_category.detach();
      var fnotes = notes.getByParams({category: thing.id});

      for ( var i = 0, note; (note = fnotes[i]); i++ ) {
        note.save([{name: 'category', value: undefined}]);
        gdsave(note);
      }

      collection_obj.categories.del(thing.id);

      //thing.del();
      gddelete(thing);
    }
  })
  // Add Category
  .delegate('[data-type="add-category-label"]', 'click', function() {
    $add_category_wrapper.show().find('[data-type="category-title"]').focus();
  })
  .delegate('[data-type="add-category-wrapper"] [data-type="cancel"]', 'click', function(ev) {
    ev.preventDefault();
    $add_category_wrapper.hide();
  })
  .delegate('[data-type="add-category-wrapper"] form', 'submit', function(ev) {
    ev.preventDefault();
    var $this = $(this);
    var data = $this.serializeObject();

    data.todo = data.todo || undefined;

    var category = categories.add(data);

    gdsavenew(category);

    set_active_category(category);

    this.reset();

    $add_category_wrapper.hide();
  })
  // Edit Category
  .delegate('[data-type="category-navs"] form', 'submit', function(ev) {
    ev.preventDefault();
    var $this = $(this);
    var $thing = $this.closest('[data-type="tpl"]');
    var thing = $thing.data('__thing');
    var data = $this.serializeArray();

    data.todo = data.todo || undefined;

    thing.save(data);
    gdsave(thing);

    this.reset();

    $edit_category.detach();
  })
  .delegate('[data-type="category-navs"] [data-type="edit"]', 'click', function(ev) {
    var $this = $(this);
    var $wrapper = $this.closest('[data-type="tpl"]');
    var thing = $wrapper.data('__thing');

    $edit_category.find('[name="id"]').val(thing.id);
    var $title = $edit_category.find('[name="title"]').val(thing.title);

    var $todo = $edit_category.find('[data-type="todo"]').attr('id', 'todo_' + thing.id);
    $edit_category.find('[data-type="todo_label"]').attr('for', 'todo_' + thing.id);

    if ( thing.todo ) {
      $todo.prop('checked', true);
    } else {
      $todo.prop('checked', false);
    }

    var $delete = $edit_category.find('[data-type="delete"]');
    if ( thing.nodelete ) {
      $delete.hide();
    } else {
      $delete.show();
    }

    $wrapper.append($edit_category);
    $title.focus();
  })
  ;

})(
  window.jQuery, window.Tpl, window.GoogleDriveAPI, window.showdown, window.moment,
  window.Thing, window.ThingCollection, window.Thing.Note, window.Thing.Category, window.Thing.Preference,
  window.ImageClipboard, window.Clipboard, window.Imgur,
  window.notesDebug, window.debug);