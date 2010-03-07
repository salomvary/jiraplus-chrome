var command = {
  startLog: function(request) {
    if(log.running) {
      log.stop();
    }
    return log.start(request.issue);
  },
  stopLog: function() {
    return log.stop();
  }
};


var log = {
  entries: [],
  start: function(issue){
    if(log.active) {
      log.stop();
    }
    console.log('log started', issue.key);
    log.active = new LogEntry(issue);
    log._tick = setInterval(log.tick, 1000);
    log._store = setInterval(log.store, 2000); //FIXME set to ~1m in production
    return log.active;
  },
  stop: function() {
    console.log('log stopped',log.active.key,log.active.formatTime());
    clearInterval(log._tick);
    clearInterval(log._store);
    log.entries.push(log.active);
    log.active = undefined;
    log.store();
  },
  tick: function() {
    log.active.tick();
  },
  store: function() {
    //FIXME handle localStorage errors (e.g quota proglems)
    var db = localStorage.entries ? JSON.parse(localStorage.entries) : [];
    //store history
    while(log.entries.length > 0) {
      db.push(log.entries.shift());
    }
    localStorage.entries = JSON.stringify(db);
    //store active
    if(log.active) {
      localStorage.active = JSON.stringify(log.active);
    } else {
      localStorage.removeItem('active');
    }
  }
};

var LogEntry = function(issue) {
  $.extend(this, issue);
  this.begin = new Date();
};
$.extend(LogEntry.prototype, {
  formatTime: function(format) {
    return $.formatTime(this.end - this.begin, format);
  },
  tick: function() {
    this.end = new Date();
    this.time = this.formatTime();
    lastPort.postMessage(this);
  }
});

//set up communication
function listener(request) {
  if(command[request.cmd]) {
      command[request.cmd](request);
  } else {
    throw new Error('unknown command '+request.cmd);
  }
}

//FIXME: handle multiple tabs
var lastPort;
chrome.extension.onConnect.addListener(function(port) {
  lastPort = port;
  port.onMessage.addListener(listener);
});
