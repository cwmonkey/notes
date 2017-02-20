(function($, GoogleDriveSaver, GDSaver, GDLoader, Note, showdown, debug, undefined) {

  /////////////////////////////
 // Google Drive Auth Buttons
/////////////////////////////

var gd_auth_name = '__make-note-gdauth';

var $gdauthorize = $('[data-type="gdauthorize"]');
var $gddisable = $('[data-type="gddisable"]');
var $gdsync = $('[data-type="gdsync"]');

var $notes_wrapper = $('[data-type="notes-wrapper"]');

var update_gauth = function() {
  debug && console.log('update_gauth');
  var value = parseInt(localStorage.getItem(gd_auth_name));

  if ( value ) {
    $gdauthorize.hide();
    $gddisable.show();
    $gdsync.show();
  } else {
    $gdauthorize.show();
    $gddisable.hide();
    $gdsync.hide();
  }
};

var gd_authorize = function() {
  gd.enable(false)
    .then(function() {
      debug && console.log('gd_authorize success');
      localStorage.setItem(gd_auth_name, 1);
      update_gauth();
      notes_loader.tryLoad();
    })
    .catch(function(err) {
      debug && console.log('gd_authorize failed:', err);
      localStorage.setItem(gd_auth_name, 0);
      update_gauth();
    });
};

$gdauthorize.bind('click', function() {
  $gdauthorize.hide();

  gd_authorize();
});

$gddisable.bind('click', function() {
  localStorage.removeItem(gd_auth_name);
  update_gauth();
  notes_loader.clearTimeout();
});

var gd_load_notes = function(force) {
  notes_loader.tryLoad(force)
    .then(function(data) {
      debug && console.log('gd_load_notes success:', data);
      localStorage.setItem(gd_auth_name, 1);
      update_gauth();
    })
    .catch(function(reason) {
      debug && console.log('gd_load_notes failed:', reason);
      localStorage.setItem(gd_auth_name, 0);
      update_gauth();
    });
};

$gdsync.bind('click', gd_load_notes);

  /////////////////////////////
 // Markdown
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
 // $.fn.serializeObject
/////////////////////////////

// Get form as {name: value...}
$.fn.serializeObject = function() {
  var obj = {};

  this.serializeArray().forEach(function(val) {
    obj[val.name] = val.value;
  });

  return obj;
};

  /////////////////////////////
 // Template
/////////////////////////////

var if_reg = /\{\{ *#if +([a-z_][a-z_0-9A-Z]*) *\}\}/g;
var else_reg = /\{\{ *else *\}\}/g;
var endif_reg = /\{\{ *\/if *\}\}/g;
var each_reg = /\{\{ *#each +([a-z_][a-z_0-9A-Z]*) *\}\}/g;
var endeach_reg = /\{\{ *\/each *\}\}/g;
var trim_reg = /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g;
var n_reg = /\n/g;
var this_reg = /\{\{ *this *\}\}/g;
var var_raw_reg = /\{\{\{ *([a-z_][a-z_0-9A-Z]*) *\}\}\}/g;
var var_reg = /\{\{ *([a-z_][a-z_0-9A-Z]*) *\}\}/g;

var compile = function(html) {
  var fn = "function(d,undefined){var html='";
  fn += html
    .replace(trim_reg, '')
    .replace(n_reg, '\\\n')
    .replace(if_reg, "';if (d.$1) {html+='")
    .replace(else_reg, "';}else{html+='")
    .replace(endif_reg, "';}html+='")
    .replace(each_reg, "';for(var i=0,l=d.$1.length,v;i<l;i++){v=d.$1[i];html+='")
    .replace(endeach_reg, "';};html+='")
    .replace(this_reg, "';html+=v;html+='")
    .replace(var_raw_reg, "';if(d.$1!==undefined){html+=d.$1};html+='")
    .replace(var_reg, "';if(d.$1!==undefined){html+=d.$1};html+='")
    ;
  fn += "';return html}";
  eval('var func = ' + fn);
  return func;
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
 // Notes
/////////////////////////////

var save_notes = function() {
  var snotes = {};
  for ( var key in notes ) {
    if ( notes.hasOwnProperty(key) ) {
      snotes[key] = notes[key].export();
    }
  }

  snotes = JSON.stringify(snotes);
  localStorage.setItem(file_name, snotes, true);
  gdsaver_notes.save(snotes, true);
};

var add_note = function(values) {
  debug && console.log('add_note', values);
  var note = new Note(values, note_tpl, md);

  notes[note.id] = note;
  note.$el.appendTo($notes);

  $add_form
    [0].reset();

  $add_form
    .find('textarea').css({height: ''}).end();

  return note;
};

var sync = function(data, local) {
  debug && console.log('sync', data);
  var gd_notes;
  var changed = false;

  try {
    gd_notes = JSON.parse(data || '{}');
  } catch(e) {
    gd_notes = {};
  }

  // Sync notes
  for ( var key in gd_notes ) {
    if ( gd_notes.hasOwnProperty(key) ) {
      var gd_note = gd_notes[key];
      gd_note.id = key;
      var note = notes[key];

      // Note exists already
      if ( note ) {
        var updated = parseInt(gd_note.u, 36);

        // Update?
        if ( updated && !note.updated || updated > parseInt(note.updated, 36) ) {
          var save_note = [];

          // convert short attrs to long attrs
          for ( var i = 0, l = note.attrs.length, a; i < l; i++ ) {
            a = note.attrs[i];
            save_note.push({
              name: a.p,
              value: gd_note[a.s] || undefined
            });
          }

          note.save(save_note, true);
          changed = true;
        }
      // Note doesn't exist, add it
      } else {
        add_note(gd_note);
        changed = true;
      }
    }
  }

  if ( changed && !local ) {
    localStorage.setItem(file_name, JSON.stringify(notes), true);
  }
  debug && console.log('sync end');
};

var scroll_notes_window = function() {
  $notes_window.animate({scrollTop: $notes_window.prop('scrollHeight')}, 100);
};

  /////////////////////////////
 // Init
/////////////////////////////

var $notes_window = $('[data-type="notes-window"]')
var $add_form = $('[data-type="add-edit"]');
var $notes = $('[data-type="notes"]');
var notes;
var gd = new GoogleDriveSaver('935193854133-pt3okf2v2qo7mbds6as2l6sll7in68kb.apps.googleusercontent.com', true);
var file_name = '__notes-notes';
var gd_auth_name = '__notes-gdauth';
var gdsaver_notes = new GDSaver(gd, gd_auth_name, file_name);
var notes_loader = new GDLoader(gd, file_name, undefined, sync);

/*gd.loadScript()
  .then(function() {
    //update_gauth();
  })
  .catch(function(reason) {
    debug && console.log('loadScript failed');
  });*/

gd_load_notes(true);

var note_tpl_html = $('[data-type="note-tpl"]').html();
var note_tpl = compile(note_tpl_html);

// Load notes
try {
  notes = localStorage.getItem(file_name) || '{}';
  notes = JSON.parse(notes);
} catch(e) {
  notes = {};
}

var note;

for ( var key in notes ) {
  if ( notes.hasOwnProperty(key) ) {
    if ( !notes[key].d ) {
      notes[key].id = key;
      note = add_note(notes[key]);
    }
  }
}

scroll_notes_window();

$(document)
  .delegate('[data-type="add-edit"] textarea', 'input drop paste cut delete click', function() {
    autosize(this);
  })
  .delegate('[data-type="add-edit"]', 'submit', function(event) {
    debug && console.log('[data-type="add-edit"] submit');

    event.preventDefault();
    var $this = $(this);
    var values = $this.serializeObject();

    if ( !values.body ) {
      return;
    }

    var note = add_note(values);
    save_notes();
    scroll_notes_window();
  })
  ;

})(window.jQuery, window.GoogleDriveSaver, window.GDSaver, window.GDLoader, window.Note, window.showdown, window.debug);