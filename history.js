var history = {
  entries: [],
  initialize: function() {
    //init interface
    history.load();
    $('button[name=delete]').live('click', history.deleteEntry);
    $('button[name=publish]').live('click', history.publish);
    history.proto = $('#proto');

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
    history.port = chrome.extension.connect();

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
      soap.getFavouriteFilters();
    }
    /*
    port.onMessage.addListener(function(issue) {
      bar.show(issue);
    });
    */
  },
  load: function() {
    var tbody = $('<tbody/>');

    entryManager.list(function(tr, res) {
      console.log('entries loaded', res.rows.length);

      for(var i=0; i<res.rows.length; i++) {
        var entry = res.rows.item(i);
        var row = history.proto.clone();
        row.show();
        row.attr('id','entry-'+entry.id);
        row.find('.key a, .summary a').attr('href','#'+entry.key); //FIXME
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
    });
  },
  deleteEntry: function() {
    var row = $(this).closest('tr');
    var id = row.attr('id').substring('entry-'.length);
    entryManager.remove(id, function(tr, res) {
      row.remove();
    });
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
      history.login(history.publish);
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
$(history.initialize);

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
  getFavouriteFilters: function() {
    soap.request(
      '<getFavouriteFilters>' +
        '<in0>'+soap.token+'</in0>' +
      '</getFavouriteFilters>',
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
