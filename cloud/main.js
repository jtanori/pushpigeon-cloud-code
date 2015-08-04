var moment = require('moment');
var _ = require('underscore');
var mandrillServices = require("cloud/services/mandrillServices.js");
var validations = require('cloud/validations.js');

require('cloud/routes/emails.js');
require('cloud/routes/notifications.js');

Parse.Cloud.afterSave(Parse.User, function(req){
	if(req.object.existed()){
		return;
	}

	var data = {AccessCode: _.random(1000, 9999), User: req.object, active: true, validated: false};
	var code = new (Parse.Object.extend('VerificationCode'))();

	code
		.save(data)
		.then(function(){
			console.log('VerificationCode saved for user: ' + req.object.id);
		})
		.fail(function(){
			console.log('VerificationCode could not be saved for user: ' + req.object.id);
		});
});

Parse.Cloud.afterSave('GroupAdmin', function(req){
	if(req.object.existed()){
		return;
	}

	var Group = Parse.Object.extend('Group');
	var groupQuery = new Parse.Query(Group);

	groupQuery.get(req.object.get('group').id, {
		success: function(g){
			if(g.get('isNew')){
				var GroupCategory = Parse.Object.extend("GroupCategory");
				var GroupAdmin = Parse.Object.extend('GroupAdmin');

				var all = new GroupCategory({category_name: 'All Members', isActive: true, group: g, modified_by_admin: req.object, created_by_admin: req.object});
				var everyone = new GroupCategory({category_name: 'Everyone', isActive: true, group: g, modified_by_admin: req.object, created_by_admin: req.object});
				var staff = new GroupCategory({category_name: 'All Staff', isActive: true, group: g, modified_by_admin: req.object, created_by_admin: req.object});

				Parse.Object.saveAll([all, everyone, staff], {
					success: function(){
						console.log('All categories saved for new group');
						console.log(req.object.id);
					},
					error: function(){
						console.log('Coudld not save categories for group');
						console.log(req.object.id);
						console.log(e);
					}
				});
			}

			g.save('isNew', false);
		}
	});

	var data = {AccessCode: _.random(1000, 9999), Admin: req.object, active: true, validated: false};
	var code = new (Parse.Object.extend('VerificationCode'))();

	code
		.save(data)
		.then(function(){
			console.log('VerificationCode saved for GroupAdmin: ' + req.object.id);
		})
		.fail(function(){
			console.log('VerificationCode could not be saved for GroupAdmin: ' + req.object.id);
		});
});

Parse.Cloud.afterSave('Group', function(request){
	if(request.object.existed() && request.object.get('lastModificationType') === 'update'){
		var username = request.object.get('firstname');
		var email = request.object.get('email');
		var templateVars = [{
	        "name": "username",
	        "content": username
	    }];

		mandrillServices
			.sendEmail(username, email, 'AccountUpdated', templateVars, 'Your account has been updated.',  {'X-MC-AutoText': true})
			.then(function(){
				console.log('AccountUpdated email sent for Group: ' + request.object.id);
			})
			.fail(function(e){
				console.log('AccountUpdated email not sent for Group: ' + request.object.id);
				console.log(e);
			});

		request.object.save('lastModificationType', '');
	}
});

Parse.Cloud.beforeSave('Group', function(request, response){
	if(!request.object.existed()){
		request.object.set('isNew', true);	
	}else{
		request.object.set('isNew', false);
	}

	response.success();
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

				mandrillServices
					.sendVerificationCode(email, code, template)
				   	.then(function(result){
				   		console.log(result);
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
				var isAdmin = false;
				var isForgot = false;
				var user;

				if(!_.isEmpty(c)){
					isForgot = c.get('type') === 'forgotPassword' ? true : false;

					if(c.get('Admin')){
						isValid = c.get('Admin').get('email') === email;
						isAdmin = true;
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
									var email = user.get('email');
									var username;
									var templateVars = [];
									var template = user.get('initial') ? 'GroupWelcome' : 'Welcome';
									var Member = Parse.Object.extend('Member');
									var memberQuery = new Parse.Query(Member);

									if(!isAdmin){
										memberQuery
											.equalTo('user_id', user)
											.first()
											.then(function(m){
												if(!_.isEmpty(m)){
													username = m.get('member_first_name');
													templateVars.push({
												        "name": "username",
												        "content": username
												    });

												    if(!isForgot){
													    mandrillServices
															.sendEmail(username, email, template, templateVars, 'Welcome to Push Pigeon', {'X-MC-Important': true})
															.then(function(){
																console.log('Wecome email sent for User: ' + user.id);
																response.success({status: 'success', verificationCode: {id: c.id, verified: true, type: c.get('type')}});
															})
															.fail(function(e){
																console.log('Welcome email not sent for User: ' + user.id);
																console.log(e);
																response.success({status: 'success', message: 'Email could not be sent to user', verificationCode: {id: c.id, verified: true, type: c.get('type')}});
															});
												    } else {
												    	response.success({status: 'success', verificationCode: {id: c.id, verified: true, type: c.get('type')}});
												    }
												}else{
													response.success({status: 'success', message: 'Email could not be sent to user, member not found', verificationCode: {id: c.id, verified: true, type: c.get('type')}});
												}
											})
											.fail(function(){
												response.success({status: 'success', message: 'Email could not be sent to user, failure at finding member', verificationCode: {id: c.id, verified: true, type: c.get('type')}});
											});
									}else{
										username = user.get('firstname');
										templateVars.push({
									        "name": "username",
									        "content": username
									    });

									    //Set initial flag as false
									    user.save('initial', false);

										if(!isForgot){
											mandrillServices
												.sendEmail(username, email, template, templateVars, 'Welcome to Push Pigeon', {'X-MC-Important': true})
												.then(function(){
													console.log('Wecome email sent for User: ' + user.id);
													response.success({status: 'success', verificationCode: {id: c.id, verified: true, type: c.get('type')}});
												})
												.fail(function(e){
													console.log('Welcome email not sent for User: ' + user.id);
													console.log(e);
													response.success({status: 'success', message: 'Email could not be sent to user', verificationCode: {id: c.id, verified: true, type: c.get('type')}});
												});
										} else {
											response.success({status: 'success', verificationCode: {id: c.id, verified: true, type: c.get('type')}});
										}
									}
								})
								.fail(function(e){
									console.log('Could not save user verified status, attempt to send email was halted.');
									console.log(e);
									response.error(e);
								});
						})
						.fail(function(){
							response.error('Could not validate code');
						})
				}else{
					response.error('No verification code pending found for that email address, it can be that you have already validated that account or that the account does not exists.');
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
					Parse.Cloud.useMasterKey();

					u
						.save({password: request.params.newPassword})
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

Parse.Cloud.define('requestVerification', function(request, response){
	if(request.params && !_.isEmpty(request.params.email) && validations.EMAIL.test(request.params.email)){
		var data = {AccessCode: _.random(1000, 9999), active: true, validated: false};
		var code = new (Parse.Object.extend('VerificationCode'))();
		var query, isAdmin = false;

		switch(request.params.userType){
		case 'groupAdmin': isAdmin= true; query = new Parse.Query('GroupAdmin'); break;
		default: query = new Parse.Query(Parse.User);
		}

		query
			.equalTo('email', request.params.email)
			.notEqualTo('verified', true)
			.first()
			.then(function(u){
				if(!_.isEmpty(u)){
					if(isAdmin){
						data.Admin = u;
					}else{
						data.User = u;
					}
					
					code
						.save(data)
						.then(function(){
							console.log('VerificationCode saved for user: ' + u.id + ' (admin: ' + isAdmin + ')');
							response.success('VerificationCode saved');
						})
						.fail(function(){
							console.log('VerificationCode could not be saved for user: ' + u.id + ' (admin: ' + isAdmin + ')');
							response.error('Could not save verificationCode');
						});
				}else{
					response.error('Looks like that email address has already been validated or it is not a valid Push Pigeon group admin.');
				}
			})
			.fail(function(e){
				response.error(e);
			});
	}else{
		response.error('Invalid input');
	}
});

Parse.Cloud.define('sendInvitationEmail', function(request, response){
	if(request.params && request.params.id && request.params.adminName && request.params.adminLastName && request.params.memberName){
		var GroupMemberLink = Parse.Object.extend('GroupMemberLink');
		var linkQuery = new Parse.Query(GroupMemberLink);
		var groupname, membername, username, email, templateVars = [];

		linkQuery
			.include('group')
			.include('member')
			.get(request.params.id)
			.then(function(l){
				groupname = l.get('group').get('group_name');
				username = l.get('group').get('firstname');
				email = l.get('member').get('member_email');

				templateVars.push({name: 'username', content: request.params.memberName});
				templateVars.push({name: 'admin', content: request.params.adminName + ' ' + request.params.adminLastName});
	    		templateVars.push({name: 'groupname', content: groupname});

				mandrillServices
					.sendEmail(request.params.memberName, email, 'MemberInvited', templateVars, request.params.adminName + ' ' + request.params.adminLastName + ' had added you to ' + groupname + ' on Push Pigeon')
					.then(function(){
						console.log('MemberInvited email sent for GroupMemberLink: ' + request.params.id);
						response.success('success');
					})
					.fail(function(e){
						console.log('MemberInvited email not sent for GroupMemberLink: ' + request.params.id);
						console.log(e);
						response.error(e);
					});
			})
			.fail(function(e){
				console.log(e);
				response.error('Could not find GroupMemberLink: ' + request.params.id);
			});
	}else{
		response.error('Invalid input');
	}
});

Parse.Cloud.define('sendRevokeEmail', function(request, response){
	if(request.params && request.params.id && request.params.adminName && request.params.adminLastName && request.params.memberName){
		var templateVars = [];

		templateVars.push({name: 'username', content: request.params.memberName});
		templateVars.push({name: 'admin', content: request.params.adminName + ' ' + request.params.adminLastName});
		templateVars.push({name: 'groupname', content: request.params.groupName});

		mandrillServices
			.sendEmail(request.params.memberName, request.params.memberEmail, 'MemberRemoved', templateVars, request.params.adminName + ' ' + request.params.adminLastName + ' had removed you from ' + request.params.groupName + ' on Push Pigeon')
			.then(function(){
				console.log('MemberInvited email sent for GroupMemberLink: ' + request.params.id);
				response.success('success');
			})
			.fail(function(e){
				console.log('MemberInvited email not sent for GroupMemberLink: ' + request.params.id);
				console.log(e);
				response.error(e);
			});
	}else{
		response.error('Invalid input');
	}
});

Parse.Cloud.define('sendNewAdminAddedEmail', function(request, response){
	if(request.params && request.params.adminEmail && request.params.memberName && request.params.groupName && request.params.adminName && request.params.adminLastName){
		var templateVars = [];

		templateVars.push({name: 'username', content: request.params.adminName});
		templateVars.push({name: 'membername', content: request.params.memberName + ' ' + request.params.memberLastName});
		templateVars.push({name: 'groupname', content: request.params.groupName});
		//TODO: Fix this one, multiple recipients should be in a single call
		mandrillServices
			.sendEmail(request.params.adminName, request.params.adminEmail, 'AdminCreated', templateVars, 'New admin confirmation')
			.then(function(){
				console.log('AdminCreated email sent to: ' + request.params.adminEmail);
				response.success('success');
			})
			.fail(function(e){
				console.log('AdminCreated email not sent to: ' + request.params.adminEmail);
				console.log(e);
				response.error(e);
			});

		mandrillServices
			.sendEmail(request.params.memberName, request.params.memberEmail, 'NewAdmin', templateVars, request.params.adminName + ' ' + request.params.adminLastName + ' has added you as an Admin')
			.then(function(){
				console.log('AdminCreated email sent to: ' + request.params.memberEmail);
				response.success('success');
			})
			.fail(function(e){
				console.log('AdminCreated email not sent to: ' + request.params.memberEmail);
				console.log(e);
				response.error(e);
			});
	}else{
		response.error('Invalid input');
	}
});

Parse.Cloud.define('sendGroupInvitationEmail', function(request, response){
	if(request.params && request.params.contactEmail && request.params.contactName && request.params.groupName && request.params.memberEmail && request.params.memberName && request.params.memberId){
		var templateVars = [];
		var InviteGroup = Parse.Object.extend('InviteGroup');
		var inviteGroup = new InviteGroup();

		templateVars.push({name: 'username', content: request.params.contactName.split(' ')[0]});
		templateVars.push({name: 'membername', content: request.params.memberName || 'Push Pigeon'});
		templateVars.push({name: 'groupname', content: request.params.groupName});
		
		inviteGroup.save({
			contact_email: request.params.contactEmail,
			contact_person: request.params.contactName,
			contact_phone: request.params.contactPhoneNumber || '',
			name: request.params.groupName,
			state: request.params.state || ''
		})
		.then(function(){
			//TODO: Fix this one, multiple recipients should be in a single call
			mandrillServices
				.sendEmail(request.params.contactName.split(' ')[0], request.params.contactEmail, 'GroupInvitedFromApp', templateVars, request.params.memberName + ' wants you to join Push Pigeon!')
				.then(function(){
					console.log('GroupInvitedFromApp email sent to: ' + request.params.contactEmail);
					response.success('success');
				})
				.fail(function(e){
					console.log('GroupInvitedFromApp email not sent to: ' + request.params.contactEmail);
					console.log(e);
					response.error(e);
				});
		})
		.fail(function(e){
			response.error(e);
		});
	}else{
		response.error('Invalid input');
	}
});

Parse.Cloud.define('requestRemovalFromGroup', function(request, response){
	if(request.params && request.params.groupId && request.params.memberName && request.params.memberEmail){
		var templateVars = [];
		var GroupAdmin = Parse.Object.extend('GroupAdmin');
		var Group = Parse.Object.extend('Group');
		var query = new Parse.Query(GroupAdmin);

		query
			.equalTo('group', (new Group({id: request.params.groupId})))
			.equalTo('isprimary', true)
			.include('group')
			.select(['firstname', 'email', 'group'])
			.find(function(admins){
				if(admins.length){
					console.log(admins);
					_.each(admins, function(admin){

						templateVars = [
							{
								name: 'membername',
								content: request.params.memberName
							},
							{
								name: 'memberemail',
								content: request.params.memberEmail
							},
							{
								name: 'groupname',
								content: admin.get('group').get('group_name')
							},
							{
								name: 'admin',
								content: admin.get('firstname')
							}
						];
						
						mandrillServices
							.sendEmail(admin.get('firstname'), admin.get('email'), 'RemovalRequest', templateVars, 'Please remove ' + request.params.memberName + ' from your Group', {'X-MC-AutoText': true})
							.then(function(){
								console.log('RemovalRequest email sent to: ' + admin.get('email'));
							})
							.fail(function(e){
								console.log('RemovalRequest email not sent to: ' + admin.get('email'));
								console.log(e);
							});
					});

					response.success('Email sent');
				}else{
					console.log('No admin found for group, weird!');
					response.error('No admin found for group.')
				}
			}).fail(function(e){
				response.error(e);
			});
	}else{
		response.erro('Invalid input');
	}
});