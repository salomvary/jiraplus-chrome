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
  jira.issues = $(jira.selectors.issues);
  jira.issues.active = -1;

  if(jira.issues.length < 1) {
    console.log('not on list page (or empty list)');
    var key = $(jira.selectors.issuepage.issuekey);
    var summary = $(jira.selectors.issuepage.summary);
    if(key && summary) {
      jira.issue = {
        key: key,
        summary: summary
      };
      console.log('on issue page', jira.issue);
    }
  }

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
      case 73: //i
		    if(! (event.ctrlKey || event.shiftKey || event.altKey || event.metaKey)) {
          command.showHistory();
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
    //TODO: save and restore original selection, if any
    var selection = window.getSelection();
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
  },

  activate: function(tr) {
    $(jira.selectors.issuekey,tr).first().each(jira.util.activateLink);
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

  showHistory: function() {
    rpc.port.postMessage({cmd: "showHistory"});
  },
  
  withActive: function(cmd) {
    if(jira.issues.active > -1 || jira.issue) {
      command[cmd](jira.issues[jira.issues.active] || jira.issue);
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
  show: function(issue) {
    if(! bar.element) {
      $('body')
        .prepend('<div id="jirainfobar"></div>');
      bar.element = $('#jirainfobar');
    }
    bar.element.html(
      '<a href="/browse/'+
      issue.key+'" class="issuekey">'+
      issue.key+'</a> | <a href="/browse/'+
      issue.key+'" class="summary">'+
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
