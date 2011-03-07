var logHistory = {
  entries: [],
  initialize: function() {
    //init interface
    logHistory.load();
    $('button[name=delete]').live('click', logHistory.deleteEntry);
    $('button[name=publish]').live('click', logHistory.publish);
    $('td.begin:not(:has(input)),td.end:not(:has(input))').live('click', logHistory.editEntry);
    $('td.begin input,td.end input').live('blur', logHistory.saveEntry);
    logHistory.proto = $('#proto').remove();

    //init form
    var form = document.forms['login'];
    if(localStorage.username) {
      form.username.value = localStorage.username;
      form.remember_username.checked = true;
    }
    if(localStorage.password) {
      form.password.value = localStorage.password;
      form.remember_password.checked = true;
    }

    //set up communication
    logHistory.port = chrome.extension.connect();

    //set up soap token
    soap.token = localStorage.token;
    if(! soap.token) {
      //try trusted apps login
      soap.login('','', function(token) {
        soap.token = token;
        log.debug('using trusted apps token');        
      });
    } else {
      //if token exists, check whether it has expired
      console.log('trying existing token:'+soap.token);
      soap.getSavedFilters();
    }
    /*
    port.onMessage.addListener(function(issue) {
      bar.show(issue);
    });
    */
	 jira.rpc.initialize(logHistory.port);
  },
  load: function() {
    var tbody = $('<tbody/>');

    entryManager.list(function(tr, res) {
      console.log('entries loaded', res.rows.length);

      for(var i=0; i<res.rows.length; i++) {
        var entry = res.rows.item(i);
        var row = logHistory.proto.clone();
        row.show();
        row.attr('id','entry-'+entry.id);
        row.find('.key a, .summary a').attr('href', localStorage.jiraUrl+'/browse/'+entry.key);
        row.find('.key a').text(entry.key);
        row.find('.summary a').text(entry.summary);
        row.find('.begin').text(util.formatDate(entry.begin));
        row.find('.end').text(util.formatDate(entry.end));
        row.find('.time').text(util.formatTime(entry.end - entry.begin, 'jira'));
        tbody.append(row);
      }

      if(tbody.children().length > 0) {
        $('table').append(tbody);
        $('#nologs').hide();
        $('#logs').show();
      } else {
        $('#nologs').show();
        $('#logs').hide();
      }
		jira.initialize();
    });
  },
  deleteEntry: function() {
    var row = $(this).closest('tr');
    var id = row.attr('id').substring('entry-'.length);
    entryManager.remove(id, function(tr, res) {
      row.remove();
    });
  },  
  editEntry: function() {
    var cell = $(this),
      value = $.trim(cell.text());
    var input = $('<input/>', {
      type: 'text',
      data: {original: new Date(value)},
      value: $.trim(value)
    });
    cell.html(input);
    input.focus();
  },
  saveEntry: function() {
    // TODO: make this more user friendly
    // FIXME: update computed elapsed time
    var row = $(this).closest('tr'), 
      cell = $(this).closest('td'),
      input = $(this),
      date = new Date(input.val()),
      original = input.data('original');
    if(! isNaN(date)) {
      if(date.valueOf() !== original.valueOf()) {
        cell.text('saving...');
        var id = row.attr('id').substring('entry-'.length);
        entryManager.set(id, cell.hasClass('begin') ? 'begin' : 'end', date.valueOf(), 
        function(tr, res) { //success
          cell.text(util.formatDate(date));
        }, 
        function(tr, err) { //error
          //TODO: tell the user
          console.error('error setting date', err);
          cell.text(util.formatDate(original));
        });
        console.log('changed');
      } else {
        console.log('date not changed');
        cell.text(util.formatDate(original));
      }
    } else {
      //TODO: tell the user
      console.error('invalid date: '+input.val());
      cell.text(util.formatDate(original));
    }
  },
  publish: function() {
    //TODO: lock user interface (delete/edit/publish) while publishing
    if(soap.token) {
      entryManager.list(function(tr, res) {
        for(var i=0; i<res.rows.length; i++) {
          var entry = res.rows.item(i);
          soap.addWoklog(entry, function(entry) {
              entryManager.remove(entry.id, function(tr, res) {
                if(res.rowsAffected === 1) {
                  $('#entry-'+entry.id).remove();
                } else {
                  console.error('rowsAffected should be 1');
                }
              });
            }
          );
        }
      });
    } else {
      logHistory.login(logHistory.publish);
    }
  },
  login: function(onSuccess) {
    var form = document.forms['login'],
        username = form.username.value,
        password = form.password.value,
        rememberPassword = form.remember_password.checked,
        rememberUsername = form.remember_username.checked;

    if(! rememberPassword) {
      delete localStorage.password;
    }

    if(! rememberUsername) {
      delete localStorage.username;
    }

    if(username && password) {
      $('#loginError').hide();
      soap.login(username, password, 
        function(token) {          
          $('#login').hide();
          localStorage.token = soap.token = token;
          if(rememberPassword) {
            localStorage.password = password;
          }
          if(rememberUsername) {
            localStorage.username = username;
          }
          if(onSuccess) {
            onSuccess();
          }
        },
        function(code, msg, ex) {
          delete localStorage.token;
          delete soap.token;
          $('#loginError').text(msg).show();
        }
      );
    } else {
      $('#loginError').html('Please enter your username and password').show();
    }
  }
};
$(logHistory.initialize);

var soap = {
  login: function(username, password, onSuccess, onError) {
    soap.request(
      '<login>' +
        '<in0>'+username+'</in0>' +
        '<in1>'+password+'</in1>' +
      '</login>',
      function(xml) {
        if(onSuccess) {
          onSuccess($('loginReturn',xml).text());
        }
      },
      onError
    );
  },
  getSavedFilters: function() {
    soap.request(
      '<getSavedFilters>' +
        '<in0>'+soap.token+'</in0>' +
      '</getSavedFilters>',
      //won't parse response since this is only used for validating token
      function(xml) {
      },
      function(code, msg, ex) {
      }
    );
  },
  addWoklog: function(entry, onSuccess) {
    if(soap.token) {
      soap.request(
        '<addWorklogAndAutoAdjustRemainingEstimate>'+
           '<in0>'+soap.token+'</in0>'+
           '<in1>'+entry.key+'</in1>'+
           '<in2>'+
              '<startDate>'+new Date(entry.begin).toJSON()+'</startDate>'+
              '<timeSpent>'+util.formatTime(entry.end - entry.begin, 'jira')+'</timeSpent>'+
           '</in2>'+
        '</addWorklogAndAutoAdjustRemainingEstimate>',
        function(xml) {
          //TODO: do we need anything to check here?
          //var rv = $('addWorklogAndAutoAdjustRemainingEstimateReturn', xml);
          if(onSuccess) {
            onSuccess(entry);
          }
        }
      );
    }
  },
  request: function(body, onSuccess, onError) {
    $.ajax({
      type: 'POST',
      url: localStorage.jiraUrl + '/rpc/soap/jirasoapservice-v2',
      data: '<soapenv:Envelope ' +
          'xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">' +
             '<soapenv:Body>' +
              body +
            '</soapenv:Body>' +
          '</soapenv:Envelope>',
      processData: false,
      contentType: 'text/xml',
      complete: function(resp, status) {
        if(status == 'success'){
          if(onSuccess) {
            onSuccess(resp.responseXML);
          }
        } else if(status == 'error') {
          var faultcode = $('faultcode', resp.responseXML).text();
          var faultstring = $('faultstring', resp.responseXML).text();
          var ex = $('detail *', resp.responseXML).attr('xsi:type');
          //handle expired or invalid token
          if(ex == 'ns1:RemoteAuthenticationException') {
            console.log(faultstring);
            delete localStorage.token;
            delete soap.token;
            $('#login').show();
          } else {
            console.error(faultcode, faultstring, ex);
          }
          if(onError) {
            onError(faultcode, faultstring, ex);
          }
        } else {
          console.error('unexpected status:'+status);
        }
      },
      beforeSend: function(req) {
        req.setRequestHeader('SOAPAction', '');         
      }
    });
  }
};

function _generateTest() {
  var entries = [];
  for(var i=10; i<13; i++) {
    entries.push({
      key:'TST-21447', 
      begin: new Date('2010-04-04 '+i+':02:13').valueOf(),
      end: new Date('2010-04-04 '+i+':'+i+':13').valueOf(),
      summary: 'test entry '+i
    });
  }
  entryManager.create(entries);
}
