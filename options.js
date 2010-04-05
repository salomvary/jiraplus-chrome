$(function() {
  if(localStorage.jiraUrl) {
    $('[name=jiraUrl]').val(localStorage.jiraUrl);
  }
  $('form').bind('submit', function(e) {
    e.preventDefault();
    console.log('submit');
    localStorage.jiraUrl = this.jiraUrl.value;
  });
});
