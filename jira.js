var jira = {};

jira.selectors = {
  //lists, dashboard
  issues:   '#issuetable tr:has(td.issuekey), '+ //lists
            'tr.rowNormal:has(a[href^=/browse/]), tr.rowAlternate:has(a[href^=/browse/])', //dashboard
  summary:  'td.summary a, '+ //lists
            'td:nth-child(3) a[href^=/browse/], ', //dashboard
  issuekey: 'td.issuekey a, '+ //lists
            'td:nth-child(2) a[href^=/browse/], td:nth-child(2) a[href^=/browse/], ', //dashboard
  issuepage: {
    issuekey:  '.breadcrumbs a#key-val,'+ //v4 issue page
              'table#issuedetails a[href^=/browse/]', //v3 issue page
    summary: '#issue_header_summary a,'+ //v4 issue page
              'h3.formtitle:eq(0)' //v3 issue page
  }
};

jira.initialize = function() {
  jira.rpc.initialize();
  //try issue list
  jira.issues = $(jira.selectors.issues);
  jira.issues.active = -1;
  if(jira.issues.length > 0) {
    console.log('issue list found');
  }

  //try single issue
  var key = $(jira.selectors.issuepage.issuekey);
  var summary = $(jira.selectors.issuepage.summary);
  if(key.length && summary.length) {
    jira.issue = {
      key: key,
      summary: summary
    };
    console.log('single issue found', jira.issue);
  }

  $(document).keydown(function(event) {
   console.log(event);
   if(['INPUT', 'TEXTAREA', 'SELECT', 'OPTION'].indexOf(event.target.nodeName) == -1) {
     switch(event.which) {
      case 74: //j
        if(! (event.ctrlKey || event.shiftKey || event.altKey || event.metaKey)) {
          command.move(1);
        }
        break;
      case 75: //k
        if(! (event.ctrlKey || event.shiftKey || event.altKey || event.metaKey)) {
          command.move(-1);
        }
        break;
      case 13: //enter
        if(! (event.ctrlKey || event.shiftKey || event.altKey || event.metaKey)) {
          command.withSelection('activate');
        }
        break;
      case 85: //u
        if(! (event.ctrlKey || event.shiftKey || event.altKey || event.metaKey)) {
          command.up();
        }
        break;
      case 67: //ctrl + c
        if(event.ctrlKey && !(event.shiftKey || event.altKey)) {
          command.withActive('copy');
        }
        break;
      case 87: //w
        if(! (event.ctrlKey || event.shiftKey || event.altKey || event.metaKey)) {
          command.withActive('startLog');
        }
        break;
      case 83: //s
        if(! (event.ctrlKey || event.shiftKey || event.altKey || event.metaKey)) {
          command.stopLog();
        }
        break;
      case 73: //i
        if(! (event.ctrlKey || event.shiftKey || event.altKey || event.metaKey)) {
          command.showHistory();
        }
        break;
      case 65: //ctrl + a
        if(event.ctrlKey && !(event.shiftKey || event.altKey)) {
          command.selectAll();
          event.preventDefault();
        }
        break;       
      }
    }
  });
}

var command = {
  move: function(dir) {
    if(jira.issues.active < 0) {
      jira.issues.active = 0;
    } else {
      $(jira.issues[jira.issues.active]).removeClass('jirahl');
      jira.issues.active = Math.max(0, Math.min(jira.issues.active + dir, jira.issues.length - 1));
    }
    $(jira.issues[jira.issues.active]).addClass('jirahl');
    jira.util.scrollTo(jira.issues[jira.issues.active]);
  },

  up: function() {
    //try "return to search" or "browse project"
    $('a[accesskey=F], a[accesskey=b]').last().each(jira.util.activateLink);
  },

  copy: function(source) {
    var selection = window.getSelection();
    if(! selection.rangeCount || selection.isCollapsed) { //if something is selected, fallback to default (copy that)
      //TODO: save and restore original selection, if any
      selection.removeAllRanges();
      if(source.nodeName) {
        var range = document.createRange();    
        var summaryNode = $(jira.selectors.summary,source)[0];
        range.setStart($(jira.selectors.issuekey,source)[0], 0);
        range.setEnd(summaryNode, summaryNode.childNodes.length);
        selection.addRange(range);
        //do some feedback
        $(source).fadeTo('fast', 0, function(){$(this).fadeTo('fast',1);});
        document.execCommand("Copy"); 
      } else {
        //hack: webkit doesn't support non-adjacent ranges 
        $('<span/>').text(source.key.text().trim()+ ' ').prependTo(source.summary);

        var summaryRange = document.createRange();
        summaryRange.selectNodeContents(source.summary.get(0));
        selection.addRange(summaryRange);
        //TODO: feedback
        document.execCommand("Copy"); 
        source.summary.children(0).remove();
      }
      selection.removeAllRanges();
    }
  },

  activate: function(selection) {
    if(selection.length > 1) {
      jira.rpc.port.postMessage({
        cmd: 'openTabs',
        tabs: $.map(selection, function(tr) {
          return $(tr).find(jira.selectors.issuekey)[0].href;
        })
      });
    } else {
      selection.find(jira.selectors.issuekey).first().each(jira.util.activateLink);
    }
  },

  selectAll: function() {
    if(jira.selected) {
      // unselect all
      jira.selected.removeClass('jirasel');
      delete jira.selected;
    } else {
      // select all
      jira.selected = $(jira.issues);
      jira.selected.addClass('jirasel');
    }
  },

  startLog: function(source) {
    var issue;
    if(source.nodeName) {
      issue = jira.util.parseIssue(source);
    } else {
      issue = {
        key: source.key.text().trim(),
        summary: source.summary.text().trim(),
      };
    }
    jira.rpc.port.postMessage({
      cmd: "startLog", 
      issue: issue
    });
    bar.show(issue);
  },

  stopLog: function() {
    jira.rpc.port.postMessage({cmd: "stopLog"});
    bar.hide();
  },

  showHistory: function() {
    jira.rpc.port.postMessage({cmd: "showHistory"});
  },
  
  withActive: function(cmd) {
    if(jira.issues.active > -1 || jira.issue) {
      command[cmd](jira.issues[jira.issues.active] || jira.issue);
    }
  },

  withSelection: function(cmd) {
    var selection = jira.issues.active > -1 ? $(jira.issues[jira.issues.active]) 
      : (jira.issue || jira.selected);
    if(selection) {
      command[cmd](selection);
    }
  }

};

jira.util = {
  parseIssue: function(tr) {
    var key = $(jira.selectors.issuekey, tr).eq(0);
    return {
      key: key.text().trim(),
      summary: $(jira.selectors.summary, tr).eq(0).text().trim()
    };
  },
  scrollTo: function(element) {
    var scrollTop = $('body').scrollTop();
    var top = $(element).offset().top;
    var winHeight = $(window).height();
    var height = $(element).outerHeight();  
    if((top < scrollTop) || ((scrollTop + winHeight) < (top + height))){
      $('body').scrollTop(top + (height / 2) - (winHeight / 2));
    }
    //var docHeight = $(document).height();
  },
  activateLink: function() {
    window.location = this.href;
  }
};

//display bar at window top
var bar = {
  active: null,
  show: function(issue) {
    //setup top bar
    if(! bar.element) {
      bar.element = $(
        '<div id="jirainfobar">' +
          '<a class="issuekey" href=""></a>'+
          ' | <a class="summary" href=""></a>'+
          ' | <span class="time"></span>'+
        '</div>'
      ).prependTo('body');
      bar.issuekey = $(bar.element).find('.issuekey');
      bar.summary = $(bar.element).find('.summary');
      bar.time = $(bar.element).find('.time');
    }
    //update DOM
    bar.time.text(issue.end ? util.formatTime(issue.end - issue.begin) : '00:00:00');
    //update these only if issue differs
    if(bar.active !== issue.key) {
    var url = '/browse/'+issue.key;
      bar.summary.attr('href', url);
    bar.issuekey.attr('href', url);
      bar.issuekey.text(issue.key);
      bar.summary.text(issue.summary);
    }
    if(! bar.active) {
      $('body').addClass('jirainfobar');
      bar.active = issue.key;
    }
  },

  hide: function() {
    delete bar.active;
    $('body').removeClass('jirainfobar');
  }
};

//set up communication
jira.rpc = {
  initialize: function(port) {
    jira.rpc.port = port || chrome.extension.connect();
    jira.rpc.port.onMessage.addListener(jira.rpc.onMessage);
  },
  onMessage: function(request) {
    if(jira.rpc.command[request.cmd]) {
        jira.rpc.command[request.cmd](request);
    } else {
      throw new Error('unknown command '+request.cmd);
    }
  },
  command: {
    startLog: function(request) {
      bar.show(request.issue);
    },
    stopLog: function() {
      bar.hide();
    }
  }
};

//start
if(typeof logHistory == 'undefined')  { //history has it's own initialization
  $(jira.initialize);
}

// vim:ts=2:sw=2:et:
