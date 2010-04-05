if(typeof jQuery == 'undefined') {
  jQuery = {};
}

jQuery.formatTime = function(ms, fmt) {
  var secs = Math.round(ms / 1000); 
  var mins = secs / 60;
  secs = Math.floor(secs % 60);
  var hours = mins / 60; 
  var absHours = hours;
  mins = Math.floor(mins % 60);
  var days = Math.floor(hours / 24);
  var workDays = Math.floor(hours / 8);
  hours = Math.floor(hours % 24);
  var workHours = Math.floor(hours % 8);

  if(fmt == 'jira'){
    var rv = [];
    if(workDays) {
      rv.push(workDays + 'd');
    }
    if(workHours) {
      rv.push(workHours + 'h');
    }
    if(mins) {
      rv.push(mins + 'm');
    }
    return rv.join(' ');
  } else {
    absHours = Math.floor(absHours);
    return (absHours < 10 ? '0' + absHours : absHours) + ':' + 
    (mins < 10 ? '0' + mins : mins) + ':' +
    (secs < 10 ? '0' + secs : secs);
  }
};
