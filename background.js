var log = {
  entries: [],
  start: function(issue){
    if(log.active) {
      log.stop();
    }
    console.log('log started', issue.key);
    log.active = issue;
    log.active.begin = new Date().valueOf();
    log._tick = setInterval(log.tick, 1000);
    log._store = setInterval(log.store, 2000); //FIXME set to ~1m in production

    //broadcast, badge
    //rpc.postToTabs({cmd: 'startLog'});
    chrome.browserAction.setBadgeText({text: 'ON'});
  },
  stop: function() {
    console.log(
      'log stopped',
      log.active.key,
      util.formatTime(log.active.end - log.active.begin)
    );
    clearInterval(log._tick);
    clearInterval(log._store);
    log.entries.push(log.active);
    log.active = undefined;
    log.store();
    //broadcast, badge
    rpc.postToTabs({cmd: 'stopLog'});
    chrome.browserAction.setBadgeText({text: ''});
  },
  tick: function() {
    log.active.end = new Date().valueOf();
    rpc.postToTabs({cmd: 'startLog', issue: log.active});
    //lastPort.postMessage(log.active);
  },
  store: function() {
    //store history
    entryManager.create(log.entries);

    //store active
    if(log.active) {
      localStorage.active = JSON.stringify(log.active);
    } else {
      localStorage.removeItem('active');
    }
  }
};

//handles incoming and outgoing messages
var rpc = {
  _ports: {},
  postToTabs: function(message, tabIds) {
    if(typeof tabIds == 'undefined') {
      //post to all tabs
      for(var tabId in rpc._ports) {
        rpc._ports[tabId].postMessage(message);
      }
    } else  {
      if(! $.isArray(tabIds)){
        tabIds = [tabIds];
      }
      tabIds.forEach(function(tabId) {
        rpc._ports[tabId].postMessage(message);       
      });
    }
  },
  command: {
    startLog: function(request) {
      if(log.running) {
        log.stop();
      }
      log.start(request.issue);
    },
    stopLog: function() {
      log.stop();
    },
    publish: function() {
      log.publish();
    }
  },
  onMessage: function(request) {
    console.log('message received',request);
    if(rpc.command[request.cmd]) {
        rpc.command[request.cmd](request);
    } else {
      throw new Error('unknown command '+request.cmd);
    }
  },
  onConnect: function(port) {
    console.log('port connected',port, port.sender.tab.id);
    rpc._ports[port.sender.tab.id] = port; //send
    port.onMessage.addListener(rpc.onMessage); //receive

    //rpc._selectedTab = port.sender.tab.id;
    //FIXME: remove detached tab
    //port.onDisconnect.addListener(port.onMessage);

    //show active entry immediately
    if(log.active) {
      rpc.postToTabs({cmd: 'startLog', issue: log.active}, port.sender.tab.id);
    }
  }
};

//set up communication
chrome.extension.onConnect.addListener(rpc.onConnect);

//add content scripts to configured urls
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  console.log('tabUpdated', tabId, changeInfo.status, changeInfo.url, tab);
  //check if url starts with configured url
  if(changeInfo.status == 'loading' && localStorage.jiraUrl && tab.url && tab.url.substring(0, localStorage.jiraUrl.length) == localStorage.jiraUrl) {
    console.log('adding content script and css');
    chrome.tabs.executeScript(tab.id, {file: "jquery-1.4.2.min.js"});
    chrome.tabs.executeScript(tab.id, {file: "common.js"});
    chrome.tabs.executeScript(tab.id, {file: "jira.js"});
    chrome.tabs.insertCSS(tab.id, {file: "jira.css"});
  }
});


/*
//track active tab
chrome.windows.onFocusChanged.addListener(function(windowId) {
  chrome.tabs.getSelected(windowId, function(tab) {
    rpc._selectedTab = tab.id;
  });
});
*/

//handle browser action button
chrome.browserAction.onClicked.addListener(function(tab) {
  chrome.tabs.create({url: 'history.html'});
});

