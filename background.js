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
    log.running = setInterval(log.tick, 1000);
    var entry = new LogEntry(issue);
    log.entries.push(entry);
    return entry;

  },
  stop: function() {
    clearInterval(log.running);
    log.running = false;
    var entry = log.entries.last();
    console.log('complete time: ' + entry.formatTime(), entry);
  },
  tick: function() {
    log.entries.last().tick();
  }
};

log.entries.last = function() {
  return this.length > 0 ? this[this.length - 1] : undefined;
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
