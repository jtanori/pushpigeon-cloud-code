var moment = require('moment');
var _ = require('underscore');


Parse.Cloud.beforeSave('Notification', function(request, response){
	if(!request.object.existed()){
		var object = request.object;
		var scheduled = object.get('schedule_time');
		var createdAt = object.get('createdAt');

		if(_.isEmpty(scheduled)){
			object.set('schedule_time', createdAt);
		}
	}

	response.success();
});

//Send instant notification
Parse.Cloud.define('sendNotification', function(req, res){
	Parse.Push.send({
		channels: [ 'dev' ],
		data: {
			alert: "the boston red sox won the world series for the first time in 86 years, can you believe it?"
		}
	}, {
		success: function() {
			// Push was successful
			res.success('Push sent');
		},
		error: function(error) {
			// Handle error
			req.error('Push not sent');
		}
	});
});

Parse.Cloud.define('getMembersForNotification', function(request, response){
	if(request.params && request.params.id){
		var ParseNotification = Parse.Object.extend('Notification');
		var parseNotification = new ParseNotification({id: request.params.id});
		var NotificationCategoryLink = Parse.Object.extend('NotificationCategoryLink');
		var notificationCategoryLinkQuery = new Parse.Query(NotificationCategoryLink);

		notificationCategoryLinkQuery
		    .equalTo('notification', parseNotification)
		    .find()
		    .then(function(d){
		        if(d.length){
		            try{
		            	var GroupCategory = Parse.Object.extend('GroupCategory');
			            var groupCategory = new GroupCategory({id: d[0].get('group_category').id})
			            var CategoryMemberLink = Parse.Object.extend('CategoryMemberLink');
			            var categoryMemberLinkQuery = new Parse.Query(CategoryMemberLink);
			            categoryMemberLinkQuery
			                .equalTo('category', groupCategory)
			                .include(['group_request_status', 'member.user_id'])
			                .find()
			                .then(function(u){
			                	if(u.length){
			                		var users = _.filter(u, function(user){
			                			var status = user.get('group_request_status');
			                			var statusName = !_.isEmpty(status) ? status.get('status_name') : false;
			                			var isMember = !!user.get('member');

			                			if(statusName && statusName.toLowerCase() === 'approved' && isMember){
			                				return user.get('member');
			                			}
			                		}).map(function(user){
			                			return user.get('member');
			                		});

			                		console.log('getMembersForNotification:')
			                		console.log(users);

			                		response.success({status: 'success', results: users});
			                	}else{
			                		response.error({status: 'error', message: 'No active users found for given notification'});
			                	}
			                })
			                .fail(function(e){
			                	response.error(e);
			                });
			            }catch(e){
			            	response.error(e);
			            }
		        }else{
		        	response.error({status: 'error', message: 'Notification not found'});
		        }
		    })
			.fail(function(e){
				response.error(e);
			});
	}else{
		response.error({status: 'error', message: 'Invalid payload'});
	}
});