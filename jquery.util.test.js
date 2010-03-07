var one_sec = 1000;
var one_minute = 60 * one_sec;
var one_hour = 60 * one_minute;
var one_day = 24 * one_hour; 
var one_workday = 8 * one_hour;

function eq(one, another) {
  if(one !== another) {
    throw new Error('"' + one + '" is not equal to "' + another + '"');
  } else {
    print(one + ' OK');
  }
};

eq(jQuery.formatTime(one_minute, 'jira'), '1m');
eq(jQuery.formatTime(one_hour, 'jira'), '1h');
eq(jQuery.formatTime(one_workday, 'jira'), '1d');
eq(jQuery.formatTime(one_sec), '00:00:01');
eq(jQuery.formatTime(one_minute), '00:01:00');
eq(jQuery.formatTime(one_hour), '01:00:00');
eq(jQuery.formatTime(one_day), '24:00:00');

eq(jQuery.formatTime(8 * one_hour, 'jira'), '1d');

eq(
  jQuery.formatTime(3 * one_workday + 5 * one_hour + 55 * one_minute + 33 * one_sec, 'jira'),
  '3d 5h 55m'
);

eq(
  jQuery.formatTime(3 * one_day + 5 * one_hour + 55 * one_minute + 33 * one_sec),
  '77:55:33'
);
