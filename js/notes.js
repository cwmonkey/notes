/*
TODO:
When category deleted and notes moved to General, show notes and sort
Note sorting
Category sorting
Color schemes
Delete all notes in category
Sort incoming notes
Auto update on window focus

*/

;(function(
  $, Tpl, GoogleDriveAPI, showdown, moment,
  Thing, ThingCollection, Note, Category, Preference,
  ImageClipboard, Clipboard, Imgur,
  testDebug, debug, undefined) {

debug = debug || testDebug;

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

var $notes_wrapper = $('[data-type="notes-wrapper"]');

var filename = app_data_name;
var default_content = '{"preferences":{},"categories":{},"notes":{}}';

var gd = new GoogleDriveAPI({
  clientId: '935193854133-pt3okf2v2qo7mbds6as2l6sll7in68kb.apps.googleusercontent.com'
});

var gdstatus = function(text) {
  $gdstatus.html(text + ' - ' + moment().format('h:mm:ssa'));
};

var gdsave = function(text) {
  gdstatus('Saving remote data...');
  gd.updateFile(filename, text, function() {
    gdstatus('Remote data saved!');
  }, function(error, resp) {
    console.log(error, resp);
    gdstatus('Could not save remote data. Trying to re-authorize...');
    gd.checkAuth(function() {
      gdsave(text);
    }, function(error, resp) {
      console.log(error, resp);
      gdstatus('Could not authorize. Please log in again.');
      $gdauthorize.show();
      $gdsync.hide();
    });
  });
};

var gdload = function() {
  gdstatus('Loading remote data...');
  gd.loadFile(filename, default_content, function(text) {
    console.log('File content:', text);
    gdstatus('Remote data loaded!');
    loader(text);
  }, function(error, resp) {
    console.log(error, resp);
    gdstatus('Could not load remote data. Trying to re-authorize...');
    gd.checkAuth(function() {
      gdload();
    }, function(error, resp) {
      console.log(error, resp);
      gdstatus('Could not authorize. Please log in again.');
      $gdauthorize.show();
      $gdsync.hide();
    });
  });
};

gdstatus('Loading Google Drive...');
gd.load(function() {
  $gdauthorize.hide();
  $gdsync.show();

  gdload();
}, function(error, resp) {
  $gdauthorize.show();
  $gdsync.hide();

  console.log(error, resp);
});

  /////////////////////////////
 // Swipe to categories
/////////////////////////////

var $app_wrapper = $('.app_wrapper');

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

var delay_gd_save_timeout;
var force_next_save = false;
var saver = function() {
  var save_data = {};

  for ( var i = 0, l = collections.length; i < l; i++ ) {
    var collection = collections[i];
    save_data[collection.name] = collection.export();
  }

  store.set(app_data_name, save_data);

  clearTimeout(delay_gd_save_timeout);
  delay_gd_save_timeout = setTimeout(function() {
    if ( !force_next_save ) {
      force_next_save = true;
      gdload();
    } else {
      force_next_save = false;
      gdsave(JSON.stringify(save_data));
    }
  }, 1000);
};

var loader = function(text, skip_save) {
  var data = JSON.parse(text);

  for ( var i = 0, l = collections.length; i < l; i++ ) {
    var collection = collections[i];
    var collection_data = data[collection.name];

    if ( collection_data ) {
      collection.sync(collection_data, skip_save);
    }
  }

  if ( force_next_save ) {
    saver();
  }
};

  /////////////////////////////
 // Collections
/////////////////////////////

var add_colection = function(name, constructor, change_fn, load_fn) {
  var collection = new ThingCollection(name, constructor, change_fn, load_fn);
  collections.push(collection);
  return collection;
};

// Categories

var category_objs = {};
var $categories = $();
var $category_navs = $();

var category_load = function(thing) {
  console.log('==Category Added!', thing);

  var $thing = $(category_nav_tpl(thing));
  $thing.data('__thing', thing);
  $category_navs_section.append($thing);

  $category_navs = $category_navs.add($thing);

  var $option = $(category_option_tpl(thing));
  $edit_note.find('[data-type="category-options"]').append($option);

  var $category = $(category_tpl(thing));
  $notes_section.append($category);
  $category.hide();

  $categories = $categories.add($category);

  thing.$els = $thing.add($option.add($category));
};

var categories = category_objs['categories'] = add_colection('categories', Category, function(thing) {
  if ( thing.deleted ) {
    thing.$els.remove();
  } else {
    if ( active_category.id === thing.id ) {
      $category_name.html(thing.title);
    }

    if ( thing.$els ) {
      thing.$els.find('[data-type="title"]').html(thing.title);
    }
  }

  saver();
}, category_load);

// Notes

var notes = category_objs['notes'] = add_colection('notes', Note, function(thing) {
  if ( thing.deleted ) {
    console.log('==Note Deleted!', thing);

    thing.$el.remove();
  } else if ( thing.$el ) {
    console.log('==Note Edited!', thing);

    var $thing = $(note_tpl(thing));
    thing.$el.replaceWith($thing);

    $thing.data('__thing', thing);
    thing.$el = $thing;
  }

  saver();
}, function(thing) {
  console.log('==Note Added!', thing);

  var $thing = $(note_tpl(thing));
  thing.$el = $thing;
  $thing.data('__thing', thing);
  //$notes_section.append($thing);
  var id = thing.category || "_";
  $categories.filter('[data-id="' + id + '"]').append($thing);
});

// Preferences

var preferences = category_objs['preferences'] = add_colection('preferences', Preference, function(thing) {
  console.log('==Preference Added!', thing);

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

// Make an undeletable category
var general_category = {
  title: 'General'
};

category_load(general_category);

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
  active_category = categories.get(last_category.value);
}

var $category_name = $('[data-type="category-name"]');
var $category_input = $add_note.find('[name="category"]');

var set_active_category = function(thing, skip_save) {
  $categories.hide().filter('[data-id="' + (thing.id || '_') + '"]').show();
  $category_navs.removeClass('active').filter('[data-id="' + (thing.id || '_') + '"]').addClass('active');
  $category_name.html(thing.title);
  to_right(true);
  scroll_notes_window();
  $category_input.val(thing.id);

  if ( !skip_save ) {
    var last_category = preferences.get('last_category');
    if ( thing.id && !last_category ) {
      last_category = preferences.add({
        id: 'last_category',
        value: thing.id
      });
    } else if ( !thing.id && last_category ) {
      last_category.del();
    } else {
      last_category.save([
        {name: 'value', value: thing.id}
      ]);
    }
  }
};

set_active_category(active_category, true);

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

      imgur.upload(file, function(data) {
        note.save([
          {name: 'image', value: data.data.link},
          {name: 'deletehash', value: data.data.deletehash}
        ]);

        if ( do_scroll ) {
          scroll_notes_window();
        }
      });
    }
  }

  reset_upload_image();
  this.reset();
};

$document
  .delegate('[data-type="add-note-wrapper"] form', 'submit', function(ev) {
    ev.preventDefault();
    edit = false;
    var $this = $(this);

    var data = $this.serializeObject();
    var note = notes.add(data);

    add_edit_note.call(this, note, true);
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
  .delegate('[data-type="add-note"] textarea', 'input drop paste cut delete click', function() {
    autosize(this);
  })
  .delegate('[data-type="notes-window"] [data-type="delete"]', 'click', function(ev) {
    ev.preventDefault();
    var $this = $(this);
    var $thing = $this.closest('[data-type="tpl"]');
    var thing = $thing.data('__thing');

    if ( confirm("Really delete?") ) {
      thing.del();
    }
  })
  // Edit
  .delegate('[data-type="notes-window"] [data-type="edit"]', 'click', function() {
    var $this = $(this);
    var $note = $this.closest('[data-type="tpl"]');
    note_edit = $note.data('__thing');

    $edit_note_body.val(note_edit.body);
    $edit_note_category.val(note_edit.category);
    $edit_note_id.val(note_edit.id);
    $note.append($edit_note);
    scroll_notes_window();
  })
  .delegate('[data-thing="note"] form', 'submit', function(ev) {
    ev.preventDefault();
    var $this = $(this);
    var data = $this.serializeArray();
    note_edit.save(data);

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
  ;

// Add/Edit Category

$document
  .delegate('[data-type="category-nav"]', 'click', function(ev) {
    ev.preventDefault();
    var $this = $(this);
    var $thing = $this.closest('[data-type="tpl"]');
    var thing = $thing.data('__thing');

    set_active_category(thing);
  })
  .delegate('[data-type="add-category-label"]', 'click', function() {
    $add_category_wrapper.show().find('[data-type="category-title"]').focus();
  })
  .delegate('[data-type="add-edit-category-form"] [data-type="cancel"]', 'click', function(ev) {
    ev.preventDefault();
    $edit_category.detach();
  })
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
      }

      if ( active_category.id == thing.id ) {
        set_active_category(general_category);
      }

      thing.del();
    }
  })
  .delegate('[data-type="add-category-wrapper"] form', 'submit', function(ev) {
    ev.preventDefault();
    var $this = $(this);
    var $wrapper = $this.closest('[data-type="add-edit-category-form"]');
    var data = $this.serializeObject();
    var category = categories.add(data);

    set_active_category(category);

    this.reset();

    $wrapper.hide();
  })
  .delegate('[data-type="category-navs"] form', 'submit', function(ev) {
    ev.preventDefault();
    var $this = $(this);
    var $thing = $this.closest('[data-type="tpl"]');
    var thing = $thing.data('__thing');
    var data = $this.serializeArray();

    thing.save(data);

    this.reset();

    $edit_category.detach();
  })
  .delegate('[data-type="category-navs"] [data-type="edit"]', 'click', function(ev) {
    var $this = $(this);
    var $wrapper = $this.closest('[data-type="tpl"]');
    var thing = $wrapper.data('__thing');

    $edit_category.find('[name="id"]').val(thing.id);
    var $title = $edit_category.find('[name="title"]').val(thing.title);

    $wrapper.append($edit_category);
    $title.focus();
  })
  ;

})(
  window.jQuery, window.Tpl, window.GoogleDriveAPI, window.showdown, window.moment,
  window.Thing, window.ThingCollection, window.Thing.Note, window.Thing.Category, window.Thing.Preference,
  window.ImageClipboard, window.Clipboard, window.Imgur,
  window.testDebug, window.debug);