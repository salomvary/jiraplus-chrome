var jira = {};

jira.selectors = {
  issues: '#issuetable tr:has(td.issuekey), tr.rowNormal:has(a[href^=/browse/]), tr.rowAlternate:has(a[href^=/browse/])',
  summary: 'td.summary a, td:nth-child(3) a[href^=/browse/]',
  issuekey: 'td.issuekey a, td:nth-child(2) a[href^=/browse/]'
};

jira.initialize = function() {
  jira.issues = $(jira.selectors.issues);
  jira.issues.active = -1;

  $(document).keydown(function(event) {
   console.log(event.which);
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
          command.withActive('activate');
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

  copy: function(tr) {
    //TODO: save and restore original selection, if any
    var selection = window.getSelection();
    var range = document.createRange();    
    var summaryNode = $(jira.selectors.summary,tr)[0];
    range.setStart($(jira.selectors.issuekey,tr)[0], 0);
    range.setEnd(summaryNode, summaryNode.childNodes.length);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand("Copy"); 
    selection.removeAllRanges();
    //do some feedback
    $(tr).fadeTo('fast', 0, function(){$(this).fadeTo('fast',1);});
  },

  activate: function(tr) {
    $(jira.selectors.issuekey,tr).first().each(jira.util.activateLink);
  },

  startLog: function(tr) {
    var issue = jira.util.parseIssue(tr);
    rpc.port.postMessage({
      cmd: "startLog", 
      issue: issue
    });
    bar.show(issue);
  },

  stopLog: function() {
    rpc.port.postMessage({cmd: "stopLog"});
    bar.hide();
  },
  
  withActive: function(cmd) {
    if(jira.issues.active > -1) {
      command[cmd](jira.issues[jira.issues.active]);
    }
  }
};

jira.util = {
  parseIssue: function(tr) {
    var key = $(jira.selectors.issuekey, tr).eq(0);
    return {
      key: key.text().trim(),
      summary: $(jira.selectors.summary, tr).eq(0).text().trim(),
      url: key.attr('href')
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
  show: function(issue) {
    if(! bar.element) {
      $('body')
        .prepend('<div id="jirainfobar"></div>');
      bar.element = $('#jirainfobar');
    }
    bar.element.html(
      '<a href="'+
      issue.url+'" class="issuekey">'+
      issue.key+'</a> | <a href="'+
      issue.url+'" class="summary">'+
      issue.summary+'</a> | <span class="time">'+
      (issue.end ? util.formatTime(issue.end - issue.begin) : '00:00:00')+
      '</span>');
    $('body').addClass('jirainfobar');
  },

  hide: function() {
    $('body').removeClass('jirainfobar');
  }
};

//set up communication
var rpc = {
  port: chrome.extension.connect(),
  onMessage: function(request) {
    if(rpc.command[request.cmd]) {
        rpc.command[request.cmd](request);
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
rpc.port.onMessage.addListener(rpc.onMessage);

//start
$(jira.initialize);
