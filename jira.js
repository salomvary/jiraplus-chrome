var issues;

var selectors = {
  issues: '#issuetable tr:has(td.issuekey), tr.rowNormal:has(a[href^=/browse/]), tr.rowAlternate:has(a[href^=/browse/])',
  summary: 'td.summary a, td:nth-child(3) a[href^=/browse/]',
  issuekey: 'td.issuekey a, td:nth-child(2) a[href^=/browse/]'
};

function init() {
  issues = $(selectors.issues);
  issues.active = -1;

  $(document).keydown(function(event) {
   console.log(event.which);
   if(['INPUT', 'TEXTAREA'].indexOf(event.target.nodeName) == -1) {
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
    if(issues.active < 0) {
      issues.active = 0;
    } else {
      $(issues[issues.active]).removeClass('jirahl');
      issues.active = Math.max(0, Math.min(issues.active + dir, issues.length - 1));
    }
    $(issues[issues.active]).addClass('jirahl');
    util.scrollTo(issues[issues.active]);
  },

  up: function() {
    //try "return to search" or "browse project"
    $('a[accesskey=F], a[accesskey=b]').last().each(util.activateLink);
  },

  copy: function(tr) {
    //TODO: save and restore original selection, if any
    var selection = window.getSelection();
    var range = document.createRange();    
    var summaryNode = $(selectors.summary,tr)[0];
    range.setStart($(selectors.issuekey,tr)[0], 0);
    range.setEnd(summaryNode, summaryNode.childNodes.length);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand("Copy"); 
    selection.removeAllRanges();
    //do some feedback
    $(tr).fadeTo('fast', 0, function(){$(this).fadeTo('fast',1);});
  },

  activate: function(tr) {
    $(selectors.issuekey,tr).first().each(util.activateLink);
  },

  startLog: function(tr) {
    var issue = util.parseIssue(tr);
    port.postMessage({
      cmd: "startLog", 
      issue: issue
    });
    bar.show(issue);
  },

  stopLog: function() {
    port.postMessage({cmd: "stopLog"});
    bar.hide();
  },
  
  withActive: function(cmd) {
    if(issues.active > -1) {
      command[cmd](issues[issues.active]);
    }
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
      (issue.time ? issue.time : '00:00:00')+
      '</span>');
    $('body').addClass('jirainfobar');
  },

  hide: function() {
    $('body').removeClass('jirainfobar');
  }
};

var util = {
  parseIssue: function(tr) {
    var key = $(selectors.issuekey, tr).eq(0);
    return {
      key: key.text().trim(),
      summary: $(selectors.summary, tr).eq(0).text().trim(),
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

//set up communication
var port = chrome.extension.connect();
port.onMessage.addListener(function(issue) {
  bar.show(issue);
});

//start
init();
