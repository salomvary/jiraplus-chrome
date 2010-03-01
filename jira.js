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
    switch(event.which) {
      case 74: //j
        move(1);
        break;
      case 75: //k
        move(-1);
        break;
      case 13: //enter
        activate(pos);
        break;
      case 85: //u
        up();
        break;
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

function activate(pos) {
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

function activateLink() {
  window.location = this.href;
}
