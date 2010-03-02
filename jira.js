var issues;
var pos = -1;

init();

function init() {
  pos = -1;
  issues = $('#issuetable tr:has(td.issuekey)');
  if(! issues) {
    console.log('no issues were found');    
  } else {
    console.log(issues);
  }
  $(document).keydown(function(event) {
    console.log(event.which);
   if(['INPUT', 'TEXTAREA'].indexOf(event.target.nodeName) == -1) {
     switch(event.which) {
      case 74: //j
        move(1);
        break;
      case 75: //k
        move(-1);
        break;
      case 13: //enter
        activate();
        break;
      case 85: //u
        up();
        break;
      case 67: //ctrl + c
        if(event.ctrlKey) {
          copy();
        }
        break;
      }
    }
  });
}

function move(dir) {
  if(pos < 0) {
    pos = 0;
  } else {
    $(issues[pos]).removeClass('jirahl');
    pos = Math.max(0, Math.min(pos + dir, issues.length - 1));
  }
  $(issues[pos]).addClass('jirahl');
  scrollTo(issues[pos]);
}

function activate() {
  if(pos > -1) {
    $('td.issuekey a',issues[pos]).first().each(activateLink);
  }
}

function scrollTo(element) {
  var scrollTop = $('body').scrollTop();
  var top = $(element).offset().top;
  var winHeight = $(window).height();
  var height = $(element).outerHeight();  
  if((top < scrollTop) || ((scrollTop + winHeight) < (top + height))){
    $('body').scrollTop(top + (height / 2) - (winHeight / 2));
  }
  //var docHeight = $(document).height();
}

function up() {
  //try "return to search" or "browse project"
  $('a[accesskey=F], a[accesskey=b]').last().each(activateLink);
}

function copy() {
  if(pos > -1) {
    //TODO: save and restore original selection, if any
    var selection = window.getSelection();
    var range = document.createRange();    
    var summaryNode = $('td.summary a',issues[pos])[0];
    range.setStart($('td.issuekey a',issues[pos])[0], 0);
    range.setEnd(summaryNode, summaryNode.childNodes.length);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand("Copy"); 
    selection.removeAllRanges();
    //do some feedback
    $(issues[pos]).fadeTo('fast', 0, function(){$(this).fadeTo('fast',1);});
  }
}

function activateLink() {
  window.location = this.href;
}
