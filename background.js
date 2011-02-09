//misc background functions
var background = {  
  showHistory: function() {
    if(! background.tabClosed) {
      chrome.tabs.onRemoved.addListener((background.tabClosed = function(tabId) {
        if(tabId === background.historyTabId) {
          delete background.historyTabId;
        }
      }));
    }
    chrome.tabs.getSelected(null, function(selectedTab){
      if(! background.historyTabId) {
        //create as next
        chrome.tabs.create(
          {
            url: 'history.html', 
            index: selectedTab.index + 1
          }, 
          function(tab) {
            background.historyTabId = tab.id;
          }
        );
      } else {
        //TODO: would be nice to simply activate tab, but it doesn't work if 
        //it is in another window
        //http://code.google.com/p/chromium/issues/detail?id=31434
        //chrome.windows.update(historyTab.windowId, {focused:true});

        chrome.tabs.get(background.historyTabId, function(historyTab) {

          //FIX: move tab to active window
          if(historyTab.windowId !== selectedTab.windowId) {
            chrome.tabs.move(historyTab.id, {
              windowId: selectedTab.windowId,
              index: selectedTab.index + 1
            });
          }
          //activate tab
          chrome.tabs.update(historyTab.id, {selected:true});
        });
      }        
    });
  }
};

//work logging
var log = {
  initialize: function() {
    //recover active issue
    if(localStorage.active) {
      //FIXME: confirm recovery: (recover&continue || recover&stop || delete)
      var issue = JSON.parse(localStorage.active);
      console.log('issue recovered', issue);
      log.start(issue);
    }
  },
  entries: [],
  start: function(issue){
    console.log('log started', issue.key);
    if(log.active) {
      log.stop();
    }
    if( !issue.begin ) {
      issue.begin = new Date().valueOf();
    }

    //set&store active
    log.active = issue;
    log.store();

    //start timers
    log._tick = setInterval(log.tick, 1000);
    log._store = setInterval(log.store, 60000); //persist every minute

    //broadcast, badge
    //rpc.postToTabs({cmd: 'startLog'});
    chrome.browserAction.setBadgeText({text: 'ON'});
    chrome.browserAction.setTitle({title: issue.key + ' ' + issue.summary});
  },
  stop: function() {
    console.log(
      'log stopped',
      log.active.key,
      util.formatTime(log.active.end - log.active.begin)
    );

    //stop timers
    clearInterval(log._tick);
    clearInterval(log._store);

    //update storage
    log.entries.push(log.active);
    log.active = undefined;
    log.store();

    //broadcast, badge
    rpc.postToTabs({cmd: 'stopLog'});
    chrome.browserAction.setBadgeText({text: ''});
    chrome.browserAction.setTitle({title: ''});
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

log.initialize();

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
      log.start(request.issue);
    },
    stopLog: function() {
      log.stop();
    },
    publish: function() {
      log.publish();
    },
    showHistory: background.showHistory
  },
  onMessage: function(request) {
    if(rpc.command[request.cmd]) {
        rpc.command[request.cmd](request);
    } else {
      throw new Error('unknown command '+request.cmd);
    }
  },
  onConnect: function(port) {
    rpc._ports[port.sender.tab.id] = port; //send
    port.onMessage.addListener(rpc.onMessage); //receive

    //rpc._selectedTab = port.sender.tab.id;

    //remove detached tab
    port.onDisconnect.addListener(function() {
      delete rpc._ports[port.sender.tab.id];
    });

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
  //check if url starts with configured url
  if(changeInfo.status == 'loading' && localStorage.jiraUrl && tab.url && tab.url.substring(0, localStorage.jiraUrl.length) == localStorage.jiraUrl) {
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
  background.showHistory();
});

