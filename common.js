var util = {};

util.formatTime = function(ms, fmt) {
  var secs = Math.round(ms / 1000); 
  var mins = secs / 60;
  secs = Math.floor(secs % 60);
  var hours = mins / 60; 
  var absHours = hours;
  mins = Math.floor(mins % 60);
  var days = Math.floor(hours / 24);
  var workDays = Math.floor(hours / 8);
  hours = Math.floor(hours % 24);
  var workHours = Math.floor(hours % 8);

  if(fmt == 'jira'){
    var rv = [];
    if(workDays) {
      rv.push(workDays + 'd');
    }
    if(workHours) {
      rv.push(workHours + 'h');
    }
    //round seconds
    if(secs >= 30) {
      mins++;
    }
    if(mins) {
      rv.push(mins + 'm');
    }        
    return rv.join(' ');
  } else {
    absHours = Math.floor(absHours);
    // hh:mm:ss
    return util.zeroPad(absHours) + ':' + 
      util.zeroPad(mins) + ':' +
      util.zeroPad(secs);
  }
};

util.formatDate = function(date, fmt) {
  if(typeof date != 'object') {
    date = new Date(date);
  }
  // yyyy.MM.dd hh:mm
  return date.getFullYear() + '.' +
    util.zeroPad(date.getMonth() + 1) + '.' +
    util.zeroPad(date.getDate()) + ' ' + 
    util.zeroPad(date.getHours())  + ':' +
    util.zeroPad(date.getMinutes());
};

util.zeroPad = function(num) {
  return num < 10 ? '0'+num : num;
};

var entryManager = {
  initialize: function() {
    entryManager.db = window.openDatabase('jira', '', 'jira', 2000000);
    if(! entryManager.db) {
      console.error('error opening database');
    } else {
      entryManager._create();
    }
  },
  _create: function() {
      entryManager.db.transaction(function(tr) {
        tr.executeSql('CREATE TABLE IF NOT EXISTS entries '+
          '(id INTEGER PRIMARY KEY, key VARCHAR(20) NOT NULL, begin INTEGER NOT NULL, end INTEGER NOT NULL, '+
          'url VARCHAR(255) NOT NULL, summary VARCHAR(255) NOT NULL)',
          [],
          function(tr, result) {},
          entryManager._error
        );
      });
  },
  _error: function(tr, err) {
    //FIXME: unshift entry?
    console.error('sql error', err);
  },
  create: function(entries) {
    entryManager.db.transaction(function(tr) {
      while(entries.length > 0) {
        var entry = entries.shift();
        tr.executeSql(
          'INSERT INTO entries (key, begin, end, url, summary) VALUES (?,?,?,?,?)',
          [entry.key, entry.begin, entry.end, entry.url, entry.summary],
          function(tr, res) {
            console.log('entry stored', res);
          },
          entryManager._error
        );
      }
    });
  },
  remove: function(id, onSuccess) {
    entryManager.db.transaction(function(tr) {
      tr.executeSql(
        'DELETE FROM entries WHERE id=?',
        [id],
        onSuccess,
        entryManager._error
      );
    });
  },
  list: function(onSuccess) {
    entryManager.db.transaction(function(tr) {
      tr.executeSql('SELECT * FROM entries', [], onSuccess, entryManager._error);
    });
  },
  set: function(id, key, value, onSuccess, onError) {
    entryManager.db.transaction(function(tr) {
      tr.executeSql(
        'UPDATE entries SET '+key+'=? WHERE id=?',
        [value, id],
        onSuccess,
        onError || entryManager._error
      );
    });
  },
  update: function(id, entry) {
    entryManager.db.transaction(function(tr) {
      tr.executeSql(
        'UPDATE entries (begin, end) VALUES (?,?) WHERE id=?',
        [entry.begin, entry.end, id],
        function(tr, res) {
          console.log('entry updated', res);
        },
        entryManager._error
      );
    });
  }
};

entryManager.initialize();
