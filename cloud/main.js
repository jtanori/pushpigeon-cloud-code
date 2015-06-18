var moment = require('moment');
var _ = require('underscore');
var mandrilServices = require("cloud/services/mandrillServices.js");
var validations = require('cloud/validations.js');

require('cloud/routes/emails.js');

Parse.Cloud.afterSave(Parse.User, function(req){
	if(req.user.existed()){
		return;
	}

	var data = {AccessCode: _.random(1000, 9999), User: req.user, active: true, validated: false};
	var code = new (Parse.Object.extend('VerificationCode'))();

	code
		.save(data)
		.then(function(){
			console.log('VerificationCode saved for user: ' + req.user.id);
		})
		.fail(function(){
			console.log('VerificationCode could not be saved for user: ' + req.user.id);
		});
});

Parse.Cloud.afterSave('GroupAdmin', function(req){
	if(req.object.existed()){
		return;
	}

	var data = {AccessCode: _.random(1000, 9999), Admin: req.object, active: true, validated: false};
	var code = new (Parse.Object.extend('VerificationCode'))();

	code
		.save(data)
		.then(function(){
			console.log('VerificationCode saved for GroupAdmin: ' + req.user.id);
		})
		.fail(function(){
			console.log('VerificationCode could not be saved for GroupAdmin: ' + req.user.id);
		});
});

Parse.Cloud.beforeSave('GroupAdmin', function(request, response){
	if(!request.object.existed()){
		request.object.set('verified', false);	
	}

	response.success();
});

Parse.Cloud.afterSave('VerificationCode', function(request){
	if(request.object.existed()){
		return;
	}

	var o = request.object;
	var isAdmin = !!o.get('Admin');
	var user = isAdmin ? o.get('Admin') : o.get('User');

	request.object.set('verified', false);

	if(user){
		user.fetch()
			.then(function(){
				var email = user.get('email');
				var code = o.get('AccessCode');
				var template = o.get('type');

				switch(template){
					case 'forgotPassword': template = 'ForgotPassword'; break;
					default: template = 'VerificationCode';
				}

				mandrilServices
					.sendVerificationCode(email, code, template)
				   	.then(function(result){
				   		console.log('VerificationCode : (' + o.id + ')' + code + ' sent to: ' + email);
					},function(error){
					   	console.log('VerificationCode : (' + o.id + ')' + code + ' could not be sent to: ' + email);
					   	console.log(error);
					});
			})
			.fail(function(){

			});
	}else{
		console.log('VerificationCode object is invalid');
	}
});

Parse.Cloud.beforeSave('VerificationCode', function(request, response){
	if(!request.object.existed()){
		request.object.set({validated: false, active: true});	
	}

	response.success();
});

Parse.Cloud.define('verifyAccount', function(request, response){
	if(request.params && validations.EMAIL.test(request.params.email)){

		var email = request.params.email;
		var verificationCode = request.params.code;
		var query = new Parse.Query('VerificationCode');

		query
			.include('User')
			.include('Admin')
			.equalTo('AccessCode', request.params.code*1)
			.equalTo('active', true)
			.equalTo('validated', false)
			.first()
			.then(function(c){
				var isValid = false;
				var user;

				if(!_.isEmpty(c)){
					if(c.get('Admin')){
						isValid = c.get('Admin').get('email') === email;
						user = c.get('Admin');
					}else if(c.get('User')){
						isValid = c.get('User').get('email') === email;
						user = c.get('User');
					}
				}

				if(isValid){
					c
						.save({'validated': true, active: false})
						.then(function(){
							Parse.Cloud.useMasterKey();
							
							user
								.save({verified: true})
								.then(function(){
									response.success({status: 'success', verificationCode: {id: c.id, verified: true}});
								})
								.fail(function(e){
									console.log('Could not save user verified status');
									console.log(e);
									response.error(e);
								});
						})
						.fail(function(){
							response.error('Could not validate code');
						})
				}else{
					response.error('Invalid access code');
				}
			})
			.fail(function(){
				response.error('Code is not longer available');
			});
	}else{
		response.error('No Data received');
	}
});

Parse.Cloud.define('forgotPassword', function(request, response){
	//Check if we have params and if email is valid email address
	if(request.params && validations.EMAIL.test(request.params.email)){
		var email = request.params.email;
		var isAdmin = request.params.userType === 'groupAdmin';
		var query;
		// Determine if forgotPassword has been requested by
		// a self-proclaimed GroupAdmin or regular User 
		if(isAdmin){
			query = new Parse.Query('GroupAdmin');
		}else{
			query = new Parse.Query(Parse.User);
		}

		//Find user
		query
			.select('email')
			.equalTo('email', email)
			.first({userMasterKey: true})
			.then(function(u){
				if(!_.isEmpty(u)){
					var code = new (Parse.Object.extend('VerificationCode'))();
					var data = {AccessCode: _.random(1000, 9999), type: 'forgotPassword'};

					if(isAdmin){
						data.Admin = u;
					} else {
						data.User = u;
					}
					//Save verification code
					code
						.save(data)
						.then(function(){
							console.log('ForgotPassword VerificationCode saved for user: ' + u.id + ' (admin: ' + isAdmin + ')');
							response.success('Code sent to user');
						})
						.fail(function(e){
							console.log('ForgotPassword VerificationCode could not be saved for user: ' + u.id+ ' (admin: ' + isAdmin + ')');
							console.log(e);
							response.error('Could not save VerificationCode');
						});
				}else{
					console.log(u);
					console.log('forgotPassword: User not found: ' + email + ' (admin: ' + isAdmin + ')');
					response.error('User not found');
				}
			})
			.fail(function(e){
				console.log('forgotPassword: Error requesting user')
				console.log(e);
				response.error('Error requesting user');
			});
	}else{
		response.error("Invalid input");
	}
});

Parse.Cloud.define('resetPassword', function(request, response){
	if(request.params && !_.isEmpty(request.params.codeId) && !_.isEmpty(request.params.newPassword)){
		var query = new Parse.Query('VerificationCode');

		query
			.equalTo('objectId', request.params.codeId)
			.equalTo('active', false)
			.equalTo('validated', true)
			.equalTo('type', 'forgotPassword')
			.first()
			.then(function(c){
				var u = c.get('Admin') ? c.get('Admin') : c.get('User');

				if(!_.isEmpty(u)){
					u
						.save({password: request.params.newPassword}, {userMasterKey: true})
						.then(function(){
							response.success('Password updated');
						})
						.fail(function(e){
							response.error({status: 'error', error: e});
						});
				}else{
					response.error('Validation code seems invalid');
				}
			})
			.fail(function(){
				response.error('VerificationCode not found');
			});

	}else{
		response.error('Invalid input');
	}
});