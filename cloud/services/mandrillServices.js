var Mandrill = require('mandrill');
var _ = require('underscore');

Mandrill.initialize("6xcQtzv5ZIhr3bZ_F8tbiw");

exports.emailAccountCreated = function(username,email) {
	var promise = new Parse.Promise();

	var dynamicContent=[{
      "name": "username",
      "content": username
    }];	

	sendEmail(username,email,"AccountCreated",dynamicContent,"Account Created")
	.then(function(result){                                    
	   promise.resolve(result);	 
	},function(error){
	   promise.reject(error);
	});

	return promise;
};

exports.emailAccountUpdated = function(username,email) {
	var promise = new Parse.Promise();

	var dynamicContent=[{
      "name": "username",
      "content": username
    }];	

	sendEmail(username,email,"AccountUpdated",dynamicContent,"Account Updated")
	.then(function(result){                                    
	   promise.resolve(result);	 
	},function(error){
	   promise.reject(error);
	});

	return promise;
};


exports.emailUserInvited = function(username,email,userType) {
	var promise = new Parse.Promise();

	var dynamicContent=[{
      "name": "username",
      "content": username
    }];	

    var templateName;
    if(userType=="member"){
    	templateName="MemberInvited";
    }else if(userType=="staff"){
    	templateName="StaffInvited";
    }
    
	sendEmail(username,email,templateName,dynamicContent,"Invited")
	.then(function(result){                                    
	   promise.resolve(result);	 
	},function(error){
	   promise.reject(error);
	});

	return promise;
};

exports.emailUserApproved = function(username,email,userType) {
	var promise = new Parse.Promise();

	var dynamicContent=[{
      "name": "username",
      "content": username
    }];	

    var templateName;
    if(userType=="member"){
    	templateName="MemberApproved";
    }
    
	sendEmail(username,email,templateName,dynamicContent,"Approved")
	.then(function(result){                                    
	   promise.resolve(result);	 
	},function(error){
	   promise.reject(error);
	});

	return promise;
};

exports.emailAdminCreated = function(username,email) {
	var promise = new Parse.Promise();

	var dynamicContent=[{
      "name": "username",
      "content": username
    }];	

	sendEmail(username,email,"AdminCreated",dynamicContent,"Joined Successfully")
	.then(function(result){                                    
	   promise.resolve(result);	 
	},function(error){
	   promise.reject(error);
	});

	return promise;
};

var sendEmail=function(userName,email,templateName,dynamicContent,subject){

	var promise = new Parse.Promise();

    var message = {
        "to": [{
              "email":email,
              "name": userName,
              "type": "to"
            }],
        "global_merge_vars":dynamicContent,
        "inline_css":true,
        "subject":subject
    };   

	Parse.Cloud.httpRequest({
	    method: 'POST',
	    headers: {
	     'Content-Type': 'application/json',
	    },
	    url: 'https://mandrillapp.com/api/1.0/messages/send-template.json',
	    body:{
	        "key": "6xcQtzv5ZIhr3bZ_F8tbiw",
	        "template_name": templateName,
	        "template_content": dynamicContent, 
	        "message":message,
	        "async": true
	    },

	    success: function(httpResponse) {
	       console.log(httpResponse);
	       promise.resolve(httpResponse);
	    },
        error: function(httpResponse) {
           console.error(httpResponse);
           promise.reject(httpResponse);
        }

	});
	
	return promise;
};

exports.sendContactMessage = function(name, email, phone, message){
	var promise = new Parse.Promise();

	Parse.Config
        .get()
        .then(function(config) {
            var e = config.get("contactEmail");

            Mandrill.sendEmail({
                message: {
                    subject: "New contact message in PushPigeon",
                    from_email: 'no-reply@pushpigeon.com',
                    from_name: 'PushPigeon Contact',
                    html: '<h1>From: ' + name + ' ( ' + email + ')</h1>\n<h2>Phone Number: ' + phone + '</h2>\n<p>' + message + '</p>',
                    text: 'From: ' + name + ' ( ' + email + ')\n\nPhone Number: ' + phone + '\n\n' + message,
                    to: [
                        {
                            email: e,
                            name: 'PushPigeon'
                        }
                    ],
                    headers: {
                        'Reply-To': email
                    }
                },
                async: true
            },{
                success: function(httpResponse) {
                    console.log(httpResponse);
                    promise.resolve(httpResponse)
                },
                error: function(httpResponse) {
                    console.error(httpResponse);
                    promise.reject(httpResponse);
                }
            });
        }, function(error) {
        	console.log(error);
            promise.reject(error);
        });
	
	return promise;
};